import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import MapView, { Marker, Region, PROVIDER_GOOGLE } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../contexts/ThemeContext";
import { useDialog } from "../../contexts/DialogContext";
import { useAuth } from "../../contexts/AuthContext";
import { useRouter } from "expo-router";
import { HorseAPI } from "../../lib/horseAPI";
import { Horse } from "../../lib/supabase";
import * as Location from "expo-location";

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

  // Cleanup GPS monitoring when component unmounts
  useEffect(() => {
    return () => {
      setGpsStrength(0);
    };
  }, []);

  // Sample data - these could come from API or context in real app
  const trainingTypes = [
    { id: "dressage", name: "Dressage", icon: "🎭" },
    { id: "jumping", name: "Show Jumping", icon: "🏇" },
    { id: "trail", name: "Trail Riding", icon: "🌲" },
    { id: "endurance", name: "Endurance", icon: "⚡" },
    { id: "western", name: "Western", icon: "🤠" },
    { id: "leisure", name: "Leisure Ride", icon: "🚶" },
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

  const startTracking = () => {
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

    // Here you would implement the actual tracking logic
    Alert.alert(
      "Start Tracking",
      `Starting ${
        trainingTypes.find((t) => t.id === selectedTrainingType)?.name
      } session with ${userHorses.find((h) => h.id === selectedHorse)?.name}`,
      [{ text: "OK" }]
    );
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
                {userLocation && (
                  <Marker
                    coordinate={userLocation}
                    title="You are here"
                    description="Your current location"
                    pinColor="red"
                  />
                )}
              </MapView>
            </View>

            <View style={styles.trackingControls}>
              {/* Horse Selection */}
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

              {/* Training Type Selection */}
              <View style={styles.selectionContainer}>
                <Text
                  style={[
                    styles.selectionTitle,
                    { color: currentTheme.colors.text },
                  ]}
                >
                  Training Type
                </Text>
                <View style={styles.trainingGrid}>
                  {trainingTypes.map((training) => (
                    <TouchableOpacity
                      key={training.id}
                      style={[
                        styles.trainingCard,
                        {
                          backgroundColor:
                            selectedTrainingType === training.id
                              ? currentTheme.colors.primary
                              : currentTheme.colors.background,
                          borderColor:
                            selectedTrainingType === training.id
                              ? currentTheme.colors.primary
                              : currentTheme.colors.border,
                        },
                      ]}
                      onPress={() => setSelectedTrainingType(training.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.trainingIcon}>{training.icon}</Text>
                      <Text
                        style={[
                          styles.trainingName,
                          {
                            color:
                              selectedTrainingType === training.id
                                ? "#FFFFFF"
                                : currentTheme.colors.text,
                          },
                        ]}
                      >
                        {training.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Start Tracking Button */}
              <TouchableOpacity
                style={[
                  styles.startTrackingButton,
                  {
                    backgroundColor:
                      selectedHorse &&
                      selectedTrainingType &&
                      userLocation &&
                      !horsesLoading &&
                      userHorses.length > 0
                        ? currentTheme.colors.primary
                        : currentTheme.colors.border,
                  },
                ]}
                onPress={startTracking}
                disabled={
                  !selectedHorse ||
                  !selectedTrainingType ||
                  !userLocation ||
                  horsesLoading ||
                  userHorses.length === 0
                }
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.startTrackingButtonText,
                    {
                      color:
                        selectedHorse && selectedTrainingType && userLocation
                          ? "#FFFFFF"
                          : currentTheme.colors.textSecondary,
                    },
                  ]}
                >
                  Start Tracking
                </Text>
              </TouchableOpacity>
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
    marginBottom: 20,
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
    marginTop: 10,
    marginBottom: 130,
    paddingHorizontal: 20,
  },
  selectionContainer: {
    marginBottom: 0,
  },
  selectionTitle: {
    fontSize: 18,
    fontFamily: "Inder",
    fontWeight: "600",
    marginTop: 20,
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
  trainingGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  trainingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    width: "48%",
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
  trainingIcon: {
    fontSize: 20,
    marginBottom: 6,
  },
  trainingName: {
    fontSize: 12,
    fontFamily: "Inder",
    fontWeight: "500",
    textAlign: "center",
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
    marginBottom: -45,
  },
  startTrackingButtonText: {
    fontSize: 18,
    fontFamily: "Inder",
    fontWeight: "600",
  },
});

export default MapScreen;
