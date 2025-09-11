import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../contexts/AuthContext";
import { useMetric } from "../contexts/MetricContext";
import { useTheme } from "../contexts/ThemeContext";

// Training session interface to match map.tsx
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
  gaitAnalysis?: GaitAnalysis;
}

// Gait analysis interface
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

// Statistics interfaces
interface RiderStatistics {
  sessionCount: number;
  totalDuration: number; // in seconds
  totalDistance: number; // in meters
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
  averageSessionDuration: number;
  averageDistance: number;
  favoriteTrainingType?: string;
}

interface HorseStatistics {
  [horseId: string]: {
    horseName: string;
    sessionCount: number;
    totalDuration: number;
    totalDistance: number;
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
    averageSessionDuration: number;
    averageDistance: number;
    favoriteTrainingType?: string;
  };
}

type TimeRange = "weekly" | "monthly" | "yearly";
type ViewType = "rider" | "horse";

const StatisticsScreen = () => {
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const { formatDistance } = useMetric();
  const router = useRouter();

  // Duration formatting function
  const formatDuration = (seconds: number): string => {
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = Math.round(seconds % 60);
      return remainingSeconds > 0
        ? `${minutes}m ${remainingSeconds}s`
        : `${minutes}m`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
  };

  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewType, setViewType] = useState<ViewType>("rider");
  const [timeRange, setTimeRange] = useState<TimeRange>("weekly");
  const [selectedHorseId, setSelectedHorseId] = useState<string>("");
  const [availableHorses, setAvailableHorses] = useState<string[]>([]);

  const [riderStats, setRiderStats] = useState<RiderStatistics>({
    sessionCount: 0,
    totalDuration: 0,
    totalDistance: 0,
    gaitDurations: { walk: 0, trot: 0, canter: 0, gallop: 0, halt: 0 },
    gaitPercentages: { walk: 0, trot: 0, canter: 0, gallop: 0, halt: 0 },
    averageSessionDuration: 0,
    averageDistance: 0,
  });

  const [horseStats, setHorseStats] = useState<HorseStatistics>({});

  // Load sessions on component mount and when focused
  useFocusEffect(
    useCallback(() => {
      loadSessions();
    }, [user])
  );

  // Recalculate statistics when sessions, timeRange, or viewType changes
  useEffect(() => {
    if (sessions.length > 0) {
      calculateStatistics();
    }
  }, [sessions, timeRange, viewType]);

  const loadSessions = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const storedSessions = await AsyncStorage.getItem("training_sessions");
      if (storedSessions) {
        const allSessions: TrainingSession[] = JSON.parse(storedSessions);

        // Filter sessions for current user
        const userSessions = allSessions.filter(
          (session) => session.userId === user.id
        );

        setSessions(userSessions);

        // Extract unique horses from sessions
        const horses = [...new Set(userSessions.map((s) => s.horseId))];
        setAvailableHorses(horses);

        // Set first horse as default if none selected
        if (horses.length > 0 && !selectedHorseId) {
          setSelectedHorseId(horses[0]);
        }
      }
    } catch (error) {
      console.error("Error loading sessions:", error);
      Alert.alert("Error", "Failed to load session data");
    } finally {
      setLoading(false);
    }
  };

  const getFilteredSessions = (): TrainingSession[] => {
    const now = new Date();
    let startDate: Date;

    switch (timeRange) {
      case "weekly":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "monthly":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "yearly":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(0);
    }

    return sessions.filter((session) => {
      const sessionDate = new Date(session.startTime);
      return sessionDate >= startDate && sessionDate <= now;
    });
  };

  const calculateStatistics = () => {
    const filteredSessions = getFilteredSessions();

    if (viewType === "rider") {
      calculateRiderStatistics(filteredSessions);
    } else {
      calculateHorseStatistics(filteredSessions);
    }
  };

  const calculateRiderStatistics = (sessions: TrainingSession[]) => {
    if (sessions.length === 0) {
      setRiderStats({
        sessionCount: 0,
        totalDuration: 0,
        totalDistance: 0,
        gaitDurations: { walk: 0, trot: 0, canter: 0, gallop: 0, halt: 0 },
        gaitPercentages: { walk: 0, trot: 0, canter: 0, gallop: 0, halt: 0 },
        averageSessionDuration: 0,
        averageDistance: 0,
      });
      return;
    }

    const totalDuration = sessions.reduce(
      (sum, session) => sum + (session.duration || 0),
      0
    );
    const totalDistance = sessions.reduce(
      (sum, session) => sum + (session.distance || 0),
      0
    );

    const gaitDurations = { walk: 0, trot: 0, canter: 0, gallop: 0, halt: 0 };

    // Aggregate gait data from all sessions
    sessions.forEach((session) => {
      if (session.gaitAnalysis) {
        gaitDurations.walk += session.gaitAnalysis.gaitDurations.walk;
        gaitDurations.trot += session.gaitAnalysis.gaitDurations.trot;
        gaitDurations.canter += session.gaitAnalysis.gaitDurations.canter;
        gaitDurations.gallop += session.gaitAnalysis.gaitDurations.gallop;
        gaitDurations.halt += session.gaitAnalysis.gaitDurations.halt;
      }
    });

    const totalGaitDuration = Object.values(gaitDurations).reduce(
      (sum, dur) => sum + dur,
      0
    );
    const gaitPercentages = {
      walk:
        totalGaitDuration > 0
          ? (gaitDurations.walk / totalGaitDuration) * 100
          : 0,
      trot:
        totalGaitDuration > 0
          ? (gaitDurations.trot / totalGaitDuration) * 100
          : 0,
      canter:
        totalGaitDuration > 0
          ? (gaitDurations.canter / totalGaitDuration) * 100
          : 0,
      gallop:
        totalGaitDuration > 0
          ? (gaitDurations.gallop / totalGaitDuration) * 100
          : 0,
      halt:
        totalGaitDuration > 0
          ? (gaitDurations.halt / totalGaitDuration) * 100
          : 0,
    };

    // Find most common training type
    const trainingTypeCounts: { [key: string]: number } = {};
    sessions.forEach((session) => {
      trainingTypeCounts[session.trainingType] =
        (trainingTypeCounts[session.trainingType] || 0) + 1;
    });
    const favoriteTrainingType = Object.entries(trainingTypeCounts).reduce(
      (a, b) => (trainingTypeCounts[a[0]] > trainingTypeCounts[b[0]] ? a : b)
    )[0];

    setRiderStats({
      sessionCount: sessions.length,
      totalDuration,
      totalDistance,
      gaitDurations,
      gaitPercentages,
      averageSessionDuration:
        sessions.length > 0 ? totalDuration / sessions.length : 0,
      averageDistance:
        sessions.length > 0 ? totalDistance / sessions.length : 0,
      favoriteTrainingType,
    });
  };

  const calculateHorseStatistics = (sessions: TrainingSession[]) => {
    const statsMap: HorseStatistics = {};

    availableHorses.forEach((horseId) => {
      const horseSessions = sessions.filter((s) => s.horseId === horseId);

      if (horseSessions.length === 0) {
        return;
      }

      const totalDuration = horseSessions.reduce(
        (sum, session) => sum + (session.duration || 0),
        0
      );
      const totalDistance = horseSessions.reduce(
        (sum, session) => sum + (session.distance || 0),
        0
      );

      const gaitDurations = { walk: 0, trot: 0, canter: 0, gallop: 0, halt: 0 };

      horseSessions.forEach((session) => {
        if (session.gaitAnalysis) {
          gaitDurations.walk += session.gaitAnalysis.gaitDurations.walk;
          gaitDurations.trot += session.gaitAnalysis.gaitDurations.trot;
          gaitDurations.canter += session.gaitAnalysis.gaitDurations.canter;
          gaitDurations.gallop += session.gaitAnalysis.gaitDurations.gallop;
          gaitDurations.halt += session.gaitAnalysis.gaitDurations.halt;
        }
      });

      const totalGaitDuration = Object.values(gaitDurations).reduce(
        (sum, dur) => sum + dur,
        0
      );
      const gaitPercentages = {
        walk:
          totalGaitDuration > 0
            ? (gaitDurations.walk / totalGaitDuration) * 100
            : 0,
        trot:
          totalGaitDuration > 0
            ? (gaitDurations.trot / totalGaitDuration) * 100
            : 0,
        canter:
          totalGaitDuration > 0
            ? (gaitDurations.canter / totalGaitDuration) * 100
            : 0,
        gallop:
          totalGaitDuration > 0
            ? (gaitDurations.gallop / totalGaitDuration) * 100
            : 0,
        halt:
          totalGaitDuration > 0
            ? (gaitDurations.halt / totalGaitDuration) * 100
            : 0,
      };

      // Find most common training type for this horse
      const trainingTypeCounts: { [key: string]: number } = {};
      horseSessions.forEach((session) => {
        trainingTypeCounts[session.trainingType] =
          (trainingTypeCounts[session.trainingType] || 0) + 1;
      });
      const favoriteTrainingType =
        Object.keys(trainingTypeCounts).length > 0
          ? Object.entries(trainingTypeCounts).reduce((a, b) =>
              trainingTypeCounts[a[0]] > trainingTypeCounts[b[0]] ? a : b
            )[0]
          : undefined;

      statsMap[horseId] = {
        horseName: horseSessions[0].horseName,
        sessionCount: horseSessions.length,
        totalDuration,
        totalDistance,
        gaitDurations,
        gaitPercentages,
        averageSessionDuration: totalDuration / horseSessions.length,
        averageDistance: totalDistance / horseSessions.length,
        favoriteTrainingType,
      };
    });

    setHorseStats(statsMap);
  };

  const renderGaitBar = (gaitPercentages: { [key: string]: number }) => {
    const gaitColors = {
      walk: "#4CAF50", // Green
      trot: "#FF9800", // Orange
      canter: "#2196F3", // Blue
      gallop: "#9C27B0", // Purple
      halt: "#607D8B", // Blue Gray
    };

    return (
      <View style={styles.gaitBarContainer}>
        <View style={styles.gaitBar}>
          {Object.entries(gaitPercentages).map(
            ([gait, percentage]) =>
              percentage > 0 && (
                <View
                  key={gait}
                  style={[
                    styles.gaitSegment,
                    {
                      width: `${percentage}%`,
                      backgroundColor:
                        gaitColors[gait as keyof typeof gaitColors],
                    },
                  ]}
                />
              )
          )}
        </View>
        <View style={styles.gaitLegend}>
          {Object.entries(gaitPercentages).map(
            ([gait, percentage]) =>
              percentage > 0 && (
                <View key={gait} style={styles.gaitLegendItem}>
                  <View
                    style={[
                      styles.gaitColorDot,
                      {
                        backgroundColor:
                          gaitColors[gait as keyof typeof gaitColors],
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.gaitLegendText,
                      { color: currentTheme.colors.text },
                    ]}
                  >
                    {gait}: {percentage.toFixed(1)}%
                  </Text>
                </View>
              )
          )}
        </View>
      </View>
    );
  };

  const renderStatCard = (title: string, value: string, subtitle?: string) => (
    <View
      style={[
        styles.statCard,
        { backgroundColor: currentTheme.colors.surface },
      ]}
    >
      <Text
        style={[styles.statTitle, { color: currentTheme.colors.textSecondary }]}
      >
        {title}
      </Text>
      <Text style={[styles.statValue, { color: currentTheme.colors.text }]}>
        {value}
      </Text>
      {subtitle && (
        <Text
          style={[
            styles.statSubtitle,
            { color: currentTheme.colors.textSecondary },
          ]}
        >
          {subtitle}
        </Text>
      )}
    </View>
  );

  const getCurrentStats = () => {
    if (viewType === "rider") {
      return riderStats;
    } else {
      return selectedHorseId && horseStats[selectedHorseId]
        ? horseStats[selectedHorseId]
        : null;
    }
  };

  const currentStats = getCurrentStats();

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
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Image
                source={require("../assets/in_app_icons/back.png")}
                style={styles.backIcon}
              />
            </TouchableOpacity>
            <Text style={styles.header}>Statistics</Text>
            <View style={styles.placeholder} />
          </View>
          <View
            style={[
              styles.loadingContainer,
              { backgroundColor: currentTheme.colors.background },
            ]}
          >
            <ActivityIndicator
              size="large"
              color={currentTheme.colors.primary}
            />
            <Text
              style={[styles.loadingText, { color: currentTheme.colors.text }]}
            >
              Loading statistics...
            </Text>
          </View>
        </SafeAreaView>
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
          styles.container,
          { backgroundColor: currentTheme.colors.primary },
        ]}
      >
        <View style={styles.headerContainer}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Image
              source={require("../assets/in_app_icons/back.png")}
              style={styles.backIcon}
            />
          </TouchableOpacity>
          <Text style={styles.header}>Statistics</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView
          style={[
            styles.content,
            { backgroundColor: currentTheme.colors.background },
          ]}
        >
          {/* View Type Selector */}
          <View style={styles.tabWrapper}>
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[
                  styles.tabButton,
                  viewType === "rider" && {
                    backgroundColor: currentTheme.colors.primary,
                  },
                ]}
                onPress={() => setViewType("rider")}
              >
                <Text
                  style={[
                    styles.tabText,
                    {
                      color:
                        viewType === "rider"
                          ? currentTheme.colors.surface
                          : currentTheme.colors.textSecondary,
                    },
                  ]}
                >
                  Rider Stats
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.tabButton,
                  viewType === "horse" && {
                    backgroundColor: currentTheme.colors.primary,
                  },
                ]}
                onPress={() => setViewType("horse")}
              >
                <Text
                  style={[
                    styles.tabText,
                    {
                      color:
                        viewType === "horse"
                          ? currentTheme.colors.surface
                          : currentTheme.colors.textSecondary,
                    },
                  ]}
                >
                  Horse Stats
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Time Range Selector */}
          <View style={styles.tabWrapper}>
            <View style={styles.tabContainer}>
              {(["weekly", "monthly", "yearly"] as TimeRange[]).map((range) => (
                <TouchableOpacity
                  key={range}
                  style={[
                    styles.tabButton,
                    timeRange === range && {
                      backgroundColor: currentTheme.colors.primary,
                    },
                  ]}
                  onPress={() => setTimeRange(range)}
                >
                  <Text
                    style={[
                      styles.tabText,
                      {
                        color:
                          timeRange === range
                            ? currentTheme.colors.surface
                            : currentTheme.colors.textSecondary,
                      },
                    ]}
                  >
                    {range.charAt(0).toUpperCase() + range.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Horse Selector (if viewing horse stats) */}
          {viewType === "horse" && availableHorses.length > 0 && (
            <View style={styles.horseSelectorContainer}>
              <Text
                style={[
                  styles.horseSelectorTitle,
                  { color: currentTheme.colors.text },
                ]}
              >
                Select Horse:
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {availableHorses.map((horseId) => {
                  const horseName =
                    sessions.find((s) => s.horseId === horseId)?.horseName ||
                    horseId;
                  return (
                    <TouchableOpacity
                      key={horseId}
                      style={[
                        styles.horseSelectButton,
                        selectedHorseId === horseId && {
                          backgroundColor: currentTheme.colors.accent,
                        },
                        { borderColor: currentTheme.colors.border },
                      ]}
                      onPress={() => setSelectedHorseId(horseId)}
                    >
                      <Text
                        style={[
                          styles.horseSelectText,
                          {
                            color:
                              selectedHorseId === horseId
                                ? currentTheme.colors.surface
                                : currentTheme.colors.text,
                          },
                        ]}
                      >
                        {horseName}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Statistics Display */}
          {currentStats ? (
            <>
              {/* Main Stats Cards */}
              <View style={styles.statsGrid}>
                {renderStatCard(
                  "Sessions",
                  currentStats.sessionCount.toString(),
                  `${timeRange} total`
                )}
                {renderStatCard(
                  "Time Tracked",
                  formatDuration(currentStats.totalDuration),
                  `Avg: ${formatDuration(currentStats.averageSessionDuration)}`
                )}
                {renderStatCard(
                  "Distance",
                  formatDistance(currentStats.totalDistance),
                  `Avg: ${formatDistance(currentStats.averageDistance)}`
                )}
              </View>

              {/* Gait Analysis */}
              <View
                style={[
                  styles.gaitSection,
                  { backgroundColor: currentTheme.colors.surface },
                ]}
              >
                <Text
                  style={[
                    styles.sectionTitle,
                    { color: currentTheme.colors.text },
                  ]}
                >
                  Gait Distribution
                </Text>
                {renderGaitBar(currentStats.gaitPercentages)}

                {/* Gait Duration Details */}
                <View style={styles.gaitDetailsContainer}>
                  {Object.entries(currentStats.gaitDurations).map(
                    ([gait, duration]) =>
                      duration > 0 && (
                        <View key={gait} style={styles.gaitDetailItem}>
                          <Text
                            style={[
                              styles.gaitDetailLabel,
                              { color: currentTheme.colors.textSecondary },
                            ]}
                          >
                            {gait.charAt(0).toUpperCase() + gait.slice(1)}:
                          </Text>
                          <Text
                            style={[
                              styles.gaitDetailValue,
                              { color: currentTheme.colors.text },
                            ]}
                          >
                            {formatDuration(duration)}
                          </Text>
                        </View>
                      )
                  )}
                </View>
              </View>

              {/* Additional Stats */}
              {currentStats.favoriteTrainingType && (
                <View
                  style={[
                    styles.additionalStatsCard,
                    { backgroundColor: currentTheme.colors.surface },
                  ]}
                >
                  <Text
                    style={[
                      styles.sectionTitle,
                      { color: currentTheme.colors.text },
                    ]}
                  >
                    Favorite Training Type
                  </Text>
                  <Text
                    style={[
                      styles.favoriteTrainingType,
                      { color: currentTheme.colors.primary },
                    ]}
                  >
                    {currentStats.favoriteTrainingType}
                  </Text>
                </View>
              )}
            </>
          ) : (
            <View style={styles.noDataContainer}>
              <Text
                style={[
                  styles.noDataText,
                  { color: currentTheme.colors.textSecondary },
                ]}
              >
                No data available for the selected {timeRange} period
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
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
    paddingHorizontal: 20,
    marginBottom: -10,
    marginTop: -12,
  },
  backButton: {
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
    fontWeight: 600,
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
    paddingHorizontal: 30,
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
  tabWrapper: {
    paddingTop: 0,
    zIndex: 10,
    marginVertical: 8,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#F8F9FA",
    borderRadius: 25,
    width: "92%",
    alignSelf: "center",
    padding: 5,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  tabText: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inder",
  },
  horseSelectorContainer: {
    marginVertical: 15,
  },
  horseSelectorTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 10,
  },
  horseSelectButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 20,
    marginRight: 10,
  },
  horseSelectText: {
    fontSize: 14,
    fontWeight: "500",
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 15,
  },
  statCard: {
    flex: 1,
    padding: 15,
    marginHorizontal: 3,
    borderRadius: 12,
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statTitle: {
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 5,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 2,
  },
  statSubtitle: {
    fontSize: 10,
    fontWeight: "400",
  },
  gaitSection: {
    marginVertical: 15,
    padding: 20,
    borderRadius: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
  },
  gaitBarContainer: {
    marginBottom: 20,
  },
  gaitBar: {
    height: 12,
    flexDirection: "row",
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: 10,
  },
  gaitSegment: {
    height: "100%",
  },
  gaitLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  gaitLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 2,
  },
  gaitColorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  gaitLegendText: {
    fontSize: 12,
    fontWeight: "500",
  },
  gaitDetailsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  gaitDetailItem: {
    width: "48%",
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 3,
  },
  gaitDetailLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  gaitDetailValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  additionalStatsCard: {
    marginVertical: 15,
    padding: 20,
    borderRadius: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  favoriteTrainingType: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  noDataContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 50,
  },
  noDataText: {
    fontSize: 16,
    textAlign: "center",
  },
});

export default StatisticsScreen;
