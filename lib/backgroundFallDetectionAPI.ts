import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { Accelerometer, Gyroscope } from "expo-sensors";
import * as TaskManager from "expo-task-manager";
import { ServerSMSAPI } from "./serverSMSAPI";

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
      };

      const { magnitude, rotationalMagnitude, timestamp } = sensorData;

      // Analyze for fall (similar logic to foreground detection but optimized for background)
      const gravityDeviation = Math.abs(magnitude - 1.0);
      const hasHighRotation = rotationalMagnitude > config.gyroscopeThreshold;

      if (gravityDeviation > config.accelerationThreshold || hasHighRotation) {
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
      // Check if we already have a pending alert to prevent multiple SMS sends
      if (state.hasPendingAlert) {
        console.log("🚫 Background fall detection: SMS already sent, skipping duplicate alert");
        return;
      }

      const timeSinceStable = sensorData.timestamp - state.lastStableTime;

      // Check if enough time has passed without recovery
      if (timeSinceStable >= config.recoveryTimeout) {
        console.log("🚨 Background fall confirmed - triggering emergency alert");

        // Set pending alert flag to prevent multiple SMS sends
        state.hasPendingAlert = true;
        await AsyncStorage.setItem("background_fall_state", JSON.stringify(state));

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

        // Reset detection state but keep pending alert flag
        state.potentialFallStartTime = null;
        state.lastStableTime = Date.now();
        // Note: hasPendingAlert remains true until manually reset
      }
    } catch (error) {
      console.error("Error handling background fall event:", error);
    }
  }

  // Send emergency alert for background fall detection
  private static async sendBackgroundFallAlert(userId: string, fallEvent: BackgroundFallEvent): Promise<void> {
    try {
      const alertMessage = `🚨 FALL DETECTED (Background) 🚨
EquiHUB: Fall during ride
Time: ${new Date(fallEvent.timestamp).toLocaleTimeString()}
Impact: ${fallEvent.accelerationMagnitude.toFixed(1)}g
Check rider safety immediately!`;

      const alertResult = await ServerSMSAPI.sendFallAlert(
        userId,
        fallEvent.accelerationMagnitude,
        fallEvent.location,
        "Background Rider" // Default name for background detections
      );

      if (alertResult.success) {
        fallEvent.alertSent = true;
        fallEvent.alertSentAt = Date.now();
        console.log(`✅ Background fall alert sent to ${alertResult.sentCount} emergency contacts`);
        
        // Send local notification to inform user about the fall detection
        await this.sendBackgroundFallNotification(fallEvent, alertResult.sentCount);
      } else {
        console.error("❌ Failed to send background fall alert:", alertResult.error);
        
        // Send notification about failed SMS sending
        await this.sendBackgroundFallNotification(fallEvent, 0, true);
      }
    } catch (error) {
      console.error("Error sending background fall alert:", error);
    }
  }

  // Send local notification for background fall detection
  private static async sendBackgroundFallNotification(
    fallEvent: BackgroundFallEvent, 
    sentCount: number, 
    isFailed: boolean = false
  ): Promise<void> {
    try {
      const title = isFailed ? "⚠️ Fall Detected - SMS Failed" : "🚨 Fall Detected";
      const body = isFailed 
        ? `Fall detected at ${new Date(fallEvent.timestamp).toLocaleTimeString()}. Failed to send SMS alerts. Please check your emergency contacts manually.`
        : `Fall detected at ${new Date(fallEvent.timestamp).toLocaleTimeString()}. Emergency SMS sent to ${sentCount} contacts.`;

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
}
