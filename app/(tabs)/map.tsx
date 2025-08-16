import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, {
  PROVIDER_GOOGLE,
  Polyline,
  Region,
} from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import { useDialog } from "../../contexts/DialogContext";
import { useTheme } from "../../contexts/ThemeContext";
import { HorseAPI } from "../../lib/horseAPI";
import { Horse } from "../../lib/supabase";

// Types for tracking sessions
interface TrackingPoint {
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy?: number;
  speed?: number;
}

interface TrainingSession {
  id: string;
  userId: string;
  horseId: string;
  horseName: string;
  trainingType: string;
  startTime: number;
  endTime?: number;
  duration?: number; // in seconds
  distance?: number; // in meters
  path: TrackingPoint[];
  averageSpeed?: number; // in m/s
  maxSpeed?: number; // in m/s
}

const MapScreen = () => {
  const { currentTheme } = useTheme();
  const { showError } = useDialog();
  const { user } = useAuth();
  const router = useRouter();
  const [region, setRegion] = useState<Region>({
    latitude: 37.78825,
    longitude: -122.4324,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [locationPermission, setLocationPermission] = useState<boolean | null>(
    null
  );
  const [mapType, setMapType] = useState<"standard" | "satellite">("standard");
  const [gpsStrength, setGpsStrength] = useState<number>(0); // 0-5 scale
  const [selectedHorse, setSelectedHorse] = useState<string>("");
  const [selectedTrainingType, setSelectedTrainingType] = useState<string>("");
  const [userHorses, setUserHorses] = useState<Horse[]>([]);
  const [horsesLoading, setHorsesLoading] = useState<boolean>(false);
  const [favoriteTrainingTypes, setFavoriteTrainingTypes] = useState<string[]>(
    []
  );
  const [trainingDropdownVisible, setTrainingDropdownVisible] =
    useState<boolean>(false);

  // Tracking state
  const [isTracking, setIsTracking] = useState<boolean>(false);
  const [currentSession, setCurrentSession] = useState<TrainingSession | null>(
    null
  );
  const [trackingPoints, setTrackingPoints] = useState<TrackingPoint[]>([]);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  const trackingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );
  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(
    null
  );

  useEffect(() => {
    requestLocationPermission();
  }, []);

  // Load user's horses
  useEffect(() => {
    const loadUserHorses = async () => {
      if (user?.id) {
        setHorsesLoading(true);
        try {
          const horses = await HorseAPI.getHorses(user.id);
          setUserHorses(horses || []);
        } catch (error) {
          console.error("Error loading user horses:", error);
          showError("Failed to load your horses");
        } finally {
          setHorsesLoading(false);
        }
      }
    };

    loadUserHorses();
  }, [user]);

  // Load favorite training types from storage
  useEffect(() => {
    const loadFavorites = async () => {
      try {
        const savedFavorites = await AsyncStorage.getItem(
          "favorite_training_types"
        );
        if (savedFavorites) {
          setFavoriteTrainingTypes(JSON.parse(savedFavorites));
        }
      } catch (error) {
        console.error("Error loading favorite training types:", error);
      }
    };
    loadFavorites();
  }, []);

  // Save favorite training types to storage
  const saveFavoritesToStorage = async (favorites: string[]) => {
    try {
      await AsyncStorage.setItem(
        "favorite_training_types",
        JSON.stringify(favorites)
      );
    } catch (error) {
      console.error("Error saving favorite training types:", error);
    }
  };

  // GPS monitoring effect
  useEffect(() => {
    let gpsMonitoringInterval: ReturnType<typeof setInterval>;

    const startGpsMonitoring = () => {
      if (locationPermission) {
        gpsMonitoringInterval = setInterval(async () => {
          try {
            const location = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.High,
            });

            const { accuracy } = location.coords;

            // Calculate GPS strength based on accuracy
            const strength = calculateGpsStrength(accuracy);
            setGpsStrength(strength);
          } catch (error) {
            console.log("GPS monitoring error:", error);
            setGpsStrength(0);
          }
        }, 3000); // Update every 3 seconds
      }
    };

    if (locationPermission && userLocation) {
      startGpsMonitoring();
    }

    return () => {
      if (gpsMonitoringInterval) {
        clearInterval(gpsMonitoringInterval);
      }
    };
  }, [locationPermission, userLocation]);

  // Real-time timer update for tracking
  useEffect(() => {
    let timerInterval: ReturnType<typeof setInterval>;

    if (isTracking && sessionStartTime) {
      timerInterval = setInterval(() => {
        setCurrentTime(Date.now());
      }, 1000);
    }

    return () => {
      if (timerInterval) {
        clearInterval(timerInterval);
      }
    };
  }, [isTracking, sessionStartTime]);

  // Cleanup GPS monitoring when component unmounts
  useEffect(() => {
    return () => {
      setGpsStrength(0);

      // Cleanup tracking subscription
      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove();
      }

      // Cleanup tracking interval
      if (trackingIntervalRef.current) {
        clearInterval(trackingIntervalRef.current);
      }
    };
  }, []);

  // Sample data - these could come from API or context in real app
  const trainingTypes = [
    { id: "dressage", name: "Dressage" },
    { id: "jumping", name: "Show Jumping" },
    { id: "trail", name: "Trail Riding" },
    { id: "endurance", name: "Endurance" },
    { id: "western", name: "Western" },
    { id: "leisure", name: "Leisure Ride" },
    { id: "groundwork", name: "Groundwork" },
    { id: "liberty", name: "Liberty Training" },
    { id: "endurance_riding", name: "Endurance Riding" },
    { id: "show_jumping", name: "Show Jumping" },
  ];

  // Helper function to calculate GPS strength
  const calculateGpsStrength = (accuracy: number | null): number => {
    if (!accuracy) return 0;
    if (accuracy <= 5) return 5;
    if (accuracy <= 10) return 4;
    if (accuracy <= 20) return 3;
    if (accuracy <= 50) return 2;
    if (accuracy <= 100) return 1;
    return 0;
  };

  // Calculate distance between two points using Haversine formula
  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Calculate total distance from tracking points
  const calculateTotalDistance = (points: TrackingPoint[]): number => {
    if (points.length < 2) return 0;
    let totalDistance = 0;
    for (let i = 1; i < points.length; i++) {
      totalDistance += calculateDistance(
        points[i - 1].latitude,
        points[i - 1].longitude,
        points[i].latitude,
        points[i].longitude
      );
    }
    return totalDistance;
  };

  // Save session to AsyncStorage
  const saveSessionToStorage = async (session: TrainingSession) => {
    try {
      const existingSessions = await AsyncStorage.getItem("training_sessions");
      const sessions: TrainingSession[] = existingSessions
        ? JSON.parse(existingSessions)
        : [];

      sessions.push(session);
      await AsyncStorage.setItem("training_sessions", JSON.stringify(sessions));

      console.log("Session saved successfully:", session.id);
    } catch (error) {
      console.error("Error saving session:", error);
      throw error;
    }
  };

  const requestLocationPermission = async () => {
    try {
      setLoading(true);
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationPermission(false);
        showError(
          "Location permission is required to show your position on the map."
        );
        return;
      }
      setLocationPermission(true);
      getCurrentLocation();
    } catch (error) {
      console.warn("Error requesting location permission:", error);
      showError("Failed to request location permission");
      setLocationPermission(false);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentLocation = async () => {
    try {
      setLoading(true);
      let location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const { latitude, longitude, accuracy } = location.coords;

      // Calculate GPS strength based on accuracy (lower accuracy = better signal)
      const strength = calculateGpsStrength(accuracy);
      setGpsStrength(strength);

      const newRegion = {
        latitude,
        longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      setRegion(newRegion);
      setUserLocation({ latitude, longitude });
    } catch (error) {
      console.log("Error getting location:", error);
      showError("Unable to get your location");
      setGpsStrength(0);
    } finally {
      setLoading(false);
    }
  };

  const onRegionChange = (newRegion: Region) => {
    setRegion(newRegion);
  };

  const toggleMapType = () => {
    setMapType(mapType === "standard" ? "satellite" : "standard");
  };

  const centerToCurrentLocation = () => {
    if (userLocation) {
      const newRegion = {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      setRegion(newRegion);
    } else {
      getCurrentLocation();
    }
  };

  const renderGpsStrengthBar = () => {
    const bars = [];
    for (let i = 1; i <= 5; i++) {
      bars.push(
        <View
          key={i}
          style={[
            styles.gpsBar,
            {
              backgroundColor:
                i <= gpsStrength ? "#4CAF50" : "rgba(255,255,255,0.3)",
              height: 4 + i * 2, // Progressive height
            },
          ]}
        />
      );
    }
    return (
      <View style={styles.gpsContainer}>
        <View style={styles.gpsStrengthBars}>{bars}</View>
        <Text style={styles.gpsText}>GPS</Text>
      </View>
    );
  };

  // Start GPS tracking
  const startTracking = async () => {
    console.log("🚀 Starting tracking function called");
    console.log("Horses loading:", horsesLoading);
    console.log("User horses:", userHorses.length);
    console.log("Selected horse:", selectedHorse);
    console.log("Selected training type:", selectedTrainingType);
    console.log("User location:", userLocation);
    
    if (horsesLoading) {
      showError("Please wait for horses to load");
      return;
    }
    if (userHorses.length === 0) {
      showError("No horses available. Please add horses in your profile first");
      return;
    }
    if (!selectedHorse) {
      showError("Please select a horse before starting tracking");
      return;
    }
    if (!selectedTrainingType) {
      showError("Please select a training type before starting tracking");
      return;
    }
    if (!userLocation) {
      showError("Location not available. Please wait for GPS signal");
      return;
    }

    try {
      // For now, let's skip background permissions and just use foreground tracking
      console.log("🔐 Using foreground location tracking...");
      
      console.log("✅ Starting session creation...");

      const selectedHorseData = userHorses.find((h) => h.id === selectedHorse);
      const selectedTrainingData = trainingTypes.find(
        (t) => t.id === selectedTrainingType
      );

      const sessionId = `session_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      const startTime = Date.now();

      const newSession: TrainingSession = {
        id: sessionId,
        userId: user?.id || "",
        horseId: selectedHorse,
        horseName: selectedHorseData?.name || "Unknown Horse",
        trainingType: selectedTrainingData?.name || "Unknown Training",
        startTime,
        path: [],
      };

      setCurrentSession(newSession);
      setIsTracking(true);
      setSessionStartTime(startTime);
      setTrackingPoints([]);

      // Start location tracking
      console.log("📍 Starting location tracking subscription...");
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 1000, // Update every 1 second for testing
          distanceInterval: 1, // Update every 1 meter for testing
        },
        (location) => {
          console.log("📍 New GPS location received:", {
            lat: location.coords.latitude,
            lng: location.coords.longitude,
            accuracy: location.coords.accuracy,
            timestamp: new Date().toISOString()
          });
          
          const point: TrackingPoint = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            timestamp: Date.now(),
            accuracy: location.coords.accuracy || undefined,
            speed: location.coords.speed || undefined,
          };

          setTrackingPoints((prev) => {
            const newPoints = [...prev, point];
            console.log("📊 Total tracking points:", newPoints.length);
            return newPoints;
          });

          // Update current location
          setUserLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });

          // Update GPS strength
          const strength = calculateGpsStrength(location.coords.accuracy);
          setGpsStrength(strength);
        }
      );

      console.log("✅ Location tracking subscription created successfully");

      locationSubscriptionRef.current = subscription;
    } catch (error) {
      console.error("Error starting tracking:", error);
      showError("Failed to start tracking. Please try again.");
    }
  };

  // Stop GPS tracking and save session
  const stopTracking = async () => {
    if (!isTracking || !currentSession || !sessionStartTime) {
      return;
    }

    try {
      // Stop location subscription
      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove();
        locationSubscriptionRef.current = null;
      }

      const endTime = Date.now();
      const duration = Math.floor((endTime - sessionStartTime) / 1000); // Duration in seconds
      const totalDistance = calculateTotalDistance(trackingPoints);

      // Calculate speed statistics
      const speeds = trackingPoints
        .map((point) => point.speed)
        .filter((speed) => speed !== undefined && speed > 0) as number[];

      const averageSpeed =
        speeds.length > 0
          ? speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length
          : 0;

      const maxSpeed = speeds.length > 0 ? Math.max(...speeds) : 0;

      const completedSession: TrainingSession = {
        ...currentSession,
        endTime,
        duration,
        distance: totalDistance,
        path: trackingPoints,
        averageSpeed,
        maxSpeed,
      };

      // Save session to storage
      await saveSessionToStorage(completedSession);

      // Save current session for summary page
      await AsyncStorage.setItem(
        "current_session_summary",
        JSON.stringify(completedSession)
      );

      // Reset tracking state
      setIsTracking(false);
      setCurrentSession(null);
      setSessionStartTime(null);
      setTrackingPoints([]);

      // Show completion alert
      Alert.alert(
        "Session Completed",
        `Training session completed!\n\nDuration: ${Math.floor(
          duration / 60
        )}m ${duration % 60}s\nDistance: ${(totalDistance / 1000).toFixed(
          2
        )} km\nAverage Speed: ${(averageSpeed * 3.6).toFixed(1)} km/h`,
        [
          {
            text: "View Summary",
            onPress: () => router.push("/session-summary"),
          },
          {
            text: "Back to Map",
          },
        ]
      );
    } catch (error) {
      console.error("Error stopping tracking:", error);
      showError("Failed to save session. Please try again.");
    }
  };

  // Toggle favorite training type
  const toggleFavoriteTraining = (trainingId: string) => {
    setFavoriteTrainingTypes((prev) => {
      const newFavorites = prev.includes(trainingId)
        ? prev.filter((id) => id !== trainingId)
        : [...prev, trainingId];

      // Save to storage
      saveFavoritesToStorage(newFavorites);

      return newFavorites;
    });
  };

  // Sort training types with favorites first
  const getSortedTrainingTypes = () => {
    return [...trainingTypes].sort((a, b) => {
      const aIsFavorite = favoriteTrainingTypes.includes(a.id);
      const bIsFavorite = favoriteTrainingTypes.includes(b.id);

      if (aIsFavorite && !bIsFavorite) return -1;
      if (!aIsFavorite && bIsFavorite) return 1;
      return 0;
    });
  };

  if (loading && !userLocation) {
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
            <Text style={styles.header}>Map</Text>
            <TouchableOpacity
              style={styles.historyButton}
              onPress={() => router.push("/sessions")}
            >
              <Text style={styles.historyButtonText}>📜</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
        <View
          style={[
            styles.viewPort,
            { backgroundColor: currentTheme.colors.background },
          ]}
        >
          <View style={styles.loadingContainer}>
            <ActivityIndicator
              size="large"
              color={currentTheme.colors.primary}
            />
            <Text
              style={[styles.loadingText, { color: currentTheme.colors.text }]}
            >
              Getting your location...
            </Text>
          </View>
        </View>
      </View>
    );
  }

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
          <Text style={styles.header}>Map</Text>
          <TouchableOpacity
            style={styles.historyButton}
            onPress={() => router.push("/sessions")}
          >
            <Text style={styles.historyButtonText}>📜</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <View
        style={[
          styles.viewPort,
          { backgroundColor: currentTheme.colors.surface },
        ]}
      >
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.mapContainer}>
            {locationPermission === false && (
              <View style={styles.permissionContainer}>
                <Text style={styles.permissionEmoji}>🔒</Text>
                <Text
                  style={[
                    styles.permissionText,
                    { color: currentTheme.colors.text },
                  ]}
                >
                  Location Permission Required
                </Text>
                <Text
                  style={[
                    styles.permissionSubtext,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  Allow location access to see your position and nearby
                  equestrian facilities.
                </Text>
                <TouchableOpacity
                  style={[
                    styles.permissionButton,
                    {
                      backgroundColor: currentTheme.colors.primary,
                      borderColor: currentTheme.colors.border,
                    },
                  ]}
                  onPress={requestLocationPermission}
                >
                  <Text
                    style={[styles.permissionButtonText, { color: "#FFFFFF" }]}
                  >
                    Grant Permission
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.mapViewContainer}>
              {renderGpsStrengthBar()}

              {/* Map control buttons */}
              <View style={styles.mapControlsContainer}>
                <TouchableOpacity
                  style={styles.mapControlButton}
                  onPress={toggleMapType}
                  activeOpacity={0.7}
                >
                  <Text style={styles.mapControlButtonText}>
                    {mapType === "standard" ? "🛰️" : "🗺️"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.mapControlButton, { marginTop: 10 }]}
                  onPress={centerToCurrentLocation}
                  activeOpacity={0.7}
                >
                  <Text style={styles.mapControlButtonText}>📍</Text>
                </TouchableOpacity>
              </View>

              {/* Coordinates display box */}
              {userLocation && (
                <View style={styles.coordinatesBox}>
                  <Text style={styles.coordinatesBoxText}>
                    {userLocation.latitude.toFixed(4)}°
                  </Text>
                  <Text style={styles.coordinatesBoxText}>
                    {userLocation.longitude.toFixed(4)}°
                  </Text>
                </View>
              )}

              <MapView
                style={styles.map}
                provider={PROVIDER_GOOGLE}
                region={region}
                onRegionChangeComplete={onRegionChange}
                showsUserLocation={true}
                showsMyLocationButton={false}
                followsUserLocation={false}
                showsCompass={true}
                showsScale={true}
                zoomEnabled={true}
                scrollEnabled={true}
                pitchEnabled={true}
                rotateEnabled={true}
                mapType={mapType}
              >
                {/* Show tracking path */}
                {trackingPoints.length > 1 && (
                  <Polyline
                    coordinates={trackingPoints.map((point) => ({
                      latitude: point.latitude,
                      longitude: point.longitude,
                    }))}
                    strokeColor={currentTheme.colors.primary}
                    strokeWidth={4}
                  />
                )}
              </MapView>
            </View>

            <View style={styles.trackingControls}>
              {/* Horse Selection - Hidden during tracking */}
              {!isTracking && (
                <View style={styles.selectionContainer}>
                  <Text
                    style={[
                      styles.selectionTitle,
                      { color: currentTheme.colors.text },
                    ]}
                  >
                    Select Horse
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.horizontalScroll}
                  >
                    {horsesLoading ? (
                      <View
                        style={[
                          styles.selectionCard,
                          {
                            backgroundColor: currentTheme.colors.background,
                            borderColor: currentTheme.colors.border,
                          },
                        ]}
                      >
                        <ActivityIndicator
                          size="small"
                          color={currentTheme.colors.primary}
                        />
                        <Text
                          style={[
                            styles.selectionCardSubtitle,
                            { color: currentTheme.colors.textSecondary },
                          ]}
                        >
                          Loading horses...
                        </Text>
                      </View>
                    ) : userHorses.length === 0 ? (
                      <View
                        style={[
                          styles.selectionCard,
                          {
                            backgroundColor: currentTheme.colors.background,
                            borderColor: currentTheme.colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.selectionCardTitle,
                            { color: currentTheme.colors.text },
                          ]}
                        >
                          No horses found
                        </Text>
                        <Text
                          style={[
                            styles.selectionCardSubtitle,
                            { color: currentTheme.colors.textSecondary },
                          ]}
                        >
                          Add horses in your profile
                        </Text>
                      </View>
                    ) : (
                      userHorses.map((horse) => (
                        <TouchableOpacity
                          key={horse.id}
                          style={[
                            styles.selectionCard,
                            {
                              backgroundColor:
                                selectedHorse === horse.id
                                  ? currentTheme.colors.primary
                                  : currentTheme.colors.background,
                              borderColor:
                                selectedHorse === horse.id
                                  ? currentTheme.colors.primary
                                  : currentTheme.colors.border,
                            },
                          ]}
                          onPress={() => setSelectedHorse(horse.id)}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.selectionCardTitle,
                              {
                                color:
                                  selectedHorse === horse.id
                                    ? "#FFFFFF"
                                    : currentTheme.colors.text,
                              },
                            ]}
                          >
                            {horse.name}
                          </Text>
                          <Text
                            style={[
                              styles.selectionCardSubtitle,
                              {
                                color:
                                  selectedHorse === horse.id
                                    ? "rgba(255,255,255,0.8)"
                                    : currentTheme.colors.textSecondary,
                              },
                            ]}
                          >
                            {horse.breed}
                          </Text>
                        </TouchableOpacity>
                      ))
                    )}
                  </ScrollView>
                </View>
              )}

              {/* Training Type Selection - Hidden during tracking */}
              {!isTracking && (
                <View style={styles.selectionContainer}>
                  <Text
                    style={[
                      styles.selectionTitle,
                      { color: currentTheme.colors.text },
                    ]}
                  >
                    Training Type
                  </Text>

                  {/* Training Dropdown */}
                  <TouchableOpacity
                    style={[
                      styles.trainingDropdown,
                      {
                        backgroundColor: currentTheme.colors.background,
                        borderColor: currentTheme.colors.border,
                      },
                    ]}
                    onPress={() =>
                      setTrainingDropdownVisible(!trainingDropdownVisible)
                    }
                    activeOpacity={0.7}
                  >
                    <View style={styles.trainingDropdownContent}>
                      {selectedTrainingType ? (
                        <View style={styles.selectedTrainingContent}>
                          <Text
                            style={[
                              styles.selectedTrainingText,
                              { color: currentTheme.colors.text },
                            ]}
                          >
                            {
                              trainingTypes.find(
                                (t) => t.id === selectedTrainingType
                              )?.name
                            }
                          </Text>
                        </View>
                      ) : (
                        <Text
                          style={[
                            styles.placeholderText,
                            { color: currentTheme.colors.textSecondary },
                          ]}
                        >
                          Select training type
                        </Text>
                      )}
                    </View>
                    <Text
                      style={[
                        styles.dropdownArrow,
                        { color: currentTheme.colors.text },
                      ]}
                    >
                      {trainingDropdownVisible ? "▲" : "▼"}
                    </Text>
                  </TouchableOpacity>

                  {/* Training Dropdown List */}
                  {trainingDropdownVisible && (
                    <Modal
                      transparent={true}
                      visible={trainingDropdownVisible}
                      animationType="fade"
                      onRequestClose={() => setTrainingDropdownVisible(false)}
                    >
                      <TouchableOpacity
                        style={{
                          flex: 1,
                          backgroundColor: "rgba(0, 0, 0, 0.3)",
                        }}
                        onPress={() => setTrainingDropdownVisible(false)}
                        activeOpacity={1}
                      >
                        <View
                          style={{
                            position: "absolute",
                            top: 400, // Adjust this value based on dropdown position
                            left: 20,
                            right: 20,
                          }}
                        >
                          <View
                            style={[
                              styles.trainingDropdownList,
                              {
                                backgroundColor: currentTheme.colors.background,
                                borderColor: currentTheme.colors.border,
                              },
                            ]}
                          >
                            <ScrollView
                              style={{ maxHeight: 250 }}
                              showsVerticalScrollIndicator={false}
                            >
                              {getSortedTrainingTypes().map(
                                (training, index) => {
                                  const isFirstNonFavorite =
                                    favoriteTrainingTypes.length > 0 &&
                                    index === favoriteTrainingTypes.length &&
                                    !favoriteTrainingTypes.includes(
                                      training.id
                                    );

                                  return (
                                    <View key={training.id}>
                                      {isFirstNonFavorite && (
                                        <View style={styles.favoritesSeparator}>
                                          <Text
                                            style={[
                                              styles.separatorText,
                                              {
                                                color:
                                                  currentTheme.colors
                                                    .textSecondary,
                                              },
                                            ]}
                                          >
                                            Other Training Types
                                          </Text>
                                        </View>
                                      )}
                                      <TouchableOpacity
                                        style={[
                                          styles.trainingDropdownItem,
                                          {
                                            backgroundColor:
                                              selectedTrainingType ===
                                              training.id
                                                ? currentTheme.colors.primary +
                                                  "20"
                                                : "transparent",
                                          },
                                        ]}
                                        onPress={() => {
                                          setSelectedTrainingType(training.id);
                                          setTrainingDropdownVisible(false);
                                        }}
                                        activeOpacity={0.7}
                                      >
                                        <View
                                          style={styles.trainingItemContent}
                                        >
                                          <Text
                                            style={[
                                              styles.trainingItemText,
                                              {
                                                color:
                                                  selectedTrainingType ===
                                                  training.id
                                                    ? currentTheme.colors
                                                        .primary
                                                    : currentTheme.colors.text,
                                                fontWeight:
                                                  selectedTrainingType ===
                                                  training.id
                                                    ? "600"
                                                    : "normal",
                                              },
                                            ]}
                                          >
                                            {training.name}
                                          </Text>
                                        </View>
                                        <TouchableOpacity
                                          style={styles.favoriteButton}
                                          onPress={(e) => {
                                            e.stopPropagation();
                                            toggleFavoriteTraining(training.id);
                                          }}
                                          hitSlop={{
                                            top: 10,
                                            bottom: 10,
                                            left: 10,
                                            right: 10,
                                          }}
                                        >
                                          <Text style={styles.favoriteIcon}>
                                            {favoriteTrainingTypes.includes(
                                              training.id
                                            )
                                              ? "★"
                                              : "☆"}
                                          </Text>
                                        </TouchableOpacity>
                                      </TouchableOpacity>
                                    </View>
                                  );
                                }
                              )}
                            </ScrollView>
                          </View>
                        </View>
                      </TouchableOpacity>
                    </Modal>
                  )}
                </View>
              )}

              {/* Start/Stop Tracking Button */}
              <TouchableOpacity
                style={[
                  styles.startTrackingButton,
                  {
                    backgroundColor: isTracking
                      ? "#DC3545" // Red color for stop
                      : selectedHorse &&
                        selectedTrainingType &&
                        userLocation &&
                        !horsesLoading &&
                        userHorses.length > 0
                      ? currentTheme.colors.primary
                      : currentTheme.colors.border,
                  },
                ]}
                onPress={isTracking ? stopTracking : startTracking}
                disabled={
                  !isTracking &&
                  (!selectedHorse ||
                    !selectedTrainingType ||
                    !userLocation ||
                    horsesLoading ||
                    userHorses.length === 0)
                }
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.startTrackingButtonText,
                    {
                      color: isTracking
                        ? "#FFFFFF"
                        : selectedHorse && selectedTrainingType && userLocation
                        ? "#FFFFFF"
                        : currentTheme.colors.textSecondary,
                    },
                  ]}
                >
                  {isTracking ? "Stop Tracking" : "Start Tracking"}
                </Text>
              </TouchableOpacity>

              {/* Tracking Status Display */}
              {isTracking && sessionStartTime && (
                <View
                  style={[
                    styles.trackingStatusContainer,
                    { backgroundColor: currentTheme.colors.surface },
                  ]}
                >
                  <View style={styles.trackingStatusHeader}>
                    <View style={styles.recordingIndicator}>
                      <View style={styles.recordingDot} />
                      <Text
                        style={[styles.recordingText, { color: "#DC3545" }]}
                      >
                        RECORDING
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.trackingTimer,
                        { color: currentTheme.colors.primary },
                      ]}
                    >
                      {Math.floor((currentTime - sessionStartTime) / 60000)}:
                      {String(
                        Math.floor(
                          ((currentTime - sessionStartTime) % 60000) / 1000
                        )
                      ).padStart(2, "0")}
                    </Text>
                  </View>

                  <View style={styles.trackingStats}>
                    <View style={styles.trackingStatItem}>
                      <Text
                        style={[
                          styles.trackingStatLabel,
                          { color: currentTheme.colors.textSecondary },
                        ]}
                      >
                        Distance
                      </Text>
                      <Text
                        style={[
                          styles.trackingStatValue,
                          { color: currentTheme.colors.text },
                        ]}
                      >
                        {(
                          calculateTotalDistance(trackingPoints) / 1000
                        ).toFixed(2)}{" "}
                        km
                      </Text>
                    </View>
                    <View style={styles.trackingStatItem}>
                      <Text
                        style={[
                          styles.trackingStatLabel,
                          { color: currentTheme.colors.textSecondary },
                        ]}
                      >
                        Points
                      </Text>
                      <Text
                        style={[
                          styles.trackingStatValue,
                          { color: currentTheme.colors.text },
                        ]}
                      >
                        {trackingPoints.length}
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      </View>

      {/* Loading overlay */}
      {loading && userLocation && (
        <View style={styles.loadingOverlay}>
          <View
            style={[
              styles.loadingModal,
              { backgroundColor: currentTheme.colors.surface },
            ]}
          >
            <ActivityIndicator
              size="large"
              color={currentTheme.colors.primary}
            />
            <Text
              style={[
                styles.loadingModalText,
                { color: currentTheme.colors.text },
              ]}
            >
              Updating location...
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#335C67",
  },
  safeArea: {
    backgroundColor: "#335C67",
  },
  content: {
    flex: 1,
  },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    marginBottom: -33,
  },
  header: {
    fontSize: 30,
    fontFamily: "Inder",
    color: "#fff",
    textAlign: "center",
    flex: 1,
    fontWeight: "600",
  },
  viewPort: {
    backgroundColor: "#FFFFFF",
    flex: 1,
    borderTopLeftRadius: 50,
    borderTopRightRadius: 50,
    marginTop: 5,
    paddingTop: 20,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 30,
  },
  mapContainer: {
    flex: 1,
    paddingHorizontal: 20,
    marginTop: 5,
  },
  mapViewContainer: {
    height: 400,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 0,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 8,
  },
  map: {
    flex: 1,
  },
  mapInfo: {
    marginTop: 10,
  },
  infoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  coordinatesContainer: {
    marginTop: 10,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
  coordinatesLabel: {
    fontSize: 12,
    fontFamily: "Inder",
    marginBottom: 5,
  },
  coordinatesText: {
    fontSize: 14,
    fontFamily: "Inder",
    fontWeight: "500",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  loadingText: {
    fontSize: 16,
    fontFamily: "Inder",
    marginTop: 15,
    textAlign: "center",
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingModal: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 30,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
  loadingModalText: {
    fontSize: 16,
    fontFamily: "Inder",
    marginTop: 15,
    textAlign: "center",
  },
  permissionContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 30,
    alignItems: "center",
    marginVertical: 20,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  permissionEmoji: {
    fontSize: 48,
    marginBottom: 15,
  },
  permissionText: {
    fontSize: 20,
    fontFamily: "Inder",
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 10,
  },
  permissionSubtext: {
    fontSize: 14,
    fontFamily: "Inder",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 25,
  },
  permissionButton: {
    backgroundColor: "#335C67",
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#4A9BB7",
  },
  permissionButtonText: {
    fontSize: 16,
    fontFamily: "Inder",
    fontWeight: "600",
    textAlign: "center",
  },
  historyButton: {
    position: "absolute",
    right: 20,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    width: 40,
    height: 40,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 20,
  },
  historyButtonText: {
    fontSize: 20,
    color: "#FFFFFF",
  },
  gpsContainer: {
    position: "absolute",
    top: 10,
    left: "50%",
    marginLeft: -25,
    zIndex: 10,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: 8,
    padding: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  gpsStrengthBars: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginRight: 6,
  },
  gpsBar: {
    width: 3,
    marginHorizontal: 1,
    borderRadius: 1,
  },
  gpsText: {
    fontSize: 10,
    color: "#FFFFFF",
    fontFamily: "Inder",
  },
  mapControlsContainer: {
    position: "absolute",
    top: 20,
    right: 20,
    zIndex: 10,
  },
  mapControlButton: {
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  mapControlButtonText: {
    fontSize: 20,
  },
  coordinatesBox: {
    position: "absolute",
    bottom: 20,
    right: 20,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 12,
    padding: 8,
    minWidth: 100,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.1)",
    zIndex: 15,
  },
  coordinatesBoxText: {
    fontSize: 10,
    fontFamily: "Inder",
    color: "#333",
    fontWeight: "500",
    lineHeight: 12,
  },
  trackingControls: {
    marginTop: 0,
    marginBottom: 30,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  selectionContainer: {
    marginBottom: 0,
  },
  selectionTitle: {
    fontSize: 18,
    fontFamily: "Inder",
    fontWeight: "600",
    marginTop: 10,
  },
  horizontalScroll: {
    paddingVertical: 5,
  },
  selectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    minWidth: 120,
    alignItems: "center",
    borderWidth: 2,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  selectionCardTitle: {
    fontSize: 16,
    fontFamily: "Inder",
    fontWeight: "600",
    marginBottom: 4,
  },
  selectionCardSubtitle: {
    fontSize: 12,
    fontFamily: "Inder",
  },
  startTrackingButton: {
    backgroundColor: "#335C67",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: "center",
    marginTop: 25,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 6,
    marginBottom: 0,
  },
  startTrackingButtonText: {
    fontSize: 18,
    fontFamily: "Inder",
    fontWeight: "600",
  },
  trainingDropdown: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    borderWidth: 2,
    borderColor: "#E0E0E0",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  trainingDropdownContent: {
    flex: 1,
  },
  selectedTrainingContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  selectedTrainingText: {
    fontSize: 16,
    fontFamily: "Inder",
    fontWeight: "500",
  },
  placeholderText: {
    fontSize: 16,
    fontFamily: "Inder",
    fontStyle: "italic",
  },
  dropdownArrow: {
    fontSize: 16,
    fontWeight: "bold",
  },
  trainingDropdownList: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginTop: 5,
    borderWidth: 2,
    borderColor: "#E0E0E0",
    maxHeight: 250,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  trainingDropdownItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 15,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  trainingItemContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  trainingItemText: {
    fontSize: 16,
    fontFamily: "Inder",
    flex: 1,
  },
  favoriteButton: {
    padding: 8,
    marginLeft: 10,
    minWidth: 32,
    minHeight: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  favoriteIcon: {
    fontSize: 24,
    color: "#FFD700",
  },
  favoritesSeparator: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
    backgroundColor: "#F8F8F8",
  },
  separatorText: {
    fontSize: 12,
    fontFamily: "Inder",
    fontWeight: "500",
    textTransform: "uppercase",
  },
  trackingStatusContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginTop: 25,
    borderWidth: 2,
    borderColor: "#E0E0E0",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
  },
  trackingStatusHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  recordingIndicator: {
    flexDirection: "row",
    alignItems: "center",
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#DC3545",
    marginRight: 8,
  },
  recordingText: {
    fontSize: 14,
    fontFamily: "Inder",
    fontWeight: "600",
    letterSpacing: 1,
  },
  trackingTimer: {
    fontSize: 24,
    fontFamily: "Inder",
    fontWeight: "700",
  },
  trackingStats: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  trackingStatItem: {
    alignItems: "center",
  },
  trackingStatLabel: {
    fontSize: 12,
    fontFamily: "Inder",
    fontWeight: "500",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  trackingStatValue: {
    fontSize: 16,
    fontFamily: "Inder",
    fontWeight: "600",
  },
  trackingStatusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  trackingStatusLabel: {
    fontSize: 14,
    fontFamily: "Inder",
    fontWeight: "500",
  },
  trackingStatusValue: {
    fontSize: 16,
    fontFamily: "Inder",
    fontWeight: "600",
  },
});

export default MapScreen;
