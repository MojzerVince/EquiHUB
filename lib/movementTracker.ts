import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";

export interface LocationPoint {
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy?: number;
}

export interface MovementData {
  locations: LocationPoint[];
  totalDistance: number;
  averageSpeed: number; // m/s
  isMoving: boolean;
}

export class MovementTracker {
  private static locationHistory: LocationPoint[] = [];
  private static readonly MAX_HISTORY_SIZE = 100; // Keep last 100 location points
  private static readonly MOVEMENT_STORAGE_KEY = "movement_tracker_history";
  private static isTracking = false;
  private static locationSubscription: any = null;

  /**
   * Calculate distance between two GPS coordinates using Haversine formula
   * Returns distance in meters
   */
  static calculateDistance(point1: LocationPoint, point2: LocationPoint): number {
    const R = 6371000; // Earth's radius in meters
    const lat1Rad = (point1.latitude * Math.PI) / 180;
    const lat2Rad = (point2.latitude * Math.PI) / 180;
    const deltaLat = ((point2.latitude - point1.latitude) * Math.PI) / 180;
    const deltaLng = ((point2.longitude - point1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1Rad) *
        Math.cos(lat2Rad) *
        Math.sin(deltaLng / 2) *
        Math.sin(deltaLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Add a new location point to the history
   */
  static addLocationPoint(location: LocationPoint): void {
    this.locationHistory.push(location);
    
    // Maintain history size
    if (this.locationHistory.length > this.MAX_HISTORY_SIZE) {
      this.locationHistory.shift();
    }

    // Save to persistent storage for background access
    this.saveLocationHistory();
  }

  /**
   * Get movement data for a specific time window
   * @param timeWindowMs Time window in milliseconds (e.g., 15000 for 15 seconds)
   * @param fromTimestamp Optional start timestamp, defaults to current time minus timeWindowMs
   */
  static getMovementInTimeWindow(
    timeWindowMs: number,
    fromTimestamp?: number
  ): MovementData {
    const endTime = fromTimestamp || Date.now();
    const startTime = endTime - timeWindowMs;

    // Filter locations within the time window
    const relevantLocations = this.locationHistory.filter(
      (loc) => loc.timestamp >= startTime && loc.timestamp <= endTime
    );

    if (relevantLocations.length < 2) {
      return {
        locations: relevantLocations,
        totalDistance: 0,
        averageSpeed: 0,
        isMoving: false,
      };
    }

    // Calculate total distance traveled
    let totalDistance = 0;
    for (let i = 1; i < relevantLocations.length; i++) {
      const distance = this.calculateDistance(
        relevantLocations[i - 1],
        relevantLocations[i]
      );
      totalDistance += distance;
    }

    // Calculate time duration in seconds
    const timeDurationSeconds = (endTime - startTime) / 1000;
    const averageSpeed = totalDistance / timeDurationSeconds;

    // Consider moving if average speed > 0.5 m/s (walking speed)
    const isMoving = averageSpeed > 0.5;

    return {
      locations: relevantLocations,
      totalDistance,
      averageSpeed,
      isMoving,
    };
  }

  /**
   * Check if rider was moving more than specified distance in the past timeWindow
   * @param minDistance Minimum distance in meters (e.g., 25)
   * @param timeWindowMs Time window in milliseconds (e.g., 15000)
   */
  static wasMovingDistance(minDistance: number, timeWindowMs: number): boolean {
    const movementData = this.getMovementInTimeWindow(timeWindowMs);
    return movementData.totalDistance > minDistance;
  }

  /**
   * Monitor movement for a specific duration and return the total distance moved
   * @param durationMs Duration to monitor in milliseconds
   * @returns Promise<number> Total distance moved in meters
   */
  static async monitorMovementFor(durationMs: number): Promise<number> {
    const startTime = Date.now();
    const initialLocation = await this.getCurrentLocation();
    
    if (!initialLocation) {
      console.warn("Could not get initial location for movement monitoring");
      return 0;
    }

    return new Promise((resolve) => {
      const startLocationPoint: LocationPoint = {
        ...initialLocation,
        timestamp: startTime,
      };

      // Store initial position
      this.addLocationPoint(startLocationPoint);

      const monitoringInterval = setInterval(async () => {
        const currentTime = Date.now();
        const elapsed = currentTime - startTime;

        if (elapsed >= durationMs) {
          clearInterval(monitoringInterval);
          
          // Calculate total movement in the monitoring period
          const movementData = this.getMovementInTimeWindow(durationMs, currentTime);
          console.log(`📍 Movement monitoring complete: ${movementData.totalDistance.toFixed(1)}m in ${durationMs/1000}s`);
          
          resolve(movementData.totalDistance);
          return;
        }

        // Get current location and add to history
        const currentLocation = await this.getCurrentLocation();
        if (currentLocation) {
          const locationPoint: LocationPoint = {
            ...currentLocation,
            timestamp: currentTime,
          };
          this.addLocationPoint(locationPoint);
        }
      }, 2000); // Check every 2 seconds during monitoring
    });
  }

  /**
   * Get current GPS location
   */
  static async getCurrentLocation(): Promise<LocationPoint | null> {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeInterval: 1000, // Update every second during monitoring
      });

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        timestamp: Date.now(),
        accuracy: location.coords.accuracy || undefined,
      };
    } catch (error) {
      console.error("Error getting current location:", error);
      return null;
    }
  }

  /**
   * Start continuous location tracking (for regular monitoring)
   */
  static async startLocationTracking(): Promise<boolean> {
    if (this.isTracking) {
      return true;
    }

    try {
      // Check permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        console.error("Location permission not granted");
        return false;
      }

      // Start location tracking
      this.locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000, // Update every 5 seconds
          distanceInterval: 10, // Or when moved 10 meters
        },
        (location) => {
          const locationPoint: LocationPoint = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            timestamp: Date.now(),
            accuracy: location.coords.accuracy || undefined,
          };
          
          this.addLocationPoint(locationPoint);
        }
      );

      this.isTracking = true;
      console.log("📍 Location tracking started");
      
      // Load historical data
      await this.loadLocationHistory();
      
      return true;
    } catch (error) {
      console.error("Error starting location tracking:", error);
      return false;
    }
  }

  /**
   * Stop location tracking
   */
  static async stopLocationTracking(): Promise<void> {
    if (this.locationSubscription) {
      this.locationSubscription.remove();
      this.locationSubscription = null;
    }

    this.isTracking = false;
    console.log("📍 Location tracking stopped");
  }

  /**
   * Save location history to persistent storage
   */
  private static async saveLocationHistory(): Promise<void> {
    try {
      // Only save recent history to avoid storage bloat
      const recentHistory = this.locationHistory.slice(-50); // Keep last 50 points
      await AsyncStorage.setItem(
        this.MOVEMENT_STORAGE_KEY,
        JSON.stringify(recentHistory)
      );
    } catch (error) {
      console.error("Error saving location history:", error);
    }
  }

  /**
   * Load location history from persistent storage
   */
  private static async loadLocationHistory(): Promise<void> {
    try {
      const historyString = await AsyncStorage.getItem(this.MOVEMENT_STORAGE_KEY);
      if (historyString) {
        const history = JSON.parse(historyString) as LocationPoint[];
        this.locationHistory = history.filter(
          // Only keep locations from the last hour
          (loc) => Date.now() - loc.timestamp < 3600000
        );
        console.log(`📍 Loaded ${this.locationHistory.length} location points from storage`);
      }
    } catch (error) {
      console.error("Error loading location history:", error);
      this.locationHistory = [];
    }
  }

  /**
   * Clear location history
   */
  static async clearHistory(): Promise<void> {
    this.locationHistory = [];
    try {
      await AsyncStorage.removeItem(this.MOVEMENT_STORAGE_KEY);
      console.log("📍 Location history cleared");
    } catch (error) {
      console.error("Error clearing location history:", error);
    }
  }

  /**
   * Get current location history (for debugging)
   */
  static getLocationHistory(): LocationPoint[] {
    return [...this.locationHistory];
  }

  /**
   * Check if the tracker is currently active
   */
  static isActivelyTracking(): boolean {
    return this.isTracking;
  }

  /**
   * Get the latest location point
   */
  static getLatestLocation(): LocationPoint | null {
    return this.locationHistory.length > 0
      ? this.locationHistory[this.locationHistory.length - 1]
      : null;
  }
}