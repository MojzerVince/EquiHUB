import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { Accelerometer, Gyroscope } from "expo-sensors";
import * as TaskManager from "expo-task-manager";
import { EmergencyFriendsAPI } from "./emergencyFriendsAPI";
import { MovementTracker } from "./movementTracker";

// Background task name for fall detection
export const BACKGROUND_FALL_DETECTION_TASK = "background-fall-detection-task";

// Interfaces
export interface BackgroundSensorData {
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
  magnitude: number;
  rotationalMagnitude: number;
}

export interface BackgroundFallEvent {
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
  detectedInBackground: boolean;
}

export interface BackgroundFallConfig {
  accelerationThreshold: number;
  highSpeedThreshold: number; // g-force threshold for high-speed impacts (15g)
  lowSpeedThreshold: number; // g-force threshold for low-speed impacts (5g)
  speedDetectionThreshold: number; // m/s threshold to determine high vs low speed
  gyroscopeThreshold: number;
  impactDuration: number;
  recoveryTimeout: number;
  isEnabled: boolean;
  sensorUpdateInterval: number; // milliseconds
}

// Background fall detection task definition
TaskManager.defineTask(BACKGROUND_FALL_DETECTION_TASK, async ({ data, error }) => {
  if (error) {
    console.error("Background fall detection task error:", error);
    return;
  }

  if (data) {
    try {
      // Get stored configuration and state
      const configData = await AsyncStorage.getItem("background_fall_detection_config");
      const config: BackgroundFallConfig = configData ? JSON.parse(configData) : {
        accelerationThreshold: 3.0,
        highSpeedThreshold: 15.0,
        lowSpeedThreshold: 5.0,
        speedDetectionThreshold: 3.0,
        gyroscopeThreshold: 5.0,
        impactDuration: 500,
        recoveryTimeout: 20000,
        isEnabled: true,
        sensorUpdateInterval: 100,
      };

      if (!config.isEnabled) {
        return;
      }

      // Get current user ID
      const userId = await AsyncStorage.getItem("background_fall_detection_user_id");
      if (!userId) {
        console.warn("No user ID available for background fall detection");
        return;
      }

      // Get sensor data from the task data (this would be set up by our background sensor monitoring)
      const sensorData = data as BackgroundSensorData;
      
      // Process the sensor data for fall detection
      await BackgroundFallDetectionAPI.processSensorDataInBackground(sensorData, config, userId);

    } catch (error) {
      console.error("Error in background fall detection task:", error);
    }
  }
});

export class BackgroundFallDetectionAPI {
  private static isBackgroundMonitoringActive = false;
  private static sensorSubscriptions: any[] = [];
  private static backgroundTimer: ReturnType<typeof setInterval> | null = null;

  // Default configuration
  private static defaultConfig: BackgroundFallConfig = {
    accelerationThreshold: 3.0,
    highSpeedThreshold: 15.0, // 15g for high-speed impacts
    lowSpeedThreshold: 5.0, // 5g for low-speed impacts
    speedDetectionThreshold: 3.0, // 3 m/s to determine high vs low speed
    gyroscopeThreshold: 5.0,
    impactDuration: 500,
    recoveryTimeout: 20000,
    isEnabled: true,
    sensorUpdateInterval: 100, // 10Hz for battery efficiency
  };

  // Start background fall detection monitoring
  static async startBackgroundMonitoring(userId: string, config?: Partial<BackgroundFallConfig>): Promise<boolean> {
    try {
      if (this.isBackgroundMonitoringActive) {
        console.log("Background fall detection already monitoring");
        return true;
      }

      // Merge config with defaults
      const finalConfig = { ...this.defaultConfig, ...config };

      // Store configuration and user ID for background task
      await AsyncStorage.setItem("background_fall_detection_config", JSON.stringify(finalConfig));
      await AsyncStorage.setItem("background_fall_detection_user_id", userId);

      // Initialize sensor history storage
      await AsyncStorage.setItem("background_sensor_history", JSON.stringify([]));
      await AsyncStorage.setItem("background_fall_state", JSON.stringify({
        potentialFallStartTime: null,
        lastStableTime: Date.now(),
        hasPendingAlert: false,
        currentVelocity: 0,
        lastAcceleration: { x: 0, y: 0, z: 0 },
      }));

      // Request notification permissions
      await this.requestNotificationPermissions();

      // Check if sensors are available
      const accelAvailable = await Accelerometer.isAvailableAsync();
      const gyroAvailable = await Gyroscope.isAvailableAsync();

      if (!accelAvailable || !gyroAvailable) {
        console.error("Required sensors not available for background fall detection");
        return false;
      }

      // Set up background sensor monitoring using a timer approach
      // This is more reliable than trying to run sensors directly in background
      this.backgroundTimer = setInterval(async () => {
        if (this.isBackgroundMonitoringActive) {
          await this.collectSensorSampleForBackground();
        }
      }, finalConfig.sensorUpdateInterval);

      this.isBackgroundMonitoringActive = true;
      console.log("🔍 Background fall detection monitoring started");
      return true;

    } catch (error) {
      console.error("Error starting background fall detection:", error);
      return false;
    }
  }

  // Stop background fall detection monitoring
  static async stopBackgroundMonitoring(): Promise<void> {
    try {
      this.isBackgroundMonitoringActive = false;

      // Clear background timer
      if (this.backgroundTimer) {
        clearInterval(this.backgroundTimer);
        this.backgroundTimer = null;
      }

      // Stop sensor subscriptions
      this.sensorSubscriptions.forEach(subscription => {
        if (subscription && subscription.remove) {
          subscription.remove();
        }
      });
      this.sensorSubscriptions = [];

      // Clear stored data
      await AsyncStorage.removeItem("background_fall_detection_config");
      await AsyncStorage.removeItem("background_fall_detection_user_id");
      await AsyncStorage.removeItem("background_sensor_history");
      await AsyncStorage.removeItem("background_fall_state");

      console.log("🔍 Background fall detection monitoring stopped");
    } catch (error) {
      console.error("Error stopping background fall detection:", error);
    }
  }

  // Collect a single sensor sample for background processing
  private static async collectSensorSampleForBackground(): Promise<void> {
    try {
      // Get a single sensor reading
      const accelerometerPromise = new Promise<any>((resolve, reject) => {
        const subscription = Accelerometer.addListener((data) => {
          subscription.remove();
          resolve(data);
        });
        setTimeout(() => {
          subscription.remove();
          reject(new Error("Accelerometer timeout"));
        }, 200);
      });

      const gyroscopePromise = new Promise<any>((resolve, reject) => {
        const subscription = Gyroscope.addListener((data) => {
          subscription.remove();
          resolve(data);
        });
        setTimeout(() => {
          subscription.remove();
          reject(new Error("Gyroscope timeout"));
        }, 200);
      });

      const [accelData, gyroData] = await Promise.all([accelerometerPromise, gyroscopePromise]);

      const timestamp = Date.now();
      const magnitude = Math.sqrt(accelData.x * accelData.x + accelData.y * accelData.y + accelData.z * accelData.z);
      const rotationalMagnitude = Math.sqrt(gyroData.x * gyroData.x + gyroData.y * gyroData.y + gyroData.z * gyroData.z);

      const sensorData: BackgroundSensorData = {
        accelerometer: { x: accelData.x, y: accelData.y, z: accelData.z },
        gyroscope: { x: gyroData.x, y: gyroData.y, z: gyroData.z },
        timestamp,
        magnitude,
        rotationalMagnitude,
      };

      // Store the sensor data for processing
      await this.storeSensorDataSample(sensorData);

      // Get current config and user ID
      const configData = await AsyncStorage.getItem("background_fall_detection_config");
      const userId = await AsyncStorage.getItem("background_fall_detection_user_id");

      if (configData && userId) {
        const config: BackgroundFallConfig = JSON.parse(configData);
        await this.processSensorDataInBackground(sensorData, config, userId);
      }

    } catch (error) {
      // Don't log errors in production to avoid spam - sensors might temporarily fail
      if (__DEV__) {
        console.warn("Error collecting background sensor sample:", error);
      }
    }
  }

  // Store sensor data sample in AsyncStorage
  private static async storeSensorDataSample(sensorData: BackgroundSensorData): Promise<void> {
    try {
      const historyData = await AsyncStorage.getItem("background_sensor_history");
      const history: BackgroundSensorData[] = historyData ? JSON.parse(historyData) : [];

      // Add new sample
      history.push(sensorData);

      // Keep only last 50 samples to prevent memory bloat
      const limitedHistory = history.slice(-50);

      await AsyncStorage.setItem("background_sensor_history", JSON.stringify(limitedHistory));
    } catch (error) {
      console.error("Error storing sensor data sample:", error);
    }
  }

  // Process sensor data for fall detection in background
  static async processSensorDataInBackground(
    sensorData: BackgroundSensorData,
    config: BackgroundFallConfig,
    userId: string
  ): Promise<void> {
    try {
      // Get current fall detection state
      const stateData = await AsyncStorage.getItem("background_fall_state");
      const state = stateData ? JSON.parse(stateData) : {
        potentialFallStartTime: null,
        lastStableTime: Date.now(),
        hasPendingAlert: false,
        currentVelocity: 0,
        lastAcceleration: { x: 0, y: 0, z: 0 },
      };

      const { magnitude, rotationalMagnitude, timestamp } = sensorData;

      // Update velocity estimation for speed-based thresholds
      const netAcceleration = {
        x: sensorData.accelerometer.x * 9.81,
        y: sensorData.accelerometer.y * 9.81,
        z: (sensorData.accelerometer.z - 1.0) * 9.81
      };

      const deltaTime = 0.1; // 100ms background sampling rate
      const velocityChange = Math.sqrt(
        netAcceleration.x * netAcceleration.x +
        netAcceleration.y * netAcceleration.y +
        netAcceleration.z * netAcceleration.z
      ) * deltaTime;

      state.currentVelocity = state.currentVelocity * 0.95 + velocityChange;
      state.lastAcceleration = sensorData.accelerometer;

      // Analyze for fall with speed-aware thresholds
      const gravityDeviation = Math.abs(magnitude - 1.0);
      const hasHighRotation = rotationalMagnitude > config.gyroscopeThreshold;

      // Determine if we're in high-speed or low-speed scenario
      const isHighSpeed = state.currentVelocity > config.speedDetectionThreshold;
      
      // Use appropriate threshold based on speed
      const effectiveThreshold = isHighSpeed 
        ? config.highSpeedThreshold 
        : config.lowSpeedThreshold;

      if (gravityDeviation > effectiveThreshold || hasHighRotation) {
        // Potential fall detected
        if (state.potentialFallStartTime === null) {
          state.potentialFallStartTime = timestamp;
        }

        // Check if impact has been sustained long enough
        const impactDuration = timestamp - state.potentialFallStartTime;
        if (impactDuration >= config.impactDuration) {
          await this.handleBackgroundFallEvent(userId, sensorData, config, state);
        }
      } else {
        // Stable readings - reset potential fall detection
        if (state.potentialFallStartTime !== null) {
          state.potentialFallStartTime = null;
        }
        state.lastStableTime = timestamp;
      }

      // Update state
      await AsyncStorage.setItem("background_fall_state", JSON.stringify(state));

    } catch (error) {
      console.error("Error processing background sensor data:", error);
    }
  }

  // Handle a confirmed fall event in background
  private static async handleBackgroundFallEvent(
    userId: string,
    sensorData: BackgroundSensorData,
    config: BackgroundFallConfig,
    state: any
  ): Promise<void> {
    try {
      // Check if we already have a pending alert to prevent multiple notifications
      if (state.hasPendingAlert || state.isMonitoringPostFall) {
        console.log("🚫 Background fall detection: Already processing, skipping duplicate alert");
        return;
      }

      console.log("🚨 BACKGROUND POTENTIAL FALL DETECTED - Starting movement validation...");

      // STEP 1: Check if rider was moving before the fall (pre-fall validation)
      // Note: In background mode, we need to use stored location history
      const preFallMovement = await this.checkBackgroundPreFallMovement();
      if (!preFallMovement) {
        console.log("❌ Background pre-fall validation failed: Rider was not moving >25m in past 15 seconds - ignoring potential fall");
        await this.resetBackgroundState(state);
        return;
      }

      console.log("✅ Background pre-fall validation passed: Rider was moving >25m in past 15 seconds");

      // STEP 2: Start post-fall movement monitoring
      state.isMonitoringPostFall = true;
      state.hasPendingAlert = true; // Prevent new detections during monitoring
      await AsyncStorage.setItem("background_fall_state", JSON.stringify(state));
      
      console.log("⏳ Starting 15-second background post-fall movement monitoring...");

      // Schedule post-fall monitoring check (since we can't await in background)
      await this.schedulePostFallMonitoring(userId, sensorData, 15000);

    } catch (error) {
      console.error("Error handling background fall event:", error);
    }
  }

  // Check pre-fall movement using stored location data in background
  private static async checkBackgroundPreFallMovement(): Promise<boolean> {
    try {
      // In background mode, we need to check stored movement history
      // This is a simplified version - in a full implementation, you'd store location history
      const movementHistoryData = await AsyncStorage.getItem("movement_tracker_history");
      if (!movementHistoryData) {
        console.warn("No movement history available for background validation");
        return true; // Default to allowing detection if no history
      }

      const locationHistory = JSON.parse(movementHistoryData);
      if (locationHistory.length < 2) {
        return true; // Default to allowing if insufficient data
      }

      const now = Date.now();
      const relevantLocations = locationHistory.filter(
        (loc: any) => now - loc.timestamp <= 15000 // Past 15 seconds
      );

      if (relevantLocations.length < 2) {
        return true; // Default to allowing
      }

      // Calculate total distance in the relevant time window
      let totalDistance = 0;
      for (let i = 1; i < relevantLocations.length; i++) {
        const point1 = relevantLocations[i - 1];
        const point2 = relevantLocations[i];
        const distance = MovementTracker.calculateDistance(point1, point2);
        totalDistance += distance;
      }

      console.log(`Background pre-fall movement check: ${totalDistance.toFixed(1)}m in past 15 seconds`);
      return totalDistance > 25;

    } catch (error) {
      console.error("Error checking background pre-fall movement:", error);
      return true; // Default to allowing detection on error
    }
  }

  // Schedule post-fall monitoring for background mode
  private static async schedulePostFallMonitoring(
    userId: string, 
    sensorData: BackgroundSensorData, 
    monitoringDurationMs: number
  ): Promise<void> {
    try {
      // Schedule a notification that will check movement after the monitoring period
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Background Fall Detection",
          body: "Monitoring movement after potential fall...",
          data: {
            type: 'post_fall_monitoring_complete',
            userId,
            fallTimestamp: sensorData.timestamp,
            magnitude: sensorData.magnitude,
            rotationalMagnitude: sensorData.rotationalMagnitude
          },
        },
        trigger: {
          seconds: monitoringDurationMs / 1000, // Convert to seconds
        } as any,
      });

      console.log(`📅 Scheduled post-fall monitoring check in ${monitoringDurationMs/1000} seconds`);

    } catch (error) {
      console.error("Error scheduling post-fall monitoring:", error);
      // Fallback - immediately process as confirmed fall
      await this.processBackgroundConfirmedFall(userId, sensorData);
    }
  }

  // Process confirmed fall in background mode (after movement validation)
  private static async processBackgroundConfirmedFall(
    userId: string, 
    sensorData: BackgroundSensorData
  ): Promise<void> {
    try {
      console.log("🚨 BACKGROUND FALL CONFIRMED - sending emergency alert");

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
        console.error("Could not get location for background fall alert:", error);
      }

      // Create fall event
      const fallEvent: BackgroundFallEvent = {
        id: `bg_fall_${sensorData.timestamp}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: sensorData.timestamp,
        accelerationMagnitude: sensorData.magnitude,
        gyroscopeMagnitude: sensorData.rotationalMagnitude,
        location,
        alertSent: false,
        detectedInBackground: true,
      };

      // Send emergency alert
      await this.sendBackgroundFallAlert(userId, fallEvent);

      // Store fall event for later review
      await this.storeFallEvent(fallEvent);

      // Reset detection state
      await this.resetBackgroundState();

    } catch (error) {
      console.error("Error processing background confirmed fall:", error);
    }
  }

  // Reset background detection state
  private static async resetBackgroundState(state?: any): Promise<void> {
    try {
      const currentState = state || {
        potentialFallStartTime: null,
        lastStableTime: Date.now(),
        hasPendingAlert: false,
        isMonitoringPostFall: false,
      };

      currentState.potentialFallStartTime = null;
      currentState.lastStableTime = Date.now();
      currentState.hasPendingAlert = false;
      currentState.isMonitoringPostFall = false;

      await AsyncStorage.setItem("background_fall_state", JSON.stringify(currentState));
      console.log("🔄 Background fall detection state reset");

    } catch (error) {
      console.error("Error resetting background state:", error);
    }
  }

  // Send emergency alert for background fall detection
  private static async sendBackgroundFallAlert(userId: string, fallEvent: BackgroundFallEvent): Promise<void> {
    try {
      console.log("🚨 Background fall detected - sending emergency notifications");

      // Send emergency notifications using the new friends-based system
      const notificationResult = await EmergencyFriendsAPI.sendFallDetectionNotification(
        userId,
        "Background Detection", // Default name for background detections
        fallEvent.location
      );

      if (notificationResult.success) {
        fallEvent.alertSent = true;
        fallEvent.alertSentAt = Date.now();
        console.log(`✅ Background fall alert sent to ${notificationResult.notifiedCount} emergency friends`);
        
        // Send local notification to inform user about the fall detection
        await this.sendBackgroundFallNotification(fallEvent, notificationResult.notifiedCount);
      } else {
        console.error("❌ Failed to send background fall alert:", notificationResult.error);
        
        // Send notification about failed notification sending
        await this.sendBackgroundFallNotification(fallEvent, 0, true, notificationResult.error);
      }
    } catch (error) {
      console.error("Error sending background fall alert:", error);
      
      // Send notification about the error
      await this.sendBackgroundFallNotification(fallEvent, 0, true, "Unknown error occurred");
    }
  }

  // Send local notification for background fall detection
  private static async sendBackgroundFallNotification(
    fallEvent: BackgroundFallEvent, 
    sentCount: number, 
    isFailed: boolean = false,
    errorMessage?: string
  ): Promise<void> {
    try {
      const title = isFailed ? "⚠️ Fall Detected - Notifications Failed" : "🚨 Fall Detected";
      const body = isFailed 
        ? `Fall detected at ${new Date(fallEvent.timestamp).toLocaleTimeString()}. Failed to send emergency notifications${errorMessage ? `: ${errorMessage}` : ''}. Please check your emergency friends manually.`
        : `Fall detected at ${new Date(fallEvent.timestamp).toLocaleTimeString()}. Emergency notifications sent to ${sentCount} friend${sentCount !== 1 ? 's' : ''}.`;

      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
          categoryIdentifier: "fall-detection",
        },
        trigger: null, // Show immediately
      });

      console.log(`📱 Background fall notification sent: ${title}`);
    } catch (error) {
      console.error("Error sending background fall notification:", error);
    }
  }

  // Store fall event for later review
  private static async storeFallEvent(fallEvent: BackgroundFallEvent): Promise<void> {
    try {
      const eventsData = await AsyncStorage.getItem("background_fall_events");
      const events: BackgroundFallEvent[] = eventsData ? JSON.parse(eventsData) : [];

      events.push(fallEvent);

      // Keep only last 10 events to prevent storage bloat
      const limitedEvents = events.slice(-10);

      await AsyncStorage.setItem("background_fall_events", JSON.stringify(limitedEvents));
    } catch (error) {
      console.error("Error storing fall event:", error);
    }
  }

  // Get stored fall events
  static async getStoredFallEvents(): Promise<BackgroundFallEvent[]> {
    try {
      const eventsData = await AsyncStorage.getItem("background_fall_events");
      return eventsData ? JSON.parse(eventsData) : [];
    } catch (error) {
      console.error("Error getting stored fall events:", error);
      return [];
    }
  }

  // Check if background monitoring is active
  static isMonitoringActive(): boolean {
    return this.isBackgroundMonitoringActive;
  }

  // Update configuration
  static async updateConfig(newConfig: Partial<BackgroundFallConfig>): Promise<void> {
    try {
      const currentConfigData = await AsyncStorage.getItem("background_fall_detection_config");
      const currentConfig = currentConfigData ? JSON.parse(currentConfigData) : this.defaultConfig;
      
      const updatedConfig = { ...currentConfig, ...newConfig };
      
      await AsyncStorage.setItem("background_fall_detection_config", JSON.stringify(updatedConfig));
      console.log("Background fall detection config updated:", updatedConfig);
    } catch (error) {
      console.error("Error updating background fall detection config:", error);
    }
  }

  // Get current configuration
  static async getConfig(): Promise<BackgroundFallConfig> {
    try {
      const configData = await AsyncStorage.getItem("background_fall_detection_config");
      return configData ? JSON.parse(configData) : this.defaultConfig;
    } catch (error) {
      console.error("Error getting background fall detection config:", error);
      return this.defaultConfig;
    }
  }

  // Reset background fall detection state (clears pending alert flag)
  static async resetBackgroundFallDetectionState(): Promise<void> {
    try {
      const resetState = {
        potentialFallStartTime: null,
        lastStableTime: Date.now(),
        hasPendingAlert: false,
        currentVelocity: 0,
        lastAcceleration: { x: 0, y: 0, z: 0 },
      };
      
      await AsyncStorage.setItem("background_fall_state", JSON.stringify(resetState));
      console.log("🔄 Background fall detection state reset - pending alerts cleared");
    } catch (error) {
      console.error("Error resetting background fall detection state:", error);
    }
  }

  // Request notification permissions for background fall detection
  private static async requestNotificationPermissions(): Promise<void> {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn("⚠️ Notification permissions not granted for background fall detection");
        return;
      }

      // Configure notification behavior
      await Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });

      console.log("✅ Notification permissions granted for background fall detection");
    } catch (error) {
      console.error("Error requesting notification permissions:", error);
    }
  }

  // Handle post-fall monitoring completion (called when scheduled notification fires)
  static async handlePostFallMonitoringComplete(notificationData: any): Promise<void> {
    try {
      console.log("⏰ Post-fall monitoring period complete - checking movement");
      
      const { userId, fallTimestamp, magnitude, rotationalMagnitude } = notificationData;

      // Check movement during the monitoring period
      const monitoringStartTime = fallTimestamp;
      const now = Date.now();
      const monitoringDuration = now - monitoringStartTime;

      // Get movement data from the monitoring period
      const movementDistance = await this.calculateMovementDuringPeriod(monitoringStartTime, now);
      
      console.log(`📊 Background post-fall movement analysis: ${movementDistance.toFixed(1)}m in ${monitoringDuration/1000}s`);

      // Decide based on movement
      if (movementDistance < 25) {
        // Little to no movement - confirmed fall, send alert
        console.log("🚨 BACKGROUND FALL CONFIRMED: Movement < 25m - sending emergency alert");
        const sensorData = {
          accelerometer: { x: 0, y: 0, z: 0 },
          gyroscope: { x: 0, y: 0, z: 0 },
          timestamp: fallTimestamp,
          magnitude,
          rotationalMagnitude,
        };
        await this.processBackgroundConfirmedFall(userId, sensorData);
      } else {
        // Significant movement - rider likely recovered, dismiss alert
        console.log("✅ BACKGROUND FALL DISMISSED: Movement >= 25m - rider appears to have recovered");
        await this.resetBackgroundState();
        
        // Send recovery notification
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "Fall Alert Dismissed",
            body: "Rider appears to have recovered (significant movement detected)",
            sound: false,
          },
          trigger: null,
        });
      }

    } catch (error) {
      console.error("Error handling post-fall monitoring completion:", error);
      // On error, reset state to prevent stuck state
      await this.resetBackgroundState();
    }
  }

  // Calculate movement during a specific time period using stored location history
  private static async calculateMovementDuringPeriod(startTime: number, endTime: number): Promise<number> {
    try {
      const movementHistoryData = await AsyncStorage.getItem("movement_tracker_history");
      if (!movementHistoryData) {
        console.warn("No movement history available for period calculation");
        return 0;
      }

      const locationHistory = JSON.parse(movementHistoryData);
      const relevantLocations = locationHistory.filter(
        (loc: any) => loc.timestamp >= startTime && loc.timestamp <= endTime
      );

      if (relevantLocations.length < 2) {
        return 0;
      }

      // Calculate total distance
      let totalDistance = 0;
      for (let i = 1; i < relevantLocations.length; i++) {
        const point1 = relevantLocations[i - 1];
        const point2 = relevantLocations[i];
        const distance = MovementTracker.calculateDistance(point1, point2);
        totalDistance += distance;
      }

      return totalDistance;

    } catch (error) {
      console.error("Error calculating movement during period:", error);
      return 0;
    }
  }
}
