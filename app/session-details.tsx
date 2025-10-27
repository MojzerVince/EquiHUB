import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../contexts/AuthContext";
import { useMetric } from "../contexts/MetricContext";
import { useTheme } from "../contexts/ThemeContext";
import { HorseAPI } from "../lib/horseAPI";
import { Horse } from "../lib/supabase";

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

interface GaitSegment {
  gait: "walk" | "trot" | "canter" | "gallop" | "halt";
  startTime: number;
  endTime: number;
  duration: number; // in seconds
  distance: number; // in meters
  averageSpeed: number; // in m/s
  startIndex: number; // index in path array
  endIndex: number; // index in path array
}

interface GaitAnalysis {
  totalDuration: number;
  gaitDurations: {
    walk: number;
    trot: number;
    canter: number;
    gallop: number;
    halt: number;
  };
  gaitPercentages: {
    walk: number;
    trot: number;
    canter: number;
    gallop: number;
    halt: number;
  };
  segments: GaitSegment[];
  transitionCount: number;
  predominantGait: "walk" | "trot" | "canter" | "gallop" | "halt";
}

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
  media?: MediaItem[]; // Photos and videos taken during session
  gaitAnalysis?: GaitAnalysis; // Horse gait analysis
}

const SessionDetailsScreen = () => {
  const { sessionId } = useLocalSearchParams();
  const router = useRouter();
  const { currentTheme } = useTheme();
  const { formatDistance, formatSpeed } = useMetric();
  const { user } = useAuth();
  const [session, setSession] = useState<TrainingSession | null>(null);
  const [horse, setHorse] = useState<Horse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSharing, setIsSharing] = useState(false);

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

        // Load horse data if session is found
        if (found && found.horseId) {
          try {
            const horses = await HorseAPI.getHorses(found.userId);
            const sessionHorse = horses?.find((h) => h.id === found.horseId);
            setHorse(sessionHorse || null);
          } catch (error) {
            console.error("Error loading horse data:", error);
            setHorse(null);
          }
        }
      }
    } catch (error) {
      console.error("Error loading session:", error);
    } finally {
      setLoading(false);
    }
  };

  const shareToCompanyFeed = async () => {
    if (!session || !user) {
      Alert.alert("Error", "Unable to share session. Please try again.");
      return;
    }

    // Navigate to the sharing screen with only the sessionId
    router.push({
      pathname: "/session-share",
      params: {
        sessionId: session.id,
      },
    });
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

  const getGaitEmoji = (gait: string): string => {
    switch (gait) {
      case "walk":
        return "🚶";
      case "trot":
        return "🏃";
      case "canter":
        return "🏇";
      case "gallop":
        return "🏇💨";
      case "halt":
        return "⏹️";
      default:
        return "🐎";
    }
  };

  const getGaitColor = (gait: string): string => {
    switch (gait) {
      case "walk":
        return "#4CAF50";
      case "trot":
        return "#FF9800";
      case "canter":
        return "#F44336";
      case "gallop":
        return "#9C27B0";
      case "halt":
        return "#757575";
      default:
        return "#335C67";
    }
  };

  const formatGaitDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${remainingSeconds}s`;
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
            styles.viewPort,
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
              source={require("../assets/in_app_icons/back.png")}
              style={styles.backIcon}
            />
          </TouchableOpacity>
          <Text style={styles.header}>Session Details</Text>
        </View>
      </SafeAreaView>

        <ScrollView
          style={styles.viewPort}
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
            {horse && horse.image_url ? (
              <Image
                source={{ uri: horse.image_url }}
                style={styles.horseImage}
                resizeMode="cover"
              />
            ) : (
              <Text style={styles.sessionIcon}>🐎</Text>
            )}
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

          {/* Gait Analysis */}
          {session.gaitAnalysis && (
            <View
              style={[
                styles.gaitCard,
                { backgroundColor: currentTheme.colors.surface },
              ]}
            >
              <Text
                style={[styles.gaitTitle, { color: currentTheme.colors.text }]}
              >
                🐎 Gait Analysis
              </Text>

              {/* Gait Summary */}
              <View style={styles.gaitSummary}>
                <View style={styles.gaitSummaryItem}>
                  <Text
                    style={[
                      styles.gaitSummaryLabel,
                      { color: currentTheme.colors.textSecondary },
                    ]}
                  >
                    Predominant Gait
                  </Text>
                  <View style={styles.gaitSummaryValue}>
                    <Text style={styles.gaitEmoji}>
                      {getGaitEmoji(session.gaitAnalysis.predominantGait)}
                    </Text>
                    <Text
                      style={[
                        styles.gaitSummaryText,
                        { color: currentTheme.colors.text },
                      ]}
                    >
                      {session.gaitAnalysis.predominantGait
                        .charAt(0)
                        .toUpperCase() +
                        session.gaitAnalysis.predominantGait.slice(1)}
                    </Text>
                  </View>
                </View>

                <View style={styles.gaitSummaryItem}>
                  <Text
                    style={[
                      styles.gaitSummaryLabel,
                      { color: currentTheme.colors.textSecondary },
                    ]}
                  >
                    Transitions
                  </Text>
                  <Text
                    style={[
                      styles.gaitSummaryText,
                      { color: currentTheme.colors.text },
                    ]}
                  >
                    {session.gaitAnalysis.transitionCount}
                  </Text>
                </View>
              </View>

              {/* Gait Breakdown */}
              <View style={styles.gaitBreakdown}>
                <Text
                  style={[
                    styles.gaitBreakdownTitle,
                    { color: currentTheme.colors.text },
                  ]}
                >
                  Time Distribution
                </Text>
                {Object.entries(session.gaitAnalysis.gaitPercentages).map(
                  ([gait, percentage]) =>
                    percentage > 0 && (
                      <View key={gait} style={styles.gaitBreakdownItem}>
                        <View style={styles.gaitBreakdownHeader}>
                          <View style={styles.gaitBreakdownLabelContainer}>
                            <Text style={styles.gaitBreakdownEmoji}>
                              {getGaitEmoji(gait)}
                            </Text>
                            <Text
                              style={[
                                styles.gaitBreakdownLabel,
                                { color: currentTheme.colors.text },
                              ]}
                            >
                              {gait.charAt(0).toUpperCase() + gait.slice(1)}
                            </Text>
                          </View>
                          <View style={styles.gaitBreakdownStats}>
                            <Text
                              style={[
                                styles.gaitBreakdownPercentage,
                                { color: currentTheme.colors.text },
                              ]}
                            >
                              {percentage.toFixed(1)}%
                            </Text>
                            <Text
                              style={[
                                styles.gaitBreakdownDuration,
                                { color: currentTheme.colors.textSecondary },
                              ]}
                            >
                              (
                              {formatGaitDuration(
                                session.gaitAnalysis?.gaitDurations[
                                  gait as keyof typeof session.gaitAnalysis.gaitDurations
                                ] || 0
                              )}
                              )
                            </Text>
                          </View>
                        </View>
                        <View style={styles.gaitProgressBarContainer}>
                          <View
                            style={[
                              styles.gaitProgressBar,
                              {
                                width: `${percentage}%`,
                                backgroundColor: getGaitColor(gait),
                              },
                            ]}
                          />
                        </View>
                      </View>
                    )
                )}
              </View>

              {/* Gait Segments */}
              {session.gaitAnalysis.segments.length > 0 && (
                <View style={styles.gaitSegments}>
                  <Text
                    style={[
                      styles.gaitSegmentsTitle,
                      { color: currentTheme.colors.text },
                    ]}
                  >
                    Session Timeline ({session.gaitAnalysis.segments.length}{" "}
                    segments)
                  </Text>
                  <ScrollView
                    horizontal
                    style={styles.gaitSegmentsScroll}
                    showsHorizontalScrollIndicator={false}
                  >
                    {session.gaitAnalysis.segments.map((segment, index) => (
                      <View
                        key={index}
                        style={[
                          styles.gaitSegmentItem,
                          { borderLeftColor: getGaitColor(segment.gait) },
                        ]}
                      >
                        <Text style={styles.gaitSegmentEmoji}>
                          {getGaitEmoji(segment.gait)}
                        </Text>
                        <Text
                          style={[
                            styles.gaitSegmentGait,
                            { color: currentTheme.colors.text },
                          ]}
                        >
                          {segment.gait.charAt(0).toUpperCase() +
                            segment.gait.slice(1)}
                        </Text>
                        <Text
                          style={[
                            styles.gaitSegmentDuration,
                            { color: currentTheme.colors.textSecondary },
                          ]}
                        >
                          {formatGaitDuration(segment.duration)}
                        </Text>
                        <Text
                          style={[
                            styles.gaitSegmentDistance,
                            { color: currentTheme.colors.textSecondary },
                          ]}
                        >
                          {formatDistance(segment.distance)}
                        </Text>
                        <Text
                          style={[
                            styles.gaitSegmentSpeed,
                            { color: currentTheme.colors.textSecondary },
                          ]}
                        >
                          {formatSpeed(segment.averageSpeed)}
                        </Text>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          )}

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
                  {/* Route polylines with gait-based colors */}
                  {session.gaitAnalysis &&
                  session.gaitAnalysis.segments.length > 0 ? (
                    // Render colored segments based on gait analysis
                    session.gaitAnalysis.segments.map((segment, index) => {
                      const segmentPath = session.path.slice(
                        segment.startIndex,
                        segment.endIndex + 1
                      );

                      if (segmentPath.length < 2) return null;

                      return (
                        <Polyline
                          key={`gait-segment-${index}`}
                          coordinates={segmentPath.map((point) => ({
                            latitude: point.latitude,
                            longitude: point.longitude,
                          }))}
                          strokeColor={getGaitColor(segment.gait)}
                          strokeWidth={4}
                        />
                      );
                    })
                  ) : (
                    // Fallback: single colored polyline if no gait analysis
                    <Polyline
                      coordinates={session.path.map((point) => ({
                        latitude: point.latitude,
                        longitude: point.longitude,
                      }))}
                      strokeColor={currentTheme.colors.primary}
                      strokeWidth={4}
                    />
                  )}

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

              {/* Gait Legend */}
              {session.gaitAnalysis &&
                session.gaitAnalysis.segments.length > 0 && (
                  <View style={styles.legendContainer}>
                    <Text
                      style={[
                        styles.legendTitle,
                        { color: currentTheme.colors.text },
                      ]}
                    >
                      Path Legend
                    </Text>
                    <View style={styles.legendItems}>
                      {["walk", "trot", "canter", "gallop", "halt"].map(
                        (gait) => (
                          <View key={gait} style={styles.legendItem}>
                            <View
                              style={[
                                styles.legendColor,
                                { backgroundColor: getGaitColor(gait) },
                              ]}
                            />
                            <Text
                              style={[
                                styles.legendText,
                                { color: currentTheme.colors.text },
                              ]}
                            >
                              {gait.charAt(0).toUpperCase() + gait.slice(1)}
                            </Text>
                          </View>
                        )
                      )}
                    </View>
                  </View>
                )}
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionContainer}>
            <TouchableOpacity
              style={[
                styles.shareButton,
                { backgroundColor: "#4CAF50" },
                isSharing && styles.disabledButton,
              ]}
              onPress={shareToCompanyFeed}
              disabled={isSharing}
            >
              <Text style={styles.shareButtonText}>
                {isSharing ? "Sharing..." : "🌟 Share to Community"}
              </Text>
            </TouchableOpacity>

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
    marginBottom: Platform.OS === "ios" ? -50 : -45,
    marginTop: Platform.OS === "ios" ? -15 : -5,
  },
  backButton: {
    position: "absolute",
    left: 20,
    padding: 10,
    borderRadius: 20,
    minWidth: 40,
    minHeight: 40,
    marginTop: 10,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  backIcon: {
    width: 26,
    height: 26,
  },
  header: {
    fontSize: 30,
    fontFamily: "Inder",
    color: "#fff",
    textAlign: "center",
    flex: 1,
    fontWeight: "600",
  },
  placeholder: {
    width: 40,
    height: 40,
  },
  viewPort: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 50,
    borderTopRightRadius: 50,
    marginTop: -8,
  },
  scrollContent: {
    paddingTop: 20,
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
  sessionIcon: {
    fontSize: 40,
  },
  horseImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 10,
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
  shareButton: {
    backgroundColor: "#4CAF50",
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
  shareButtonText: {
    fontSize: 18,
    fontFamily: "Inder",
    color: "#FFFFFF",
    fontWeight: "600",
  },
  disabledButton: {
    opacity: 0.6,
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
  mediaTitle: {
    fontSize: 20,
    fontFamily: "Inder",
    fontWeight: "600",
    marginBottom: 15,
    textAlign: "center",
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

  // Gait Analysis Styles
  gaitCard: {
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
  gaitTitle: {
    fontSize: 20,
    fontFamily: "Inder",
    fontWeight: "600",
    marginBottom: 20,
    textAlign: "center",
  },
  gaitSummary: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 25,
    padding: 15,
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
  },
  gaitSummaryItem: {
    alignItems: "center",
    flex: 1,
  },
  gaitSummaryLabel: {
    fontSize: 12,
    fontFamily: "Inder",
    textTransform: "uppercase",
    fontWeight: "500",
    marginBottom: 8,
    textAlign: "center",
  },
  gaitSummaryValue: {
    flexDirection: "row",
    alignItems: "center",
  },
  gaitEmoji: {
    fontSize: 24,
    marginRight: 8,
  },
  gaitSummaryText: {
    fontSize: 16,
    fontFamily: "Inder",
    fontWeight: "600",
    textAlign: "center",
  },
  gaitBreakdown: {
    marginBottom: 25,
  },
  gaitBreakdownTitle: {
    fontSize: 16,
    fontFamily: "Inder",
    fontWeight: "600",
    marginBottom: 15,
    textAlign: "center",
  },
  gaitBreakdownItem: {
    marginBottom: 15,
  },
  gaitBreakdownHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  gaitBreakdownLabelContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  gaitBreakdownEmoji: {
    fontSize: 20,
    marginRight: 8,
  },
  gaitBreakdownLabel: {
    fontSize: 16,
    fontFamily: "Inder",
    fontWeight: "500",
  },
  gaitBreakdownStats: {
    alignItems: "flex-end",
  },
  gaitBreakdownPercentage: {
    fontSize: 16,
    fontFamily: "Inder",
    fontWeight: "600",
  },
  gaitBreakdownDuration: {
    fontSize: 12,
    fontFamily: "Inder",
  },
  gaitProgressBarContainer: {
    height: 6,
    backgroundColor: "#E0E0E0",
    borderRadius: 3,
    overflow: "hidden",
  },
  gaitProgressBar: {
    height: "100%",
    borderRadius: 3,
  },
  gaitSegments: {
    marginTop: 10,
  },
  gaitSegmentsTitle: {
    fontSize: 16,
    fontFamily: "Inder",
    fontWeight: "600",
    marginBottom: 15,
    textAlign: "center",
  },
  gaitSegmentsScroll: {
    paddingVertical: 10,
  },
  gaitSegmentItem: {
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    minWidth: 100,
    alignItems: "center",
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  gaitSegmentEmoji: {
    fontSize: 24,
    marginBottom: 6,
  },
  gaitSegmentGait: {
    fontSize: 14,
    fontFamily: "Inder",
    fontWeight: "600",
    marginBottom: 4,
    textAlign: "center",
  },
  gaitSegmentDuration: {
    fontSize: 12,
    fontFamily: "Inder",
    textAlign: "center",
    marginBottom: 2,
  },
  gaitSegmentDistance: {
    fontSize: 11,
    fontFamily: "Inder",
    textAlign: "center",
    marginBottom: 2,
  },
  gaitSegmentSpeed: {
    fontSize: 11,
    fontFamily: "Inder",
    textAlign: "center",
  },
  legendContainer: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  legendTitle: {
    fontSize: 16,
    fontFamily: "Inder",
    fontWeight: "600",
    marginBottom: 8,
    textAlign: "center",
  },
  legendItems: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 6,
    marginVertical: 2,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 6,
  },
  legendText: {
    fontSize: 14,
    fontFamily: "Inder",
    fontWeight: "500",
  },
});

export default SessionDetailsScreen;
