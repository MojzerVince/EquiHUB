import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMetric } from "../contexts/MetricContext";
import { useTheme } from "../contexts/ThemeContext";

// Media item interface
interface MediaItem {
  id: string;
  uri: string;
  type: "photo" | "video";
  timestamp: number;
  location?: {
    latitude: number;
    longitude: number;
  };
}

// Training session interface
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
  path: Array<{
    latitude: number;
    longitude: number;
    timestamp: number;
    accuracy?: number;
    speed?: number;
  }>;
  averageSpeed?: number; // in m/s
  maxSpeed?: number; // in m/s
  media?: MediaItem[]; // Photos and videos taken during session
}

const SessionSummaryScreen = () => {
  const { currentTheme } = useTheme();
  const { formatDistance, formatSpeed } = useMetric();
  const router = useRouter();
  const [session, setSession] = useState<TrainingSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSessionData();
  }, []);

  const loadSessionData = async () => {
    try {
      setLoading(true);
      const sessionData = await AsyncStorage.getItem("current_session_summary");
      if (sessionData) {
        const parsedSession: TrainingSession = JSON.parse(sessionData);
        setSession(parsedSession);

        // Clear the temporary session data
        await AsyncStorage.removeItem("current_session_summary");
      } else {
        // No session data found, redirect back
        Alert.alert(
          "No Session Data",
          "No session data found. Redirecting to map.",
          [{ text: "OK", onPress: () => router.back() }]
        );
      }
    } catch (error) {
      console.error("Error loading session data:", error);
      Alert.alert("Error", "Failed to load session data. Redirecting to map.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${remainingSeconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${remainingSeconds}s`;
    }
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getMapRegion = () => {
    if (!session || session.path.length === 0) {
      return {
        latitude: 37.78825,
        longitude: -122.4324,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      };
    }

    const latitudes = session.path.map((point) => point.latitude);
    const longitudes = session.path.map((point) => point.longitude);

    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLon = Math.min(...longitudes);
    const maxLon = Math.max(...longitudes);

    const centerLat = (minLat + maxLat) / 2;
    const centerLon = (minLon + maxLon) / 2;

    const deltaLat = (maxLat - minLat) * 1.2; // Add 20% padding
    const deltaLon = (maxLon - minLon) * 1.2;

    return {
      latitude: centerLat,
      longitude: centerLon,
      latitudeDelta: Math.max(deltaLat, 0.01),
      longitudeDelta: Math.max(deltaLon, 0.01),
    };
  };

  const openInGoogleMaps = () => {
    if (!session || session.path.length === 0) {
      Alert.alert(
        "No Route",
        "No route data available to display in Google Maps"
      );
      return;
    }

    try {
      // Get start and end points
      const startPoint = session.path[0];
      const endPoint = session.path[session.path.length - 1];

      // Create waypoints string for the route (using a subset of points to avoid URL length limits)
      const maxWaypoints = 8; // Google Maps URL limit
      const step = Math.max(1, Math.floor(session.path.length / maxWaypoints));
      const waypoints = session.path
        .filter(
          (_, index) =>
            index % step === 0 && index > 0 && index < session.path.length - 1
        )
        .slice(0, maxWaypoints)
        .map((point) => `${point.latitude},${point.longitude}`)
        .join("|");

      // Construct Google Maps URL
      let url = `https://www.google.com/maps/dir/?api=1`;
      url += `&origin=${startPoint.latitude},${startPoint.longitude}`;
      url += `&destination=${endPoint.latitude},${endPoint.longitude}`;

      if (waypoints) {
        url += `&waypoints=${waypoints}`;
      }

      url += `&travelmode=driving`;

      // Open in Google Maps
      Linking.openURL(url).catch((err) => {
        console.error("Error opening Google Maps:", err);
        Alert.alert(
          "Error",
          "Could not open Google Maps. Please make sure you have Google Maps installed."
        );
      });
    } catch (error) {
      console.error("Error creating Google Maps URL:", error);
      Alert.alert("Error", "Failed to open route in Google Maps");
    }
  };

  const saveAndContinue = () => {
    router.push("/(tabs)/map");
  };

  const viewAllSessions = () => {
    router.push("/sessions");
  };

  if (loading) {
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
            <Text style={styles.header}>Session Summary</Text>
          </View>
        </SafeAreaView>
        <View
          style={[
            styles.content,
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
              Loading session summary...
            </Text>
          </View>
        </View>
      </View>
    );
  }

  if (!session) {
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
            <Text style={styles.header}>Session Summary</Text>
          </View>
        </SafeAreaView>
        <View
          style={[
            styles.content,
            { backgroundColor: currentTheme.colors.background },
          ]}
        >
          <View style={styles.errorContainer}>
            <Text style={styles.errorEmoji}>⚠️</Text>
            <Text
              style={[styles.errorText, { color: currentTheme.colors.text }]}
            >
              Session Not Found
            </Text>
            <TouchableOpacity
              style={[
                styles.button,
                { backgroundColor: currentTheme.colors.primary },
              ]}
              onPress={() => router.back()}
            >
              <Text style={styles.buttonText}>Go Back</Text>
            </TouchableOpacity>
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
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.header}>Session Summary</Text>
          <View style={styles.placeholder} />
        </View>
      </SafeAreaView>

      <View
        style={[
          styles.content,
          { backgroundColor: currentTheme.colors.background },
        ]}
      >
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Session Header */}
          <View
            style={[
              styles.summaryCard,
              { backgroundColor: currentTheme.colors.surface },
            ]}
          >
            <View style={styles.sessionIconContainer}>
              <Text style={styles.sessionIcon}>🏇</Text>
            </View>
            <Text
              style={[styles.sessionTitle, { color: currentTheme.colors.text }]}
            >
              {session.trainingType}
            </Text>
            <Text
              style={[
                styles.sessionSubtitle,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              with {session.horseName}
            </Text>
            <Text
              style={[
                styles.sessionDate,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              {formatDate(session.startTime)}
            </Text>
          </View>

          {/* Statistics Grid */}
          <View
            style={[
              styles.statsCard,
              { backgroundColor: currentTheme.colors.surface },
            ]}
          >
            <Text
              style={[styles.statsTitle, { color: currentTheme.colors.text }]}
            >
              Session Statistics
            </Text>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text
                  style={[
                    styles.statValue,
                    { color: currentTheme.colors.primary },
                  ]}
                >
                  {session.duration ? formatDuration(session.duration) : "N/A"}
                </Text>
                <Text
                  style={[
                    styles.statLabel,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  Duration
                </Text>
              </View>

              <View style={styles.statItem}>
                <Text
                  style={[
                    styles.statValue,
                    { color: currentTheme.colors.primary },
                  ]}
                >
                  {session.distance ? formatDistance(session.distance) : "N/A"}
                </Text>
                <Text
                  style={[
                    styles.statLabel,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  Distance
                </Text>
              </View>

              <View style={styles.statItem}>
                <Text
                  style={[
                    styles.statValue,
                    { color: currentTheme.colors.primary },
                  ]}
                >
                  {session.averageSpeed
                    ? formatSpeed(session.averageSpeed)
                    : "N/A"}
                </Text>
                <Text
                  style={[
                    styles.statLabel,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  Avg Speed
                </Text>
              </View>

              <View style={styles.statItem}>
                <Text
                  style={[
                    styles.statValue,
                    { color: currentTheme.colors.primary },
                  ]}
                >
                  {session.maxSpeed ? formatSpeed(session.maxSpeed) : "N/A"}
                </Text>
                <Text
                  style={[
                    styles.statLabel,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  Max Speed
                </Text>
              </View>

              <View style={styles.statItem}>
                <Text
                  style={[
                    styles.statValue,
                    { color: currentTheme.colors.primary },
                  ]}
                >
                  {session.path.length}
                </Text>
                <Text
                  style={[
                    styles.statLabel,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  GPS Points
                </Text>
              </View>

              <View style={styles.statItem}>
                <Text
                  style={[
                    styles.statValue,
                    { color: currentTheme.colors.primary },
                  ]}
                >
                  {session.path.length > 0
                    ? `${(
                        session.path.reduce(
                          (sum, point) => sum + (point.accuracy || 0),
                          0
                        ) / session.path.length || 0
                      ).toFixed(1)}m`
                    : "N/A"}
                </Text>
                <Text
                  style={[
                    styles.statLabel,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  Avg Accuracy
                </Text>
              </View>
            </View>
          </View>

          {/* Media Gallery */}
          {session.media && session.media.length > 0 && (
            <View
              style={[
                styles.mediaCard,
                { backgroundColor: currentTheme.colors.surface },
              ]}
            >
              <Text
                style={[styles.mediaTitle, { color: currentTheme.colors.text }]}
              >
                Session Media ({session.media.length})
              </Text>
              <ScrollView
                horizontal
                style={styles.mediaScrollView}
                showsHorizontalScrollIndicator={false}
              >
                {session.media.map((item, index) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.mediaItem}
                    onPress={() => {
                      // You can add a full-screen media viewer here if needed
                      Alert.alert(
                        item.type === "photo" ? "Photo" : "Video",
                        `Captured at ${new Date(
                          item.timestamp
                        ).toLocaleTimeString()}`
                      );
                    }}
                  >
                    <Image
                      source={{ uri: item.uri }}
                      style={styles.mediaThumbnail}
                      resizeMode="cover"
                    />
                    <View style={styles.mediaOverlay}>
                      <Text style={styles.mediaTypeIcon}>
                        {item.type === "photo" ? "📸" : "🎥"}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.mediaTime,
                        { color: currentTheme.colors.textSecondary },
                      ]}
                    >
                      {new Date(item.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Route Map */}
          {session.path.length > 0 && (
            <View
              style={[
                styles.mapCard,
                { backgroundColor: currentTheme.colors.surface },
              ]}
            >
              <Text
                style={[styles.mapTitle, { color: currentTheme.colors.text }]}
              >
                Route Map
              </Text>
              <View style={styles.mapContainer}>
                <MapView
                  style={styles.map}
                  provider={PROVIDER_GOOGLE}
                  region={getMapRegion()}
                  scrollEnabled={true}
                  zoomEnabled={true}
                  pitchEnabled={false}
                  rotateEnabled={false}
                >
                  {/* Route polyline */}
                  <Polyline
                    coordinates={session.path.map((point) => ({
                      latitude: point.latitude,
                      longitude: point.longitude,
                    }))}
                    strokeColor={currentTheme.colors.primary}
                    strokeWidth={4}
                  />

                  {/* Start marker */}
                  <Marker
                    coordinate={{
                      latitude: session.path[0].latitude,
                      longitude: session.path[0].longitude,
                    }}
                    title="Start"
                    description="Training start point"
                    pinColor="green"
                  />

                  {/* End marker */}
                  <Marker
                    coordinate={{
                      latitude: session.path[session.path.length - 1].latitude,
                      longitude:
                        session.path[session.path.length - 1].longitude,
                    }}
                    title="Finish"
                    description="Training end point"
                    pinColor="red"
                  />
                </MapView>
              </View>

              {/* Google Maps Button */}
              <View style={styles.mapActionContainer}>
                <TouchableOpacity
                  style={[
                    styles.googleMapsButton,
                    { backgroundColor: currentTheme.colors.primary },
                  ]}
                  onPress={openInGoogleMaps}
                  activeOpacity={0.8}
                >
                  <Text style={styles.googleMapsButtonIcon}>🗺️</Text>
                  <Text style={styles.googleMapsButtonText}>
                    View Route in Google Maps
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionContainer}>
            <TouchableOpacity
              style={[
                styles.primaryButton,
                { backgroundColor: currentTheme.colors.primary },
              ]}
              onPress={saveAndContinue}
            >
              <Text style={styles.primaryButtonText}>Start New Session</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.secondaryButton,
                { borderColor: currentTheme.colors.border },
              ]}
              onPress={viewAllSessions}
            >
              <Text
                style={[
                  styles.secondaryButtonText,
                  { color: currentTheme.colors.text },
                ]}
              >
                View All Sessions
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
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
  headerContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  backButton: {
    position: "absolute",
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  backButtonText: {
    fontSize: 20,
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  header: {
    fontSize: 30,
    fontFamily: "Inder",
    color: "#fff",
    textAlign: "center",
    fontWeight: "600",
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 50,
    borderTopRightRadius: 50,
    marginTop: 5,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 30,
    paddingHorizontal: 20,
    paddingBottom: 30,
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
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  errorEmoji: {
    fontSize: 64,
    marginBottom: 20,
  },
  errorText: {
    fontSize: 24,
    fontFamily: "Inder",
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 30,
  },
  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 30,
    marginBottom: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  sessionIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#335C67",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  sessionIcon: {
    fontSize: 40,
  },
  sessionTitle: {
    fontSize: 24,
    fontFamily: "Inder",
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 8,
  },
  sessionSubtitle: {
    fontSize: 18,
    fontFamily: "Inder",
    textAlign: "center",
    marginBottom: 8,
  },
  sessionDate: {
    fontSize: 14,
    fontFamily: "Inder",
    textAlign: "center",
  },
  statsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 25,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  statsTitle: {
    fontSize: 20,
    fontFamily: "Inder",
    fontWeight: "600",
    marginBottom: 20,
    textAlign: "center",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  statItem: {
    width: "48%",
    alignItems: "center",
    marginBottom: 20,
    padding: 15,
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
  },
  statValue: {
    fontSize: 20,
    fontFamily: "Inder",
    fontWeight: "700",
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: "Inder",
    textTransform: "uppercase",
    fontWeight: "500",
    textAlign: "center",
  },
  mapCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  mapTitle: {
    fontSize: 20,
    fontFamily: "Inder",
    fontWeight: "600",
    marginBottom: 15,
    textAlign: "center",
  },
  mapContainer: {
    height: 300,
    borderRadius: 12,
    overflow: "hidden",
  },
  map: {
    flex: 1,
  },
  actionContainer: {
    marginTop: 10,
  },
  primaryButton: {
    backgroundColor: "#335C67",
    borderRadius: 25,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: "center",
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryButtonText: {
    fontSize: 18,
    fontFamily: "Inder",
    color: "#FFFFFF",
    fontWeight: "600",
  },
  secondaryButton: {
    borderRadius: 25,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#E0E0E0",
    backgroundColor: "transparent",
  },
  secondaryButtonText: {
    fontSize: 16,
    fontFamily: "Inder",
    fontWeight: "600",
  },
  button: {
    backgroundColor: "#335C67",
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
  },
  buttonText: {
    fontSize: 16,
    fontFamily: "Inder",
    color: "#FFFFFF",
    fontWeight: "600",
  },
  // Media Gallery Styles
  mediaCard: {
    margin: 20,
    padding: 20,
    borderRadius: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  mediaTitle: {
    fontSize: 20,
    fontFamily: "Inder",
    fontWeight: "600",
    marginBottom: 15,
  },
  mediaScrollView: {
    paddingVertical: 10,
  },
  mediaItem: {
    marginRight: 15,
    alignItems: "center",
  },
  mediaThumbnail: {
    width: 100,
    height: 100,
    borderRadius: 12,
    marginBottom: 8,
  },
  mediaOverlay: {
    position: "absolute",
    top: 5,
    right: 5,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 12,
    padding: 4,
  },
  mediaTypeIcon: {
    fontSize: 16,
  },
  mediaTime: {
    fontSize: 12,
    fontFamily: "Inder",
    textAlign: "center",
  },
  // Google Maps Button Styles
  mapActionContainer: {
    marginTop: 15,
    paddingHorizontal: 20,
  },
  googleMapsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  googleMapsButtonIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  googleMapsButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Inder",
    fontWeight: "600",
  },
});

export default SessionSummaryScreen;
