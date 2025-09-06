import * as Location from "expo-location";
import { Accelerometer, Gyroscope } from "expo-sensors";
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
  accelerationThreshold: number; // g-force threshold for fall detection
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

  // Default configuration
  private static config: FallDetectionConfig = {
    accelerationThreshold: 2.5, // 2.5g sudden acceleration/deceleration
    gyroscopeThreshold: 5.0, // 5 rad/s rotational velocity
    impactDuration: 500, // 500ms sustained impact
    recoveryTimeout: 10000, // 10 seconds to recover before alert
    isEnabled: true,
  };

  // Start fall detection monitoring
  static async startMonitoring(userId: string): Promise<boolean> {
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

      console.log("🔍 Fall detection monitoring started");
      return true;
    } catch (error) {
      console.error("Error starting fall detection:", error);
      return false;
    }
  }

  // Stop fall detection monitoring
  static stopMonitoring(): void {
    if (this.accelerometerSubscription) {
      this.accelerometerSubscription.remove();
      this.accelerometerSubscription = null;
    }

    if (this.gyroscopeSubscription) {
      this.gyroscopeSubscription.remove();
      this.gyroscopeSubscription = null;
    }

    this.isMonitoring = false;
    this.sensorHistory = [];
    this.potentialFallStartTime = null;
    console.log("🔍 Fall detection monitoring stopped");
  }

  // Process accelerometer data
  private static processAccelerometerData(data: any, userId: string): void {
    const timestamp = Date.now();
    const magnitude = Math.sqrt(data.x * data.x + data.y * data.y + data.z * data.z);

    // Add to sensor history
    const sensorData: SensorData = {
      accelerometer: { x: data.x, y: data.y, z: data.z },
      gyroscope: { x: 0, y: 0, z: 0 }, // Will be updated by gyroscope callback
      timestamp,
    };

    this.addToHistory(sensorData);

    // Check for sudden acceleration/deceleration (fall indicator)
    this.analyzeForFall(magnitude, timestamp, userId);
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

  // Analyze accelerometer data for potential falls
  private static analyzeForFall(magnitude: number, timestamp: number, userId: string): void {
    // Normal gravity is around 1g, significant deviations indicate impact or free fall
    const gravityDeviation = Math.abs(magnitude - 1.0);

    if (gravityDeviation > this.config.accelerationThreshold) {
      // Potential fall detected
      if (this.potentialFallStartTime === null) {
        this.potentialFallStartTime = timestamp;
        console.log(`⚠️ Potential fall detected: ${gravityDeviation.toFixed(2)}g deviation`);
      }

      // Check if impact has been sustained long enough
      const impactDuration = timestamp - this.potentialFallStartTime;
      if (impactDuration >= this.config.impactDuration) {
        this.handlePotentialFall(userId, magnitude, timestamp);
      }
    } else {
      // Stable readings - reset potential fall detection
      if (this.potentialFallStartTime !== null) {
        console.log("📊 Sensor readings stabilized - canceling fall detection");
        this.potentialFallStartTime = null;
      }
      this.lastStableTime = timestamp;
    }
  }

  // Analyze gyroscope data for rotational movement
  private static analyzeRotationalMovement(magnitude: number, userId: string): void {
    if (magnitude > this.config.gyroscopeThreshold) {
      const timestamp = Date.now();
      console.log(`🌀 High rotational velocity detected: ${magnitude.toFixed(2)} rad/s`);
      
      // If we already have a potential fall and now detect rotation, this strengthens the fall hypothesis
      if (this.potentialFallStartTime !== null) {
        this.handlePotentialFall(userId, magnitude, timestamp, true);
      }
    }
  }

  // Handle potential fall event
  private static async handlePotentialFall(
    userId: string,
    magnitude: number,
    timestamp: number,
    hasRotation: boolean = false
  ): Promise<void> {
    if (!this.config.isEnabled) return;

    const timeSinceStable = timestamp - this.lastStableTime;

    // Check if enough time has passed without recovery
    if (timeSinceStable >= this.config.recoveryTimeout) {
      console.log("🚨 Fall detected - triggering emergency alert");

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
        console.error("Could not get location for fall alert:", error);
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

      // Send emergency alert
      await this.sendFallAlert(userId, fallEvent);

      // Notify listeners
      this.notifyFallEventListeners(fallEvent);

      // Reset detection state
      this.potentialFallStartTime = null;
      this.lastStableTime = Date.now();
    }
  }

  // Send emergency alert for fall detection
  private static async sendFallAlert(userId: string, fallEvent: FallEvent): Promise<void> {
    try {
      const alertMessage = `🚨 FALL DETECTED 🚨
EquiHUB: Fall during ride
Time: ${new Date(fallEvent.timestamp).toLocaleTimeString()}
Impact: ${fallEvent.accelerationMagnitude.toFixed(1)}g
Check safety!`;

      const alertResult = await ServerSMSAPI.sendFallAlert(
        userId,
        fallEvent.accelerationMagnitude,
        fallEvent.gyroscopeMagnitude,
        fallEvent.location
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

  // Test fall detection (for debugging)
  static async triggerTestFall(userId: string): Promise<void> {
    console.log("🧪 Triggering test fall detection");
    const testFallEvent: FallEvent = {
      id: `test_fall_${Date.now()}`,
      timestamp: Date.now(),
      accelerationMagnitude: 3.0,
      gyroscopeMagnitude: 6.0,
      alertSent: false,
    };

    await this.sendFallAlert(userId, testFallEvent);
    this.notifyFallEventListeners(testFallEvent);
  }
}
