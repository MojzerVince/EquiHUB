import * as Location from "expo-location";
import { Accelerometer, Gyroscope } from "expo-sensors";
import { BackgroundFallDetectionAPI } from "./backgroundFallDetectionAPI";
import { MovementTracker } from "./movementTracker";
import { ServerSMSAPI } from "./serverSMSAPI";

export interface SensorData {
  accelerometer: {
    x: number;
    y: number;
    z: number;
  };
  gyroscope: {
    x: number;
    y: number;
    z: number;
  };
  timestamp: number;
}

export interface FallDetectionConfig {
  accelerationThreshold: number; // g-force threshold for fall detection (baseline)
  highSpeedThreshold: number; // g-force threshold for high-speed impacts (15g)
  lowSpeedThreshold: number; // g-force threshold for low-speed impacts (5g)
  speedDetectionThreshold: number; // m/s threshold to determine high vs low speed
  gyroscopeThreshold: number; // angular velocity threshold for fall detection
  impactDuration: number; // minimum duration for sustained impact (ms)
  recoveryTimeout: number; // time to wait for recovery before triggering alert (ms)
  isEnabled: boolean;
}

export interface FallEvent {
  id: string;
  timestamp: number;
  accelerationMagnitude: number;
  gyroscopeMagnitude: number;
  location?: {
    latitude: number;
    longitude: number;
  };
  alertSent: boolean;
  alertSentAt?: number;
  detectedInBackground?: boolean; // Optional flag to distinguish background detection
}

export class FallDetectionAPI {
  private static accelerometerSubscription: any = null;
  private static gyroscopeSubscription: any = null;
  private static isMonitoring = false;
  private static sensorHistory: SensorData[] = [];
  private static readonly MAX_HISTORY_SIZE = 50; // Keep last 50 readings
  private static potentialFallStartTime: number | null = null;
  private static lastStableTime: number = Date.now();
  private static fallEventListeners: ((fallEvent: FallEvent) => void)[] = [];
  private static hasPendingAlert: boolean = false; // Track if there's already a pending alert
  private static lastResetTime: number = 0; // Track when the last reset happened
  private static currentVelocity: number = 0; // Track current estimated velocity (m/s)
  private static lastAcceleration: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 };
  private static isMonitoringPostFall: boolean = false; // Track if we're monitoring after a potential fall
  private static postFallMonitoringTimeout: NodeJS.Timeout | null = null; // Timeout for post-fall monitoring

  // Default configuration
  private static config: FallDetectionConfig = {
    accelerationThreshold: 2.5, // 2.5g baseline threshold
    highSpeedThreshold: 15.0, // 15g for high-speed impacts
    lowSpeedThreshold: 5.0, // 5g for low-speed impacts
    speedDetectionThreshold: 3.0, // 3 m/s to determine high vs low speed
    gyroscopeThreshold: 5.0, // 5 rad/s rotational velocity
    impactDuration: 500, // 500ms sustained impact
    recoveryTimeout: 10000, // 10 seconds to recover before alert
    isEnabled: true,
  };

  // Start fall detection monitoring (both foreground and background)
  static async startMonitoring(userId: string, enableBackground: boolean = true): Promise<boolean> {
    if (this.isMonitoring) {
      console.log("Fall detection already monitoring");
      return true;
    }

    try {
      // Check if sensors are available
      const accelAvailable = await Accelerometer.isAvailableAsync();
      const gyroAvailable = await Gyroscope.isAvailableAsync();

      if (!accelAvailable || !gyroAvailable) {
        console.error("Required sensors not available for fall detection");
        return false;
      }

      // Set sensor update intervals (20Hz = 50ms intervals for responsive detection)
      Accelerometer.setUpdateInterval(50);
      Gyroscope.setUpdateInterval(50);

      // Start accelerometer monitoring
      this.accelerometerSubscription = Accelerometer.addListener((accelerometerData) => {
        this.processAccelerometerData(accelerometerData, userId);
      });

      // Start gyroscope monitoring
      this.gyroscopeSubscription = Gyroscope.addListener((gyroscopeData) => {
        this.processGyroscopeData(gyroscopeData, userId);
      });

      this.isMonitoring = true;
      this.sensorHistory = [];
      this.potentialFallStartTime = null;
      this.lastStableTime = Date.now();

      // Start movement tracking for intelligent fall detection
      const movementTrackingStarted = await MovementTracker.startLocationTracking();
      if (!movementTrackingStarted) {
        console.warn("⚠️ Movement tracking failed to start - fall detection will work but without movement validation");
      } else {
        console.log("📍 Movement tracking started for fall detection");
      }

      // Start background monitoring if enabled and app supports it
      if (enableBackground) {
        console.log("🔍 Starting background fall detection monitoring");
        const backgroundStarted = await BackgroundFallDetectionAPI.startBackgroundMonitoring(userId, {
          accelerationThreshold: this.config.accelerationThreshold,
          gyroscopeThreshold: this.config.gyroscopeThreshold,
          impactDuration: this.config.impactDuration,
          recoveryTimeout: this.config.recoveryTimeout,
          isEnabled: this.config.isEnabled,
          sensorUpdateInterval: 100, // 10Hz for background to save battery
        });

        if (backgroundStarted) {
          console.log("✅ Background fall detection started successfully");
        } else {
          console.warn("⚠️ Background fall detection failed to start, continuing with foreground only");
        }
      }

      console.log("🔍 Fall detection monitoring started (foreground + background)");
      return true;
    } catch (error) {
      console.error("Error starting fall detection:", error);
      return false;
    }
  }

  // Stop fall detection monitoring (both foreground and background)
  static async stopMonitoring(): Promise<void> {
    if (this.accelerometerSubscription) {
      this.accelerometerSubscription.remove();
      this.accelerometerSubscription = null;
    }

    if (this.gyroscopeSubscription) {
      this.gyroscopeSubscription.remove();
      this.gyroscopeSubscription = null;
    }

    // Stop background monitoring
    await BackgroundFallDetectionAPI.stopBackgroundMonitoring();

    // Stop movement tracking
    await MovementTracker.stopLocationTracking();

    // Clear any ongoing post-fall monitoring
    if (this.postFallMonitoringTimeout) {
      clearTimeout(this.postFallMonitoringTimeout);
      this.postFallMonitoringTimeout = null;
    }

    this.isMonitoring = false;
    this.isMonitoringPostFall = false;
    this.sensorHistory = [];
    this.potentialFallStartTime = null;
    console.log("🔍 Fall detection monitoring stopped (foreground + background + movement)");
  }

  // Process accelerometer data
  private static processAccelerometerData(data: any, userId: string): void {
    const timestamp = Date.now();
    const magnitude = Math.sqrt(data.x * data.x + data.y * data.y + data.z * data.z);

    // Calculate velocity estimation from acceleration
    this.updateVelocityEstimation(data, timestamp);

    // Add to sensor history
    const sensorData: SensorData = {
      accelerometer: { x: data.x, y: data.y, z: data.z },
      gyroscope: { x: 0, y: 0, z: 0 }, // Will be updated by gyroscope callback
      timestamp,
    };

    this.addToHistory(sensorData);

    // Check for sudden acceleration/deceleration (fall indicator) with speed-aware thresholds
    this.analyzeForFallWithSpeed(magnitude, timestamp, userId);
  }

  // Process gyroscope data
  private static processGyroscopeData(data: any, userId: string): void {
    const magnitude = Math.sqrt(data.x * data.x + data.y * data.y + data.z * data.z);

    // Update latest sensor data with gyroscope info
    if (this.sensorHistory.length > 0) {
      this.sensorHistory[this.sensorHistory.length - 1].gyroscope = {
        x: data.x,
        y: data.y,
        z: data.z,
      };
    }

    // Analyze gyroscope data for rotational movement (tumbling)
    this.analyzeRotationalMovement(magnitude, userId);
  }

  // Add sensor data to history buffer
  private static addToHistory(data: SensorData): void {
    this.sensorHistory.push(data);
    if (this.sensorHistory.length > this.MAX_HISTORY_SIZE) {
      this.sensorHistory.shift();
    }
  }

  // Update velocity estimation from accelerometer data
  private static updateVelocityEstimation(data: any, timestamp: number): void {
    // Simple velocity integration from acceleration
    // Remove gravity component and calculate velocity change
    const netAcceleration = {
      x: data.x * 9.81, // Convert from g to m/s²
      y: data.y * 9.81,
      z: (data.z - 1.0) * 9.81 // Remove gravity from z-axis
    };

    // Calculate time delta (assuming ~60Hz sensor rate)
    const deltaTime = 0.016; // 16ms = 1/60s

    // Simple integration to estimate velocity magnitude
    const velocityChange = Math.sqrt(
      netAcceleration.x * netAcceleration.x +
      netAcceleration.y * netAcceleration.y +
      netAcceleration.z * netAcceleration.z
    ) * deltaTime;

    // Update current velocity estimate (with some decay to prevent drift)
    this.currentVelocity = this.currentVelocity * 0.95 + velocityChange;
    
    // Store last acceleration for comparison
    this.lastAcceleration = { x: data.x, y: data.y, z: data.z };
  }

  // Analyze accelerometer data with speed-aware thresholds
  private static analyzeForFallWithSpeed(magnitude: number, timestamp: number, userId: string): void {
    // Normal gravity is around 1g, significant deviations indicate impact or free fall
    const gravityDeviation = Math.abs(magnitude - 1.0);

    // Determine if we're in high-speed or low-speed scenario
    const isHighSpeed = this.currentVelocity > this.config.speedDetectionThreshold;
    
    // Use appropriate threshold based on speed
    const effectiveThreshold = isHighSpeed 
      ? this.config.highSpeedThreshold 
      : this.config.lowSpeedThreshold;

    // Check for fall based on speed-appropriate threshold
    const isHighImpact = gravityDeviation > effectiveThreshold;
    const isFreeFall = magnitude < 0.5; // Very low gravity indicates free fall
    const isShaking = magnitude > 2.0; // High motion indicating impact/tumbling
    
    if (isHighImpact || isFreeFall || isShaking) {
      // Potential fall detected
      if (this.potentialFallStartTime === null) {
        this.potentialFallStartTime = timestamp;
      }

      // Check if impact has been sustained long enough OR immediate trigger for severe impacts
      const impactDuration = timestamp - this.potentialFallStartTime;
      const isSevereImpact = gravityDeviation > (effectiveThreshold * 2); // 2x effective threshold
      
      if (impactDuration >= this.config.impactDuration || isSevereImpact) {
        this.handlePotentialFall(userId, magnitude, timestamp);
      }
    } else {
      // Stable readings - reset potential fall detection
      if (this.potentialFallStartTime !== null) {
        this.potentialFallStartTime = null;
      }
      this.lastStableTime = timestamp;
    }
  }

  // Analyze accelerometer data for potential falls
  private static analyzeForFall(magnitude: number, timestamp: number, userId: string): void {
    // Normal gravity is around 1g, significant deviations indicate impact or free fall
    const gravityDeviation = Math.abs(magnitude - 1.0);

    // Check for sudden acceleration/deceleration (fall indicators)
    // This includes both high G impacts AND low G free fall scenarios
    const isHighImpact = gravityDeviation > this.config.accelerationThreshold;
    const isFreeFall = magnitude < 0.5; // Very low gravity indicates free fall
    const isShaking = magnitude > 2.0; // High motion indicating impact/tumbling
    
    if (isHighImpact || isFreeFall || isShaking) {
      // Potential fall detected
      if (this.potentialFallStartTime === null) {
        this.potentialFallStartTime = timestamp;
      }

      // Check if impact has been sustained long enough OR immediate trigger for severe impacts
      const impactDuration = timestamp - this.potentialFallStartTime;
      const isSevereImpact = gravityDeviation > (this.config.accelerationThreshold * 2); // 2x threshold
      
      if (impactDuration >= this.config.impactDuration || isSevereImpact) {
        this.handlePotentialFall(userId, magnitude, timestamp);
      }
    } else {
      // Stable readings - reset potential fall detection
      if (this.potentialFallStartTime !== null) {
        this.potentialFallStartTime = null;
      }
      this.lastStableTime = timestamp;
    }
  }

  // Analyze gyroscope data for rotational movement
  private static analyzeRotationalMovement(magnitude: number, userId: string): void {
    
    if (magnitude > this.config.gyroscopeThreshold) {
      const timestamp = Date.now();
      
      // If we already have a potential fall and now detect rotation, this strengthens the fall hypothesis
      if (this.potentialFallStartTime !== null) {
        this.handlePotentialFall(userId, magnitude, timestamp, true);
      } else {
        // High rotation alone can indicate a fall (tumbling)
        this.potentialFallStartTime = timestamp;
        // Give it a shorter timeout for rotation-based detection
        setTimeout(() => {
          if (this.potentialFallStartTime === timestamp) {
            this.handlePotentialFall(userId, magnitude, timestamp, true);
          }
        }, Math.min(this.config.impactDuration, 1000)); // Max 1 second for rotation
      }
    }
  }

  // Handle potential fall event with movement validation
  private static async handlePotentialFall(
    userId: string,
    magnitude: number,
    timestamp: number,
    hasRotation: boolean = false
  ): Promise<void> {
    if (!this.config.isEnabled) {
      return;
    }

    // Check if there's already a pending alert or post-fall monitoring
    if (this.hasPendingAlert || this.isMonitoringPostFall) {
      return;
    }

    // Ignore detections for 2 seconds after a reset to prevent rapid re-triggering
    if (timestamp - this.lastResetTime < 2000) {
      return;
    }

    console.log("🚨 POTENTIAL FALL DETECTED - Starting movement validation...");

    // STEP 1: Check if rider was moving before the fall (pre-fall validation)
    const preFallMovement = MovementTracker.wasMovingDistance(25, 15000); // 25m in past 15 seconds
    if (!preFallMovement) {
      console.log("❌ Pre-fall validation failed: Rider was not moving >25m in past 15 seconds - ignoring potential fall");
      this.resetFallDetectionState();
      return;
    }

    console.log("✅ Pre-fall validation passed: Rider was moving >25m in past 15 seconds");

    // STEP 2: Start post-fall movement monitoring
    this.isMonitoringPostFall = true;
    this.hasPendingAlert = true; // Prevent new detections during monitoring
    
    console.log("⏳ Starting 15-second post-fall movement monitoring...");

    // Monitor movement for 15 seconds
    try {
      const movementDistance = await MovementTracker.monitorMovementFor(15000); // 15 seconds
      
      console.log(`📊 Post-fall movement analysis: ${movementDistance.toFixed(1)}m in 15 seconds`);

      // STEP 3: Decide based on post-fall movement
      if (movementDistance < 25) {
        // Little to no movement - confirmed fall, send alert
        console.log("🚨 FALL CONFIRMED: Movement < 25m - sending emergency alert");
        await this.processConfirmedFall(userId, magnitude, timestamp, hasRotation);
      } else {
        // Significant movement - rider likely recovered, dismiss alert
        console.log("✅ FALL DISMISSED: Movement >= 25m - rider appears to have recovered");
        await this.dismissFallAlert("Rider recovered (significant movement detected)");
      }

    } catch (error) {
      console.error("❌ Error during post-fall monitoring:", error);
      // In case of error, err on the side of safety and send alert
      console.log("⚠️ Sending alert due to monitoring error");
      await this.processConfirmedFall(userId, magnitude, timestamp, hasRotation);
    }

    // Reset monitoring state
    this.isMonitoringPostFall = false;
    this.resetFallDetectionState();
  }

  // Send confirmed fall alert (after movement validation)
  private static async processConfirmedFall(
    userId: string,
    magnitude: number,
    timestamp: number,
    hasRotation: boolean = false
  ): Promise<void> {
    try {
      // Get current location
      let location: { latitude: number; longitude: number } | undefined;
      try {
        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        location = {
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        };
      } catch (error) {
        console.error("❌ Could not get location for fall alert:", error);
        // Use latest location from movement tracker as fallback
        const latestLocation = MovementTracker.getLatestLocation();
        if (latestLocation) {
          location = {
            latitude: latestLocation.latitude,
            longitude: latestLocation.longitude,
          };
        }
      }

      // Create fall event
      const fallEvent: FallEvent = {
        id: `fall_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp,
        accelerationMagnitude: magnitude,
        gyroscopeMagnitude: hasRotation ? magnitude : 0,
        location,
        alertSent: false,
      };

      console.log("🚨 SENDING FALL ALERT after movement validation");

      // Notify listeners for immediate action (e.g., emergency notifications)
      this.notifyFallEventListeners(fallEvent);

    } catch (error) {
      console.error("❌ Error sending confirmed fall alert:", error);
    }
  }

  // Dismiss fall alert with reason
  private static async dismissFallAlert(reason: string): Promise<void> {
    console.log(`✅ Fall alert dismissed: ${reason}`);
    
    // Could send a local notification for debugging
    // await Notifications.scheduleNotificationAsync({
    //   content: {
    //     title: "Fall Alert Dismissed",
    //     body: reason,
    //     sound: false,
    //   },
    //   trigger: null,
    // });
  }

  // Send emergency alert for fall detection
  private static async sendFallAlert(userId: string, fallEvent: FallEvent, riderName?: string): Promise<void> {
    try {
      const alertMessage = `🚨 FALL DETECTED 🚨
EquiHUB: Fall during ride
Time: ${new Date(fallEvent.timestamp).toLocaleTimeString()}
Impact: ${fallEvent.accelerationMagnitude.toFixed(1)}g
Check safety!`;

      const alertResult = await ServerSMSAPI.sendFallAlert(
        userId,
        fallEvent.accelerationMagnitude,
        fallEvent.location,
        riderName
      );

      if (alertResult.success) {
        fallEvent.alertSent = true;
        fallEvent.alertSentAt = Date.now();
        console.log(`✅ Fall alert sent to ${alertResult.sentCount} emergency contacts`);
      } else {
        console.error("❌ Failed to send fall alert:", alertResult.error);
      }
    } catch (error) {
      console.error("Error sending fall alert:", error);
    }
  }

  // Update fall detection configuration
  static updateConfig(newConfig: Partial<FallDetectionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log("Fall detection config updated:", this.config);
  }

  // Get current configuration
  static getConfig(): FallDetectionConfig {
    return { ...this.config };
  }

  // Check if monitoring is active
  static isActivelyMonitoring(): boolean {
    return this.isMonitoring;
  }

  // Add fall event listener
  static addFallEventListener(listener: (fallEvent: FallEvent) => void): void {
    this.fallEventListeners.push(listener);
  }

  // Remove fall event listener
  static removeFallEventListener(listener: (fallEvent: FallEvent) => void): void {
    const index = this.fallEventListeners.indexOf(listener);
    if (index > -1) {
      this.fallEventListeners.splice(index, 1);
    }
  }

  // Notify all fall event listeners
  private static notifyFallEventListeners(fallEvent: FallEvent): void {
    this.fallEventListeners.forEach((listener) => {
      try {
        listener(fallEvent);
      } catch (error) {
        console.error("Error in fall event listener:", error);
      }
    });
  }

  // Get sensor history for debugging
  static getSensorHistory(): SensorData[] {
    return [...this.sensorHistory];
  }

  // Get all fall events (including background ones)
  static async getAllFallEvents(): Promise<(FallEvent | any)[]> {
    try {
      const backgroundEvents = await BackgroundFallDetectionAPI.getStoredFallEvents();
      // Convert background events to regular fall events for consistency
      const convertedBackgroundEvents = backgroundEvents.map(bgEvent => ({
        id: bgEvent.id,
        timestamp: bgEvent.timestamp,
        accelerationMagnitude: bgEvent.accelerationMagnitude,
        gyroscopeMagnitude: bgEvent.gyroscopeMagnitude,
        location: bgEvent.location,
        alertSent: bgEvent.alertSent,
        alertSentAt: bgEvent.alertSentAt,
        detectedInBackground: true, // Add flag to distinguish
      }));

      // Note: In a real implementation, you would also get foreground events
      // from storage or from your event listeners storage
      return convertedBackgroundEvents;
    } catch (error) {
      console.error("Error getting all fall events:", error);
      return [];
    }
  }

  // Check if background monitoring is available and active
  static isBackgroundMonitoringActive(): boolean {
    return BackgroundFallDetectionAPI.isMonitoringActive();
  }

  // Update background configuration
  static async updateBackgroundConfig(newConfig: Partial<any>): Promise<void> {
    await BackgroundFallDetectionAPI.updateConfig(newConfig);
  }

  // Test fall detection (for debugging)
  static async triggerTestFall(userId: string, riderName?: string): Promise<void> {
    console.log("🧪 Triggering test fall detection");
    const testFallEvent: FallEvent = {
      id: `test_fall_${Date.now()}`,
      timestamp: Date.now(),
      accelerationMagnitude: 3.0,
      gyroscopeMagnitude: 6.0,
      alertSent: false,
    };

    await this.sendFallAlert(userId, testFallEvent, riderName);
    this.notifyFallEventListeners(testFallEvent);
  }

  // Send fall alert for confirmed falls (public method)
  static async sendConfirmedFallAlert(userId: string, fallEvent: FallEvent, riderName?: string): Promise<void> {
    console.log("📱 Sending confirmed fall alert");
    await this.sendFallAlert(userId, fallEvent, riderName);
  }

  // Reset the fall detection state (public method)
  static resetFallDetectionState(): void {
    console.log("🔄 Resetting fall detection state");
    
    // Clear any post-fall monitoring
    if (this.postFallMonitoringTimeout) {
      clearTimeout(this.postFallMonitoringTimeout);
      this.postFallMonitoringTimeout = null;
    }
    
    this.hasPendingAlert = false;
    this.isMonitoringPostFall = false;
    this.potentialFallStartTime = null;
    this.lastStableTime = Date.now();
    this.lastResetTime = Date.now();
    this.currentVelocity = 0;
    this.lastAcceleration = { x: 0, y: 0, z: 0 };
    
    console.log("✅ Fall detection state reset - hasPendingAlert:", this.hasPendingAlert);
    
    // Also reset background fall detection state
    BackgroundFallDetectionAPI.resetBackgroundFallDetectionState().catch(error => {
      console.error("Error resetting background fall detection state:", error);
    });
  }

  // Check if there's a pending alert
  static hasPendingFallAlert(): boolean {
    return this.hasPendingAlert;
  }
}
