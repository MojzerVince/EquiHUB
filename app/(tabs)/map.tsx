import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useTheme } from "../../contexts/ThemeContext";
import { useTracking } from "../../contexts/TrackingContext";

interface Location {
  latitude: number;
  longitude: number;
  timestamp: number;
}

interface TrackingSession {
  id: string;
  startTime: number;
  endTime?: number;
  locations: Location[];
  distance: number;
  duration: number;
}

const MapScreen = () => {
  const { currentTheme } = useTheme();
  const { saveSessions } = useTracking();
  const router = useRouter();
  const mapRef = useRef<MapView>(null);

  // State management
  const [userLocation, setUserLocation] = useState<Location | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [currentSession, setCurrentSession] = useState<TrackingSession | null>(
    null
  );
  const [route, setRoute] = useState<Location[]>([]);
  const [distance, setDistance] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState(0); // km/h
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [locationSubscription, setLocationSubscription] =
    useState<Location.LocationSubscription | null>(null);
  const [hasLocationPermission, setHasLocationPermission] = useState(false);

  // Request location permissions on mount
  useEffect(() => {
    checkLocationServices();

    // Force set a default location immediately for map rendering
    const defaultLocation: Location = {
      latitude: 47.4979,
      longitude: 19.0402,
      timestamp: Date.now(),
    };
    setUserLocation(defaultLocation);
    setHasLocationPermission(true);

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, []);

  const checkLocationServices = async () => {
    try {
      const isEnabled = await Location.hasServicesEnabledAsync();

      if (!isEnabled) {
        Alert.alert(
          "Location Services Disabled",
          "Please enable location services in your device settings to use GPS features. You can still use the map manually.",
          [
            {
              text: "Use Manual Map",
              onPress: () => {
                // Set default location and show map
                const defaultLocation: Location = {
                  latitude: 47.4979,
                  longitude: 19.0402,
                  timestamp: Date.now(),
                };
                setUserLocation(defaultLocation);
                setHasLocationPermission(true);
              },
            },
            { text: "Retry", onPress: checkLocationServices },
          ]
        );
        return;
      }
      requestLocationPermission();
    } catch (error) {
      console.error("Error checking location services:", error);
      requestLocationPermission(); // Try anyway
    }
  };

  // Update duration every second when tracking
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isTracking && sessionStartTime) {
      interval = setInterval(() => {
        setDuration(Date.now() - sessionStartTime);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTracking, sessionStartTime]);

  const requestLocationPermission = async () => {
    try {
      console.log("Requesting location permission...");

      // First request foreground permission
      const foregroundStatus =
        await Location.requestForegroundPermissionsAsync();

      console.log("Foreground permission status:", foregroundStatus.status);

      if (foregroundStatus.status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Location permission is needed to track your rides and show your position on the map.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Try Again", onPress: requestLocationPermission },
          ]
        );
        return;
      }

      setHasLocationPermission(true);
      console.log("Location permission granted, getting current position...");

      try {
        // Get initial location with high accuracy
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        console.log("Got location:", location.coords);

        const userLoc: Location = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          timestamp: Date.now(),
        };

        setUserLocation(userLoc);
        console.log("User location set:", userLoc);

        // Center map on user location with animation
        setTimeout(() => {
          if (mapRef.current) {
            console.log("Animating to user location...");
            mapRef.current.animateToRegion(
              {
                latitude: userLoc.latitude,
                longitude: userLoc.longitude,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
              },
              2000
            );
          }
        }, 1000);
      } catch (locationError) {
        console.error("Location error:", locationError);

        // Use a default location (Budapest, Hungary) if GPS fails
        const defaultLocation: Location = {
          latitude: 47.4979,
          longitude: 19.0402,
          timestamp: Date.now(),
        };

        setUserLocation(defaultLocation);
        console.log("Using default location:", defaultLocation);

        Alert.alert(
          "Location Error",
          "Could not get your exact location. Using default location. You can still use the map and tracking features.",
          [{ text: "OK" }]
        );
      }
    } catch (error) {
      console.error("Permission error:", error);

      Alert.alert(
        "Permission Error",
        "Failed to request location permission. The map will use a default location.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Retry", onPress: requestLocationPermission },
        ]
      );

      // Set default location even if permission fails
      const defaultLocation: Location = {
        latitude: 47.4979,
        longitude: 19.0402,
        timestamp: Date.now(),
      };
      setUserLocation(defaultLocation);
      setHasLocationPermission(true); // Allow map to show even without GPS
    }
  };

  const calculateDistance = (loc1: Location, loc2: Location): number => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = ((loc2.latitude - loc1.latitude) * Math.PI) / 180;
    const dLon = ((loc2.longitude - loc1.longitude) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((loc1.latitude * Math.PI) / 180) *
        Math.cos((loc2.latitude * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const calculateAverageSpeed = (
    distance: number,
    duration: number
  ): number => {
    if (duration === 0) return 0;
    const hours = duration / (1000 * 60 * 60); // Convert ms to hours
    return distance / hours; // km/h
  };

  const startTracking = async () => {
    try {
      if (!hasLocationPermission) {
        Alert.alert("Error", "Location permission is required for tracking");
        return;
      }

      if (!userLocation) {
        // Try to get current location first
        await centerOnUser();
        if (!userLocation) {
          Alert.alert("Error", "Unable to get your current location");
          return;
        }
      }

      const sessionId = Date.now().toString();
      const newSession: TrackingSession = {
        id: sessionId,
        startTime: Date.now(),
        locations: [userLocation],
        distance: 0,
        duration: 0,
      };

      setCurrentSession(newSession);
      setRoute([userLocation]);
      setDistance(0);
      setDuration(0);
      setSessionStartTime(Date.now());
      setIsTracking(true);

      // Start location tracking
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 3000, // Update every 3 seconds for better responsiveness
          distanceInterval: 5, // Update every 5 meters
        },
        (location) => {
          const newLocation: Location = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            timestamp: Date.now(),
          };

          setUserLocation(newLocation);

          // Calculate speed (location.coords.speed is in m/s, convert to km/h)
          if (location.coords.speed !== null && location.coords.speed >= 0) {
            setCurrentSpeed(location.coords.speed * 3.6); // Convert m/s to km/h
          }

          setRoute((prevRoute) => {
            const updatedRoute = [...prevRoute, newLocation];

            // Calculate total distance
            if (prevRoute.length > 0) {
              const lastLocation = prevRoute[prevRoute.length - 1];
              const additionalDistance = calculateDistance(
                lastLocation,
                newLocation
              );
              setDistance((prevDistance) => {
                const newDistance = prevDistance + additionalDistance;
                return newDistance;
              });
            }

            return updatedRoute;
          });

          setCurrentSession((prevSession) => {
            if (prevSession) {
              return {
                ...prevSession,
                locations: [...prevSession.locations, newLocation],
              };
            }
            return prevSession;
          });
        }
      );

      setLocationSubscription(subscription);
      Alert.alert(
        "Tracking Started!",
        "Your ride tracking has begun. Your route will be recorded on the map."
      );
    } catch (error) {
      Alert.alert(
        "Error",
        `Failed to start tracking: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  };

  const stopTracking = () => {
    if (locationSubscription) {
      locationSubscription.remove();
      setLocationSubscription(null);
    }

    if (currentSession && sessionStartTime) {
      const finalDuration = Date.now() - sessionStartTime;
      const finalSession: TrackingSession = {
        ...currentSession,
        endTime: Date.now(),
        distance: distance,
        duration: finalDuration,
      };

      Alert.alert(
        "Ride Completed!",
        `Distance: ${distance.toFixed(2)} km\nDuration: ${formatDuration(
          finalDuration
        )}\nAverage Speed: ${calculateAverageSpeed(
          distance,
          finalDuration
        ).toFixed(1)} km/h`,
        [
          { text: "Save Session", onPress: () => saveSession(finalSession) },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => clearSession(),
          },
        ]
      );
    }

    setIsTracking(false);
    setCurrentSession(null);
    setSessionStartTime(null);
  };

  const clearSession = () => {
    setRoute([]);
    setDistance(0);
    setDuration(0);
    setCurrentSpeed(0);
  };

  const saveSession = async (session: TrackingSession) => {
    try {
      // Generate a name for the session
      const sessionName = `Ride ${new Date(
        session.startTime
      ).toLocaleDateString()} ${new Date(
        session.startTime
      ).toLocaleTimeString()}`;
      const sessionWithName = { ...session, name: sessionName };

      await saveSessions(sessionWithName);
      Alert.alert("Success", "Ride session saved successfully!");
      clearSession();
    } catch (error) {
      console.error("Error saving session:", error);
      Alert.alert("Error", "Failed to save session");
    }
  };

  const centerOnUser = async () => {
    try {
      if (!hasLocationPermission) {
        Alert.alert(
          "Permission Required",
          "Location permission is needed to center on your position."
        );
        return;
      }

      // Get fresh location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const userLoc: Location = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        timestamp: Date.now(),
      };

      setUserLocation(userLoc);

      if (mapRef.current) {
        mapRef.current.animateToRegion(
          {
            latitude: userLoc.latitude,
            longitude: userLoc.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          },
          1000
        );
      }
    } catch (error) {
      Alert.alert(
        "Location Error",
        "Unable to get your current location. Please try again."
      );
    }
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: currentTheme.colors.primary },
      ]}
    >
      <SafeAreaView
        style={[
          styles.safeArea,
          { backgroundColor: currentTheme.colors.primary },
        ]}
      >
        <View style={styles.headerContainer}>
          <Text style={styles.header}>Map & Tracking</Text>
          <TouchableOpacity
            style={styles.historyButton}
            onPress={() => router.push("/sessions")}
          >
            <Text style={styles.historyButtonText}>📊</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <View
        style={[
          styles.mapContainer,
          { backgroundColor: currentTheme.colors.surface },
        ]}
      >
        {/* Real Map - Always show map */}
        <MapView
          provider={PROVIDER_GOOGLE}
          ref={mapRef}
          style={styles.map}
          showsUserLocation={hasLocationPermission}
          showsMyLocationButton={false}
          showsCompass={true}
          showsScale={true}
          zoomEnabled={true}
          scrollEnabled={true}
          pitchEnabled={true}
          rotateEnabled={true}
          followsUserLocation={false}
          userLocationPriority="high"
          userLocationUpdateInterval={5000}
          userLocationFastestInterval={2000}
          mapType="standard"
          initialRegion={{
            latitude: userLocation?.latitude || 47.4979,
            longitude: userLocation?.longitude || 19.0402,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          onMapReady={() => {
            console.log("Map is ready");
            if (userLocation) {
              setTimeout(() => {
                centerOnUser();
              }, 1000);
            }
          }}
          onUserLocationChange={(event) => {
            if (event.nativeEvent.coordinate) {
              const newLocation: Location = {
                latitude: event.nativeEvent.coordinate.latitude,
                longitude: event.nativeEvent.coordinate.longitude,
                timestamp: Date.now(),
              };
              setUserLocation(newLocation);
            }
          }}
        >
          {/* User location marker - manual fallback */}
          {userLocation && (
            <Marker
              coordinate={{
                latitude: userLocation.latitude,
                longitude: userLocation.longitude,
              }}
              title="Your Location"
              description="Current GPS position"
              pinColor="blue"
            />
          )}

          {/* Route polyline */}
          {route.length > 1 && (
            <Polyline
              coordinates={route.map((loc) => ({
                latitude: loc.latitude,
                longitude: loc.longitude,
              }))}
              strokeColor={currentTheme.colors.accent}
              strokeWidth={4}
              lineCap="round"
              lineJoin="round"
            />
          )}
        </MapView>

        {/* Permission overlay if needed */}
        {!hasLocationPermission && (
          <View style={styles.permissionOverlay}>
            <View
              style={[
                styles.permissionCard,
                { backgroundColor: currentTheme.colors.background },
              ]}
            >
              <Text
                style={[
                  styles.permissionTitle,
                  { color: currentTheme.colors.text },
                ]}
              >
                Location Permission
              </Text>
              <Text
                style={[
                  styles.permissionSubtext,
                  { color: currentTheme.colors.textSecondary },
                ]}
              >
                Enable location to see your position and track rides
              </Text>
              <TouchableOpacity
                style={[
                  styles.permissionButton,
                  { backgroundColor: currentTheme.colors.accent },
                ]}
                onPress={requestLocationPermission}
              >
                <Text style={styles.permissionButtonText}>Enable Location</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Control buttons */}
        <View style={styles.controlsContainer}>
          <TouchableOpacity
            style={[
              styles.centerButton,
              { backgroundColor: currentTheme.colors.background },
            ]}
            onPress={centerOnUser}
          >
            <Text
              style={[
                styles.centerButtonText,
                { color: currentTheme.colors.text },
              ]}
            >
              🎯
            </Text>
          </TouchableOpacity>
        </View>

        {/* Location status indicator */}
        {userLocation && (
          <View
            style={[
              styles.locationStatus,
              { backgroundColor: currentTheme.colors.background },
            ]}
          >
            <Text
              style={[
                styles.locationStatusText,
                { color: currentTheme.colors.text },
              ]}
            >
              📍 GPS Active - Accuracy: High
            </Text>
          </View>
        )}

        {/* Tracking stats overlay */}
        {isTracking ? (
          <View
            style={[
              styles.statsContainer,
              { backgroundColor: currentTheme.colors.background },
            ]}
          >
            <View style={styles.statRow}>
              <Text
                style={[
                  styles.statLabel,
                  { color: currentTheme.colors.textSecondary },
                ]}
              >
                Distance:
              </Text>
              <Text
                style={[styles.statValue, { color: currentTheme.colors.text }]}
              >
                {distance.toFixed(2)} km
              </Text>
            </View>
            <View style={styles.statRow}>
              <Text
                style={[
                  styles.statLabel,
                  { color: currentTheme.colors.textSecondary },
                ]}
              >
                Duration:
              </Text>
              <Text
                style={[styles.statValue, { color: currentTheme.colors.text }]}
              >
                {formatDuration(duration)}
              </Text>
            </View>
            <View style={styles.statRow}>
              <Text
                style={[
                  styles.statLabel,
                  { color: currentTheme.colors.textSecondary },
                ]}
              >
                Speed:
              </Text>
              <Text
                style={[styles.statValue, { color: currentTheme.colors.text }]}
              >
                {currentSpeed.toFixed(1)} km/h
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      {/* Action buttons */}
      <View
        style={[
          styles.actionContainer,
          { backgroundColor: currentTheme.colors.background },
        ]}
      >
        {!isTracking ? (
          <TouchableOpacity
            style={[
              styles.startButton,
              { backgroundColor: currentTheme.colors.accent },
            ]}
            onPress={startTracking}
          >
            <Text style={styles.startButtonText}>Start Tracking</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.stopButton, { backgroundColor: "#FF6B6B" }]}
            onPress={stopTracking}
          >
            <Text style={styles.stopButtonText}>Stop Tracking</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    paddingBottom: 0,
  },
  headerContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: "center",
    marginBottom: -45,
    flexDirection: "row",
    justifyContent: "center",
    position: "relative",
  },
  header: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFFFFF",
    fontFamily: "Inder",
    textAlign: "center",
    flex: 1,
  },
  historyButton: {
    position: "absolute",
    right: 20,
    padding: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  historyButtonText: {
    fontSize: 20,
  },
  mapContainer: {
    flex: 1,
    position: "relative",
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    margin: 20,
    borderRadius: 10,
    padding: 40,
  },
  mapPlaceholderText: {
    fontSize: 48,
    marginBottom: 10,
  },
  mapPlaceholderSubtext: {
    fontSize: 18,
    fontFamily: "Inder",
    marginBottom: 20,
  },
  installText: {
    fontSize: 14,
    fontFamily: "Inder",
    textAlign: "center",
    fontStyle: "italic",
  },
  permissionButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginTop: 15,
  },
  permissionButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
    fontFamily: "Inder",
  },
  map: {
    width: Dimensions.get("window").width,
    height: "100%",
  },
  controlsContainer: {
    position: "absolute",
    top: 20,
    right: 20,
    zIndex: 1,
  },
  centerButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  centerButtonText: {
    fontSize: 20,
  },
  locationStatus: {
    position: "absolute",
    bottom: 100,
    left: 20,
    right: 20,
    padding: 10,
    borderRadius: 8,
    elevation: 3,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  locationStatusText: {
    fontSize: 12,
    fontFamily: "Inder",
    textAlign: "center",
  },
  statsContainer: {
    position: "absolute",
    top: 20,
    left: 20,
    padding: 15,
    borderRadius: 10,
    elevation: 5,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    minWidth: 150,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 14,
    fontFamily: "Inder",
    fontWeight: "500",
  },
  statValue: {
    fontSize: 14,
    fontFamily: "Inder",
    fontWeight: "bold",
  },
  actionContainer: {
    padding: 20,
    paddingBottom: 30,
  },
  startButton: {
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    alignItems: "center",
    elevation: 3,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  startButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
    fontFamily: "Inder",
  },
  stopButton: {
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    alignItems: "center",
    elevation: 3,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  stopButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
    fontFamily: "Inder",
  },
  permissionOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  permissionCard: {
    padding: 24,
    borderRadius: 16,
    margin: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 12,
    textAlign: "center",
    fontFamily: "Inder",
  },
  permissionSubtext: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 22,
    fontFamily: "Inder",
  },
  skipButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 12,
    alignItems: "center",
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inder",
  },
});

export default MapScreen;
