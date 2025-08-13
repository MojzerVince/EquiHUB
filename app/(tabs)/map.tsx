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
import { useRouter } from "expo-router";
import * as Location from "expo-location";

const MapScreen = () => {
  const { currentTheme } = useTheme();
  const { showError } = useDialog();
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

  useEffect(() => {
    requestLocationPermission();
  }, []);

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

      const { latitude, longitude } = location.coords;
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
    } finally {
      setLoading(false);
    }
  };

  const onRegionChange = (newRegion: Region) => {
    setRegion(newRegion);
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
            <View
              style={[
                styles.statsHeader,
                { backgroundColor: currentTheme.colors.surface },
              ]}
            >
              <Text
                style={[styles.statsText, { color: currentTheme.colors.text }]}
              >
                📍 Explore equestrian routes nearby
              </Text>
            </View>

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
              <MapView
                style={styles.map}
                provider={PROVIDER_GOOGLE}
                region={region}
                onRegionChangeComplete={onRegionChange}
                showsUserLocation={true}
                showsMyLocationButton={true}
                followsUserLocation={false}
                showsCompass={true}
                showsScale={true}
                zoomEnabled={true}
                scrollEnabled={true}
                pitchEnabled={true}
                rotateEnabled={true}
                mapType="standard"
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

            <View style={styles.mapInfo}>
              <View
                style={[
                  styles.infoCard,
                  {
                    backgroundColor: currentTheme.colors.background,
                    borderColor: currentTheme.colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.infoTitle,
                    { color: currentTheme.colors.text },
                  ]}
                >
                  🗺️ Interactive Map
                </Text>
                <Text
                  style={[
                    styles.infoDescription,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  Explore equestrian facilities, riding trails, and events in
                  your area. Use pinch to zoom and drag to navigate around the
                  map.
                </Text>
                {userLocation && (
                  <View style={styles.coordinatesContainer}>
                    <Text
                      style={[
                        styles.coordinatesLabel,
                        { color: currentTheme.colors.textSecondary },
                      ]}
                    >
                      Your coordinates:
                    </Text>
                    <Text
                      style={[
                        styles.coordinatesText,
                        { color: currentTheme.colors.text },
                      ]}
                    >
                      {userLocation.latitude.toFixed(6)},{" "}
                      {userLocation.longitude.toFixed(6)}
                    </Text>
                  </View>
                )}
              </View>
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
    marginBottom: -45,
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
  statsHeader: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingVertical: 15,
    marginBottom: 10,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  statsText: {
    fontSize: 16,
    fontFamily: "Inder",
    textAlign: "center",
    fontWeight: "500",
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
    marginBottom: 130,
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
  infoTitle: {
    fontSize: 18,
    fontFamily: "Inder",
    fontWeight: "600",
    marginBottom: 10,
  },
  infoDescription: {
    fontSize: 14,
    fontFamily: "Inder",
    lineHeight: 20,
    marginBottom: 15,
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
});

export default MapScreen;
