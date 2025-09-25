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

  // GPS accuracy thresholds and adaptive parameters (more realistic values)
  private static readonly EXCELLENT_ACCURACY_THRESHOLD = 5; // meters - excellent GPS signal
  private static readonly GOOD_ACCURACY_THRESHOLD = 10; // meters - good GPS signal
  private static readonly FAIR_ACCURACY_THRESHOLD = 20; // meters - fair GPS signal
  private static readonly POOR_ACCURACY_THRESHOLD = 40; // meters - poor GPS signal
  private static readonly MIN_DISTANCE_FILTER = 3; // meters - minimum movement to consider

  /**
   * Get adaptive movement threshold based on GPS accuracy
   * @param accuracy GPS accuracy in meters
   * @param baseThreshold Base threshold (e.g., 25m)
   * @returns Adjusted threshold accounting for GPS drift
   */
  static getAdaptiveThreshold(accuracy: number | undefined, baseThreshold: number): number {
    if (!accuracy) {
      // No accuracy data - assume poor signal, increase threshold significantly
      return baseThreshold * 2.0;
    }

    if (accuracy <= this.EXCELLENT_ACCURACY_THRESHOLD) {
      // Excellent GPS signal - use base threshold
      return baseThreshold;
    } else if (accuracy <= this.GOOD_ACCURACY_THRESHOLD) {
      // Good GPS signal - slight increase
      return baseThreshold * 1.2;
    } else if (accuracy <= this.FAIR_ACCURACY_THRESHOLD) {
      // Fair GPS signal - moderate increase
      return baseThreshold * 1.6;
    } else if (accuracy <= this.POOR_ACCURACY_THRESHOLD) {
      // Poor GPS signal - significant increase
      return baseThreshold * 2.2;
    } else {
      // Very poor GPS signal - major increase
      return baseThreshold * 3.0;
    }
  }

  /**
   * Filter out GPS points with poor accuracy or likely drift
   * @param newPoint New location point to validate
   * @param previousPoint Previous location point for drift detection
   * @returns true if point should be kept, false if it should be filtered out
   */
  static isValidLocationPoint(newPoint: LocationPoint, previousPoint?: LocationPoint): boolean {
    // Filter 1: Check GPS accuracy
    if (newPoint.accuracy && newPoint.accuracy > this.POOR_ACCURACY_THRESHOLD * 2) {
      console.log(`📍 Filtering location due to very poor accuracy: ${newPoint.accuracy.toFixed(1)}m`);
      return false;
    }

    // Filter 2: Check for unrealistic movement speed (drift detection)
    if (previousPoint) {
      const distance = this.calculateDistance(previousPoint, newPoint);
      const timeDiff = (newPoint.timestamp - previousPoint.timestamp) / 1000; // seconds
      
      if (timeDiff > 0) {
        const speed = distance / timeDiff; // m/s
        const maxRealisticSpeed = 25; // 25 m/s = 90 km/h (reasonable max for equestrian activities)
        
        if (speed > maxRealisticSpeed) {
          console.log(`📍 Filtering location due to unrealistic speed: ${speed.toFixed(1)} m/s (${(speed * 3.6).toFixed(1)} km/h)`);
          return false;
        }
      }

      // Filter 3: Check for minimal movement with poor accuracy (drift)
      if (newPoint.accuracy && newPoint.accuracy > this.FAIR_ACCURACY_THRESHOLD) {
        if (distance < this.MIN_DISTANCE_FILTER) {
          console.log(`📍 Filtering location due to minimal movement with poor accuracy: ${distance.toFixed(1)}m, accuracy: ${newPoint.accuracy.toFixed(1)}m`);
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Get average GPS accuracy from recent location points
   * @param timeWindowMs Time window to consider (default: 60 seconds)
   * @returns Average accuracy in meters, or undefined if no data
   */
  static getRecentGPSAccuracy(timeWindowMs: number = 60000): number | undefined {
    const now = Date.now();
    const recentPoints = this.locationHistory.filter(
      point => (now - point.timestamp) <= timeWindowMs && point.accuracy !== undefined
    );

    console.log(`📍 GPS ACCURACY CHECK: Found ${recentPoints.length} points with accuracy data in last ${timeWindowMs/1000}s`);
    
    if (recentPoints.length === 0) {
      console.log(`📍 GPS ACCURACY: No points with accuracy data - returning undefined`);
      return undefined;
    }

    const totalAccuracy = recentPoints.reduce((sum, point) => sum + (point.accuracy || 0), 0);
    const averageAccuracy = totalAccuracy / recentPoints.length;
    
    console.log(`📍 GPS ACCURACY: Average ${averageAccuracy.toFixed(1)}m from ${recentPoints.length} points`);
    console.log(`📍 GPS ACCURACY: Individual values: [${recentPoints.map(p => p.accuracy?.toFixed(1) || 'N/A').join(', ')}]`);
    
    return averageAccuracy;
  }

  /**
   * Get GPS signal quality description
   * @param accuracy GPS accuracy in meters
   * @returns Human-readable signal quality
   */
  static getGPSSignalQuality(accuracy: number | undefined): string {
    if (!accuracy) return "Unknown";
    
    if (accuracy <= this.EXCELLENT_ACCURACY_THRESHOLD) return "Excellent";
    if (accuracy <= this.GOOD_ACCURACY_THRESHOLD) return "Good";
    if (accuracy <= this.FAIR_ACCURACY_THRESHOLD) return "Fair";
    if (accuracy <= this.POOR_ACCURACY_THRESHOLD) return "Poor";
    return "Very Poor";
  }

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
   * Add a new location point to the history with GPS drift filtering
   */
  static addLocationPoint(location: LocationPoint): void {
    // Get the previous location point for drift detection
    const previousPoint = this.locationHistory.length > 0 
      ? this.locationHistory[this.locationHistory.length - 1]
      : undefined;

    // Validate the new location point
    if (!this.isValidLocationPoint(location, previousPoint)) {
      console.log(`📍 Filtered out location point due to poor quality/drift`);
      return;
    }

    // Log GPS quality for monitoring
    const quality = this.getGPSSignalQuality(location.accuracy);
    console.log(`📍 Added location point - Accuracy: ${location.accuracy?.toFixed(1) || 'N/A'}m (${quality})`);

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
   * Uses adaptive thresholds based on GPS accuracy to account for drift
   * @param minDistance Minimum distance in meters (e.g., 25)
   * @param timeWindowMs Time window in milliseconds (e.g., 15000)
   */
  static wasMovingDistance(minDistance: number, timeWindowMs: number): boolean {
    const movementData = this.getMovementInTimeWindow(timeWindowMs);
    
    // Get average GPS accuracy for the time window
    const averageAccuracy = this.getRecentGPSAccuracy(timeWindowMs);
    
    // Calculate adaptive threshold based on GPS signal quality
    const adaptiveThreshold = this.getAdaptiveThreshold(averageAccuracy, minDistance);
    
    const signalQuality = this.getGPSSignalQuality(averageAccuracy);
    
    console.log(`📍 Movement check: ${movementData.totalDistance.toFixed(1)}m measured, ${adaptiveThreshold.toFixed(1)}m required (GPS: ${signalQuality}, accuracy: ${averageAccuracy?.toFixed(1) || 'N/A'}m)`);
    
    return movementData.totalDistance > adaptiveThreshold;
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
   * Monitor movement for a specific duration and check if it exceeds adaptive threshold
   * @param durationMs Duration to monitor in milliseconds
   * @param baseThreshold Base threshold in meters (e.g., 25)
   * @returns Promise<{distance: number, threshold: number, exceeded: boolean}>
   */
  static async monitorMovementWithAdaptiveThreshold(
    durationMs: number, 
    baseThreshold: number
  ): Promise<{distance: number, threshold: number, exceeded: boolean}> {
    const distance = await this.monitorMovementFor(durationMs);
    
    // Get average GPS accuracy during the monitoring period
    const averageAccuracy = this.getRecentGPSAccuracy(durationMs);
    const adaptiveThreshold = this.getAdaptiveThreshold(averageAccuracy, baseThreshold);
    
    const signalQuality = this.getGPSSignalQuality(averageAccuracy);
    
    console.log(`📍 Adaptive movement monitoring: ${distance.toFixed(1)}m measured vs ${adaptiveThreshold.toFixed(1)}m threshold (GPS: ${signalQuality})`);
    
    return {
      distance,
      threshold: adaptiveThreshold,
      exceeded: distance > adaptiveThreshold
    };
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

      console.log(`📍 GET LOCATION: accuracy=${location.coords.accuracy?.toFixed(1) || 'N/A'}m, lat=${location.coords.latitude.toFixed(6)}, lon=${location.coords.longitude.toFixed(6)}`);

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
          
          console.log(`📍 GPS UPDATE: accuracy=${location.coords.accuracy?.toFixed(1) || 'N/A'}m, lat=${location.coords.latitude.toFixed(6)}, lon=${location.coords.longitude.toFixed(6)}`);
          
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

  /**
   * Debug method to test GPS accuracy detection
   */
  static debugGPSAccuracy(): void {
    console.log(`📍 DEBUG GPS ACCURACY THRESHOLDS:`);
    console.log(`  Excellent: ≤${this.EXCELLENT_ACCURACY_THRESHOLD}m`);
    console.log(`  Good: ≤${this.GOOD_ACCURACY_THRESHOLD}m`);
    console.log(`  Fair: ≤${this.FAIR_ACCURACY_THRESHOLD}m`);
    console.log(`  Poor: ≤${this.POOR_ACCURACY_THRESHOLD}m`);
    console.log(`  Very Poor: >${this.POOR_ACCURACY_THRESHOLD}m`);
    console.log(`📍 Current location history: ${this.locationHistory.length} points`);
    
    const recentAccuracy = this.getRecentGPSAccuracy(60000);
    console.log(`📍 Recent GPS accuracy: ${recentAccuracy?.toFixed(1) || 'N/A'}m (${this.getGPSSignalQuality(recentAccuracy)})`);
    
    // Test different accuracy values
    const testValues = [3, 7, 12, 18, 35, 55, 100];
    console.log(`📍 Test accuracy classifications:`);
    testValues.forEach(accuracy => {
      const quality = this.getGPSSignalQuality(accuracy);
      const threshold = this.getAdaptiveThreshold(accuracy, 25);
      console.log(`  ${accuracy}m → ${quality} (threshold: ${threshold.toFixed(1)}m)`);
    });
  }
}