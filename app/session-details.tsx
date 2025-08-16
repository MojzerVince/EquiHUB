import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../contexts/ThemeContext";

interface TrainingSession {
  id: string;
  userId: string;
  horseId: string;
  horseName: string;
  trainingType: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  distance?: number;
  path: Array<{
    latitude: number;
    longitude: number;
    timestamp: number;
    accuracy?: number;
    speed?: number;
  }>;
  averageSpeed?: number;
  maxSpeed?: number;
}

const SessionDetailsScreen = () => {
  const { sessionId } = useLocalSearchParams();
  const router = useRouter();
  const { currentTheme } = useTheme();
  const [session, setSession] = useState<TrainingSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSession();
  }, [sessionId]);

  const loadSession = async () => {
    try {
      setLoading(true);
      const savedSessions = await AsyncStorage.getItem("training_sessions");
      if (savedSessions) {
        const sessions: TrainingSession[] = JSON.parse(savedSessions);
        const found = sessions.find((s) => s.id === sessionId);
        setSession(found || null);
      }
    } catch (error) {
      console.error("Error loading session:", error);
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
            <Text style={styles.header}>Session Details</Text>
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
              Loading session details...
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
            <Text style={styles.header}>Session Details</Text>
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
            activeOpacity={0.7}
          >
            <Image
              source={require("../assets/UI_resources/UI_white/arrow_white.png")}
              style={styles.backIcon}
            />
          </TouchableOpacity>
          <Text style={styles.header}>Session Details</Text>
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
            <View
              style={[
                styles.sessionIconContainer,
                { backgroundColor: currentTheme.colors.primary },
              ]}
            >
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
                  {session.distance
                    ? `${(session.distance / 1000).toFixed(2)} km`
                    : "N/A"}
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
                    ? `${(session.averageSpeed * 3.6).toFixed(1)} km/h`
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
                  {session.maxSpeed
                    ? `${(session.maxSpeed * 3.6).toFixed(1)} km/h`
                    : "N/A"}
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
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionContainer}>
            <TouchableOpacity
              style={[
                styles.primaryButton,
                { backgroundColor: currentTheme.colors.primary },
              ]}
              onPress={() => router.push("/(tabs)/map")}
            >
              <Text style={styles.primaryButtonText}>Start New Session</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.secondaryButton,
                { borderColor: currentTheme.colors.border },
              ]}
              onPress={() => router.push("/sessions")}
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
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: -45,
  },
  backButton: {
    padding: 10,
    borderRadius: 20,
    minWidth: 40,
    minHeight: 40,
    marginTop: 10,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    zIndex: 10,
  },
  backIcon: {
    width: 24,
    height: 24,
    tintColor: "#fff",
  },
  header: {
    fontSize: 30,
    fontFamily: "Inder",
    color: "#fff",
    textAlign: "center",
    fontWeight: "600",
    flex: 1,
  },
  placeholder: {
    width: 40,
    height: 40,
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
    paddingBottom: 75,
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
});

export default SessionDetailsScreen;
