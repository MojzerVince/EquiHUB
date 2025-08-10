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
  const [currentSession, setCurrentSession] = useState<TrackingSession | null>(null);
  const [route, setRoute] = useState<Location[]>([]);
  const [distance, setDistance] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState(0); // km/h
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [locationSubscription, setLocationSubscription] = useState<Location.LocationSubscription | null>(null);
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

  // Request location permissions on mount
  useEffect(() => {
    checkLocationServices();
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
          'Location Services Disabled',
          'Please enable location services in your device settings to use GPS features. You can still use the map manually.',
          [
            { text: 'Use Manual Map', onPress: () => {
              // Set default location and show map
              const defaultLocation: Location = {
                latitude: 47.4979,
                longitude: 19.0402,
                timestamp: Date.now(),
              };
              setUserLocation(defaultLocation);
              setHasLocationPermission(true);
            }},
            { text: 'Retry', onPress: checkLocationServices },
          ]
        );
        return;
      }
      requestLocationPermission();
    } catch (error) {
      console.error('Error checking location services:', error);
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
      // First request foreground permission
      const foregroundStatus = await Location.requestForegroundPermissionsAsync();
      
      if (foregroundStatus.status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Location permission is needed to track your rides and show your position on the map.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Try Again', onPress: requestLocationPermission },
          ]
        );
        return;
      }

      setHasLocationPermission(true);

      try {
        // Get initial location with high accuracy
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        const userLoc: Location = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          timestamp: Date.now(),
        };

        setUserLocation(userLoc);
        
        // Center map on user location with animation
        setTimeout(() => {
          if (mapRef.current) {
            mapRef.current.animateToRegion({
              latitude: userLoc.latitude,
              longitude: userLoc.longitude,
              latitudeDelta: 0.005,
              longitudeDelta: 0.005,
            }, 2000);
          }
        }, 1000);

      } catch (locationError) {
        // Use a default location (Budapest, Hungary) if GPS fails
        const defaultLocation: Location = {
          latitude: 47.4979,
          longitude: 19.0402,
          timestamp: Date.now(),
        };
        
        setUserLocation(defaultLocation);
        
        Alert.alert(
          'Location Error', 
          'Could not get your exact location. Using default location. You can still use the map and tracking features.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      Alert.alert(
        'Permission Error', 
        'Failed to request location permission. The map will use a default location.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Retry', onPress: requestLocationPermission },
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
    const dLat = (loc2.latitude - loc1.latitude) * Math.PI / 180;
    const dLon = (loc2.longitude - loc1.longitude) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(loc1.latitude * Math.PI / 180) * Math.cos(loc2.latitude * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const calculateAverageSpeed = (distance: number, duration: number): number => {
    if (duration === 0) return 0;
    const hours = duration / (1000 * 60 * 60); // Convert ms to hours
    return distance / hours; // km/h
  };

  const startTracking = async () => {
    try {
      if (!hasLocationPermission) {
        Alert.alert('Error', 'Location permission is required for tracking');
        return;
      }

      if (!userLocation) {
        // Try to get current location first
        await centerOnUser();
        if (!userLocation) {
          Alert.alert('Error', 'Unable to get your current location');
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
          
          setRoute(prevRoute => {
            const updatedRoute = [...prevRoute, newLocation];
            
            // Calculate total distance
            if (prevRoute.length > 0) {
              const lastLocation = prevRoute[prevRoute.length - 1];
              const additionalDistance = calculateDistance(lastLocation, newLocation);
              setDistance(prevDistance => {
                const newDistance = prevDistance + additionalDistance;
                return newDistance;
              });
            }
            
            return updatedRoute;
          });

          setCurrentSession(prevSession => {
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
      Alert.alert('Tracking Started!', 'Your ride tracking has begun. Your route will be recorded on the map.');
    } catch (error) {
      Alert.alert('Error', `Failed to start tracking: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

      // Here you could save the session to a database
      console.log('Session completed:', finalSession);
      
      Alert.alert(
        'Ride Completed!',
        `Distance: ${distance.toFixed(2)} km\nDuration: ${formatDuration(finalDuration)}\nAverage Speed: ${calculateAverageSpeed(distance, finalDuration).toFixed(1)} km/h`,
        [
          { text: 'Save Session', onPress: () => saveSession(finalSession) },
          { text: 'Discard', style: 'destructive', onPress: () => clearSession() },
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
      const sessionName = `Ride ${new Date(session.startTime).toLocaleDateString()} ${new Date(session.startTime).toLocaleTimeString()}`;
      const sessionWithName = { ...session, name: sessionName };
      
      await saveSessions(sessionWithName);
      Alert.alert('Success', 'Ride session saved successfully!');
      clearSession();
    } catch (error) {
      console.error('Error saving session:', error);
      Alert.alert('Error', 'Failed to save session');
    }
  };

  const centerOnUser = async () => {
    try {
      if (!hasLocationPermission) {
        Alert.alert('Permission Required', 'Location permission is needed to center on your position.');
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
        mapRef.current.animateToRegion({
          latitude: userLoc.latitude,
          longitude: userLoc.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        }, 1000);
      }

      console.log('Centered on user location:', userLoc);
    } catch (error) {
      console.error('Error getting current location:', error);
      Alert.alert('Location Error', 'Unable to get your current location. Please try again.');
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
          <TouchableOpacity
            style={styles.debugButton}
            onPress={() => setShowDebug(!showDebug)}
          >
            <Text style={styles.debugButtonText}>🐛</Text>
          </TouchableOpacity>
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
        {/* Real Map */}
        {hasLocationPermission ? (
          <MapView
            provider={PROVIDER_GOOGLE}
            ref={mapRef}
            style={styles.map}
            showsUserLocation={true}
            showsMyLocationButton={true}
            showsCompass={true}
            showsScale={false}
            zoomEnabled={true}
            scrollEnabled={true}
            pitchEnabled={true}
            rotateEnabled={true}
            followsUserLocation={false}
            userLocationPriority="high"
            userLocationUpdateInterval={5000}
            userLocationFastestInterval={2000}
            onMapReady={() => {
              if (userLocation) {
                centerOnUser();
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
            region={userLocation ? {
              latitude: userLocation.latitude,
              longitude: userLocation.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            } : undefined}
            initialRegion={{
              latitude: userLocation?.latitude || 37.78825,
              longitude: userLocation?.longitude || -122.4324,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
          >
            {/* Route polyline */}
            {route.length > 1 && (
              <Polyline
                coordinates={route.map(loc => ({
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
        ) : (
          /* Fallback for no permission */
          <View
            style={[
              styles.mapPlaceholder,
              { backgroundColor: currentTheme.colors.background },
            ]}
          >
            <Text
              style={[
                styles.mapPlaceholderText,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              �
            </Text>
            <Text
              style={[
                styles.mapPlaceholderSubtext,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              Location Permission Required
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
        )}

        {/* Control buttons */}
        {hasLocationPermission && (
          <View style={styles.controlsContainer}>
            <TouchableOpacity
              style={[
                styles.centerButton,
                { backgroundColor: currentTheme.colors.background }
              ]}
              onPress={centerOnUser}
            >
              <Text style={[styles.centerButtonText, { color: currentTheme.colors.text }]}>
                🎯
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Debug panel */}
        {showDebug && (
          <View style={[
            styles.debugPanel,
            { backgroundColor: currentTheme.colors.background }
          ]}>
            <Text style={[styles.debugTitle, { color: currentTheme.colors.text }]}>
              Debug Info
            </Text>
            <Text style={[styles.debugText, { color: currentTheme.colors.textSecondary }]}>
              Permission: {hasLocationPermission ? '✅' : '❌'}
            </Text>
            <Text style={[styles.debugText, { color: currentTheme.colors.textSecondary }]}>
              User Location: {userLocation ? '✅' : '❌'}
            </Text>
            <Text style={[styles.debugText, { color: currentTheme.colors.textSecondary }]}>
              Tracking: {isTracking ? '✅' : '❌'}
            </Text>
            <Text style={[styles.debugText, { color: currentTheme.colors.textSecondary }]}>
              Route Points: {route.length}
            </Text>
            {userLocation && (
              <Text style={[styles.debugText, { color: currentTheme.colors.textSecondary }]}>
                Lat: {userLocation.latitude.toFixed(6)}
              </Text>
            )}
            {userLocation && (
              <Text style={[styles.debugText, { color: currentTheme.colors.textSecondary }]}>
                Lng: {userLocation.longitude.toFixed(6)}
              </Text>
            )}
            <TouchableOpacity
              style={[styles.debugRefreshButton, { backgroundColor: currentTheme.colors.accent }]}
              onPress={centerOnUser}
            >
              <Text style={styles.debugRefreshText}>Refresh Location</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Location status indicator */}
        {userLocation && !showDebug && (
          <View style={[
            styles.locationStatus,
            { backgroundColor: currentTheme.colors.background }
          ]}>
            <Text style={[styles.locationStatusText, { color: currentTheme.colors.text }]}>
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
  debugButton: {
    position: "absolute",
    left: 20,
    padding: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  debugButtonText: {
    fontSize: 18,
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
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
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
    position: 'absolute',
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
    textAlign: 'center',
  },
  debugPanel: {
    position: 'absolute',
    top: 80,
    left: 20,
    right: 20,
    padding: 15,
    borderRadius: 10,
    elevation: 5,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    zIndex: 10,
  },
  debugTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: "Inder",
    marginBottom: 10,
    textAlign: 'center',
  },
  debugText: {
    fontSize: 12,
    fontFamily: "Inder",
    marginBottom: 3,
  },
  debugRefreshButton: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 15,
    alignItems: 'center',
  },
  debugRefreshText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: "Inder",
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
});

export default MapScreen;
