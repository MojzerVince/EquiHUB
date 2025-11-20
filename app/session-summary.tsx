import AsyncStorage from "@react-native-async-storage/async-storage";
import Slider from "@react-native-community/slider";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../contexts/AuthContext";
import { useMetric } from "../contexts/MetricContext";
import { useTheme } from "../contexts/ThemeContext";
import { smartUploadSession } from "../lib/sessionAPI";

interface TrackingPoint {
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy?: number;
  speed?: number;
}

const SessionSummaryScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const { currentTheme } = useTheme();
  const { metricSystem } = useMetric();

  // Parse session data from params
  const sessionData = useMemo(() => {
    if (params.sessionData && typeof params.sessionData === "string") {
      return JSON.parse(params.sessionData);
    }
    return null;
  }, [params.sessionData]);

  // State for feedback
  const [riderPerformance, setRiderPerformance] = useState(5);
  const [horsePerformance, setHorsePerformance] = useState(5);
  const [groundType, setGroundType] = useState("Medium");
  const [notes, setNotes] = useState("");
  const [showNotesNextRide, setShowNotesNextRide] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Trimming state
  const [trimStartIndex, setTrimStartIndex] = useState(0);
  const [trimEndIndex, setTrimEndIndex] = useState(
    sessionData?.path?.length ? sessionData.path.length - 1 : 0
  );

  // Ground type options
  const groundTypes = ["Soft", "Medium", "Hard", "Mixed"];

  // Calculate distance between two points (Haversine formula)
  const getDistance = (point1: TrackingPoint, point2: TrackingPoint) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (point1.latitude * Math.PI) / 180;
    const φ2 = (point2.latitude * Math.PI) / 180;
    const Δφ = ((point2.latitude - point1.latitude) * Math.PI) / 180;
    const Δλ = ((point2.longitude - point1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  // Calculate trimmed data
  const trimmedData = useMemo(() => {
    if (!sessionData?.path || sessionData.path.length === 0) {
      return {
        path: [],
        duration: 0,
        distance: 0,
        startTime: Date.now(),
        endTime: Date.now(),
      };
    }

    const trimmedPath = sessionData.path.slice(
      trimStartIndex,
      trimEndIndex + 1
    );

    if (trimmedPath.length === 0) {
      return {
        path: [],
        duration: 0,
        distance: 0,
        startTime: Date.now(),
        endTime: Date.now(),
      };
    }

    // Calculate distance
    let distance = 0;
    for (let i = 1; i < trimmedPath.length; i++) {
      const prev = trimmedPath[i - 1];
      const curr = trimmedPath[i];
      const d = getDistance(prev, curr);
      distance += d;
    }

    // Calculate duration
    const startTime = trimmedPath[0].timestamp;
    const endTime = trimmedPath[trimmedPath.length - 1].timestamp;
    const duration = Math.floor((endTime - startTime) / 1000);

    return {
      path: trimmedPath,
      duration,
      distance,
      startTime,
      endTime,
    };
  }, [sessionData, trimStartIndex, trimEndIndex]);

  // Format duration
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    }
    return `${minutes}m ${secs}s`;
  };

  // Format distance
  const formatDistance = (meters: number) => {
    if (metricSystem === "metric") {
      if (meters >= 1000) {
        return `${(meters / 1000).toFixed(2)} km`;
      }
      return `${meters.toFixed(0)} m`;
    } else {
      const miles = meters * 0.000621371;
      if (miles >= 1) {
        return `${miles.toFixed(2)} mi`;
      }
      return `${(meters * 3.28084).toFixed(0)} ft`;
    }
  };

  // Get map region
  const getMapRegion = () => {
    if (!trimmedData.path || trimmedData.path.length === 0) {
      return {
        latitude: 37.78825,
        longitude: -122.4324,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }

    let minLat = trimmedData.path[0].latitude;
    let maxLat = trimmedData.path[0].latitude;
    let minLng = trimmedData.path[0].longitude;
    let maxLng = trimmedData.path[0].longitude;

    trimmedData.path.forEach((point: TrackingPoint) => {
      minLat = Math.min(minLat, point.latitude);
      maxLat = Math.max(maxLat, point.latitude);
      minLng = Math.min(minLng, point.longitude);
      maxLng = Math.max(maxLng, point.longitude);
    });

    const latDelta = (maxLat - minLat) * 1.5 || 0.01;
    const lngDelta = (maxLng - minLng) * 1.5 || 0.01;

    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(latDelta, 0.01),
      longitudeDelta: Math.max(lngDelta, 0.01),
    };
  };

  // Handle finish session
  const handleFinishSession = async () => {
    if (!user?.id || !sessionData) {
      Alert.alert("Error", "Missing user or session data");
      return;
    }

    if (trimmedData.path.length < 2) {
      Alert.alert("Error", "Session is too short after trimming");
      return;
    }

    setIsSaving(true);

    try {
      // Prepare trimmed session data
      const trimmedSessionData = {
        ...sessionData,
        path: trimmedData.path,
        metadata: {
          ...sessionData.metadata,
          totalDistance: trimmedData.distance,
          totalDuration: trimmedData.duration,
          startTime: trimmedData.startTime,
          endTime: trimmedData.endTime,
          riderPerformance,
          horsePerformance,
          groundType,
          notes: notes.trim() || null,
        },
      };

      // Calculate speeds
      const maxSpeed = Math.max(
        ...trimmedData.path
          .filter((p: TrackingPoint) => p.speed)
          .map((p: TrackingPoint) => p.speed || 0)
      );
      const avgSpeed =
        trimmedData.duration > 0
          ? trimmedData.distance / trimmedData.duration
          : 0;

      // Upload session using smart upload (checks WiFi)
      const result = await smartUploadSession(
        user.id,
        sessionData.horse?.id || null,
        sessionData.horse?.name || null,
        sessionData.trainingType || "General Training",
        trimmedSessionData,
        new Date(trimmedData.startTime),
        new Date(trimmedData.endTime),
        trimmedData.duration,
        trimmedData.distance,
        maxSpeed * 3.6, // Convert m/s to km/h
        avgSpeed * 3.6,
        riderPerformance,
        horsePerformance,
        groundType,
        notes.trim() || null
      );

      if (result.success) {
        // Save "notes for next ride" if checkbox is checked
        if (showNotesNextRide && notes.trim()) {
          await AsyncStorage.setItem(
            `nextRideNote_${user.id}_${sessionData.horse?.id || "no_horse"}`,
            JSON.stringify({
              note: notes.trim(),
              timestamp: Date.now(),
              shown: false,
            })
          );
        }

        // Show different message based on sync status
        const message = result.isPending
          ? "Session saved locally. It will sync to cloud when WiFi is available."
          : "Session saved successfully!";

        const title = result.isPending ? "Saved Locally" : "Success";

        Alert.alert(title, message, [
          {
            text: "OK",
            onPress: () => {
              // Navigate to calendar instead of sessions
              router.replace("/calendar");
            },
          },
        ]);
      } else {
        Alert.alert("Error", result.error || "Failed to save session");
        setIsSaving(false);
      }
    } catch (error) {
      console.error("Error saving session:", error);
      Alert.alert("Error", "An unexpected error occurred");
      setIsSaving(false);
    }
  };

  if (!sessionData) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: currentTheme.colors.background },
        ]}
      >
        <Text style={{ color: currentTheme.colors.text }}>
          No session data found
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: currentTheme.colors.background },
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
            onPress={() => {
              Alert.alert(
                "Discard Session?",
                "Are you sure you want to discard this session? All data will be lost.",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Discard",
                    style: "destructive",
                    onPress: () => router.replace("/(tabs)/map"),
                  },
                ]
              );
            }}
          >
            <Image
              source={require("../assets/in_app_icons/back.png")}
              style={styles.backIcon}
            />
          </TouchableOpacity>
          <Text style={styles.header}>Session Summary</Text>
        </View>
      </SafeAreaView>

      <ScrollView
        style={[
          styles.viewPort,
          { backgroundColor: currentTheme.colors.background },
        ]}
      >
        <View style={styles.contentContainer}>
          {/* Map Preview */}
          <View style={styles.section}>
            <Text
              style={[styles.sectionTitle, { color: currentTheme.colors.text }]}
            >
              Route Preview
            </Text>
            <View style={styles.mapContainer}>
              <MapView
                style={styles.map}
                provider={Platform.OS === "ios" ? undefined : PROVIDER_GOOGLE}
                region={getMapRegion()}
                scrollEnabled={false}
                zoomEnabled={false}
                pitchEnabled={false}
                rotateEnabled={false}
              >
                {trimmedData.path.length > 1 && (
                  <Polyline
                    coordinates={trimmedData.path.map((p: TrackingPoint) => ({
                      latitude: p.latitude,
                      longitude: p.longitude,
                    }))}
                    strokeColor={currentTheme.colors.primary}
                    strokeWidth={4}
                  />
                )}
              </MapView>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text
                  style={[
                    styles.statLabel,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  Duration
                </Text>
                <Text
                  style={[
                    styles.statValue,
                    { color: currentTheme.colors.text },
                  ]}
                >
                  {formatDuration(trimmedData.duration)}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text
                  style={[
                    styles.statLabel,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  Distance
                </Text>
                <Text
                  style={[
                    styles.statValue,
                    { color: currentTheme.colors.text },
                  ]}
                >
                  {formatDistance(trimmedData.distance)}
                </Text>
              </View>
            </View>
          </View>

          {/* Trimming Controls */}
          <View style={styles.section}>
            <Text
              style={[styles.sectionTitle, { color: currentTheme.colors.text }]}
            >
              Trim Session
            </Text>
            <Text
              style={[
                styles.sectionDescription,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              Adjust the sliders to trim unwanted parts from the beginning and
              end of your session
            </Text>

            <View style={styles.trimControl}>
              <Text
                style={[styles.trimLabel, { color: currentTheme.colors.text }]}
              >
                Start Point
              </Text>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={Math.max(sessionData.path.length - 1, 0)}
                value={trimStartIndex}
                onValueChange={(value) => {
                  const newValue = Math.floor(value);
                  if (newValue < trimEndIndex) {
                    setTrimStartIndex(newValue);
                  }
                }}
                minimumTrackTintColor={currentTheme.colors.primary}
                maximumTrackTintColor={currentTheme.colors.accent}
                thumbTintColor={currentTheme.colors.primary}
                step={1}
              />
              <Text
                style={[
                  styles.trimValue,
                  { color: currentTheme.colors.textSecondary },
                ]}
              >
                Point {trimStartIndex + 1} / {sessionData.path.length}
              </Text>
            </View>

            <View style={styles.trimControl}>
              <Text
                style={[styles.trimLabel, { color: currentTheme.colors.text }]}
              >
                End Point
              </Text>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={Math.max(sessionData.path.length - 1, 0)}
                value={trimEndIndex}
                onValueChange={(value) => {
                  const newValue = Math.floor(value);
                  if (newValue > trimStartIndex) {
                    setTrimEndIndex(newValue);
                  }
                }}
                minimumTrackTintColor={currentTheme.colors.primary}
                maximumTrackTintColor={currentTheme.colors.accent}
                thumbTintColor={currentTheme.colors.primary}
                step={1}
              />
              <Text
                style={[
                  styles.trimValue,
                  { color: currentTheme.colors.textSecondary },
                ]}
              >
                Point {trimEndIndex + 1} / {sessionData.path.length}
              </Text>
            </View>
          </View>

          {/* Performance Ratings */}
          <View style={styles.section}>
            <Text
              style={[styles.sectionTitle, { color: currentTheme.colors.text }]}
            >
              Rider Performance
            </Text>
            <View style={styles.ratingContainer}>
              <Text
                style={[
                  styles.ratingValue,
                  { color: currentTheme.colors.primary },
                ]}
              >
                {riderPerformance}/10
              </Text>
              <Slider
                style={styles.slider}
                minimumValue={1}
                maximumValue={10}
                value={riderPerformance}
                onValueChange={(value) =>
                  setRiderPerformance(Math.round(value))
                }
                minimumTrackTintColor={currentTheme.colors.primary}
                maximumTrackTintColor={currentTheme.colors.accent}
                thumbTintColor={currentTheme.colors.primary}
                step={1}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text
              style={[styles.sectionTitle, { color: currentTheme.colors.text }]}
            >
              Horse Performance
            </Text>
            <View style={styles.ratingContainer}>
              <Text
                style={[
                  styles.ratingValue,
                  { color: currentTheme.colors.primary },
                ]}
              >
                {horsePerformance}/10
              </Text>
              <Slider
                style={styles.slider}
                minimumValue={1}
                maximumValue={10}
                value={horsePerformance}
                onValueChange={(value) =>
                  setHorsePerformance(Math.round(value))
                }
                minimumTrackTintColor={currentTheme.colors.primary}
                maximumTrackTintColor={currentTheme.colors.accent}
                thumbTintColor={currentTheme.colors.primary}
                step={1}
              />
            </View>
          </View>

          {/* Ground Type */}
          <View style={styles.section}>
            <Text
              style={[styles.sectionTitle, { color: currentTheme.colors.text }]}
            >
              Ground Type
            </Text>
            <View style={styles.groundTypeContainer}>
              {groundTypes.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.groundTypeButton,
                    {
                      backgroundColor:
                        groundType === type
                          ? currentTheme.colors.primary
                          : currentTheme.colors.surface,
                      borderColor: currentTheme.colors.accent,
                    },
                  ]}
                  onPress={() => setGroundType(type)}
                >
                  <Text
                    style={[
                      styles.groundTypeText,
                      {
                        color:
                          groundType === type
                            ? "#fff"
                            : currentTheme.colors.text,
                      },
                    ]}
                  >
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Notes */}
          <View style={styles.section}>
            <Text
              style={[styles.sectionTitle, { color: currentTheme.colors.text }]}
            >
              Notes for Next Ride
            </Text>
            <TextInput
              style={[
                styles.notesInput,
                {
                  backgroundColor: currentTheme.colors.surface,
                  color: currentTheme.colors.text,
                  borderColor: currentTheme.colors.accent,
                },
              ]}
              placeholder="Add notes for your next ride..."
              placeholderTextColor={currentTheme.colors.textSecondary}
              multiline
              numberOfLines={4}
              value={notes}
              onChangeText={setNotes}
            />
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => setShowNotesNextRide(!showNotesNextRide)}
            >
              <View
                style={[
                  styles.checkbox,
                  {
                    borderColor: currentTheme.colors.accent,
                    backgroundColor: showNotesNextRide
                      ? currentTheme.colors.primary
                      : "transparent",
                  },
                ]}
              >
                {showNotesNextRide && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text
                style={[
                  styles.checkboxLabel,
                  { color: currentTheme.colors.text },
                ]}
              >
                Show this note before the next ride
              </Text>
            </TouchableOpacity>
          </View>

          {/* Finish Button */}
          <TouchableOpacity
            style={[
              styles.finishButton,
              { backgroundColor: currentTheme.colors.primary },
              isSaving && styles.finishButtonDisabled,
            ]}
            onPress={handleFinishSession}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.finishButtonText}>Finish Session</Text>
            )}
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
    marginBottom: Platform.OS === "ios" ? 10 : 0,
    marginTop: Platform.OS === "ios" ? -15 : -5,
  },
  header: {
    fontSize: 30,
    fontFamily: "Inder",
    color: "#fff",
    textAlign: "center",
    flex: 1,
    fontWeight: "600",
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
    tintColor: "#fff",
  },
  viewPort: {
    backgroundColor: "#FFFFFF",
    flex: 1,
    borderTopLeftRadius: 50,
    borderTopRightRadius: 50,
    marginTop: -45,
    paddingTop: 15,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 60,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Inder",
    fontWeight: "600",
    marginBottom: 10,
  },
  sectionDescription: {
    fontSize: 14,
    fontFamily: "Inder",
    marginBottom: 15,
    lineHeight: 20,
  },
  mapContainer: {
    height: 200,
    borderRadius: 15,
    overflow: "hidden",
    marginBottom: 10,
  },
  map: {
    flex: 1,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  statItem: {
    alignItems: "center",
  },
  statLabel: {
    fontSize: 12,
    fontFamily: "Inder",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontFamily: "Inder",
    fontWeight: "600",
  },
  trimControl: {
    marginBottom: 20,
  },
  trimLabel: {
    fontSize: 16,
    fontFamily: "Inder",
    fontWeight: "500",
    marginBottom: 8,
  },
  slider: {
    width: "100%",
    height: 40,
  },
  trimValue: {
    fontSize: 12,
    fontFamily: "Inder",
    textAlign: "center",
    marginTop: 4,
  },
  ratingContainer: {
    alignItems: "center",
  },
  ratingValue: {
    fontSize: 32,
    fontFamily: "Inder",
    fontWeight: "700",
    marginBottom: 10,
  },
  groundTypeContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  groundTypeButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 2,
    minWidth: "47%",
    alignItems: "center",
  },
  groundTypeText: {
    fontSize: 16,
    fontFamily: "Inder",
    fontWeight: "500",
  },
  notesInput: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    fontSize: 16,
    fontFamily: "Inder",
    textAlignVertical: "top",
    minHeight: 100,
    marginBottom: 10,
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 5,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  checkmark: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  checkboxLabel: {
    fontSize: 14,
    fontFamily: "Inder",
    flex: 1,
  },
  finishButton: {
    paddingVertical: 16,
    borderRadius: 15,
    alignItems: "center",
    marginTop: 10,
  },
  finishButtonDisabled: {
    opacity: 0.6,
  },
  finishButtonText: {
    color: "#fff",
    fontSize: 18,
    fontFamily: "Inder",
    fontWeight: "600",
  },
});

export default SessionSummaryScreen;
