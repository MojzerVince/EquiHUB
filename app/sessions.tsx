import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  PanResponder,
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
  media?: MediaItem[]; // Photos and videos taken during session
}

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

const SessionsScreen = () => {
  // Get current theme from context
  const { currentTheme } = useTheme();

  // Get the authenticated user
  const { user } = useAuth();

  // Get metric system utilities
  const { formatDistance, formatSpeed } = useMetric();

  const router = useRouter();
  const [trainingSessions, setTrainingSessions] = useState<TrainingSession[]>(
    []
  );
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0); // 0 = current week, -1 = last week, etc.
  const [showCalendar, setShowCalendar] = useState(false);
  const [earliestSessionDate, setEarliestSessionDate] = useState<Date | null>(
    null
  );

  // Get screen width for swipe gestures
  const screenWidth = Dimensions.get("window").width;

  // Get the start and end dates for a specific week offset
  const getWeekBounds = (weekOffset: number) => {
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay; // Calculate days to Monday

    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() + mondayOffset + weekOffset * 7);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    return { startOfWeek, endOfWeek };
  };

  // Calculate week offset from selected date
  const getWeekOffsetFromDate = (selectedDate: Date) => {
    const now = new Date();
    const currentDay = now.getDay();
    const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;

    const currentWeekStart = new Date(now);
    currentWeekStart.setDate(now.getDate() + mondayOffset);
    currentWeekStart.setHours(0, 0, 0, 0);

    const selectedDay = selectedDate.getDay();
    const selectedMondayOffset = selectedDay === 0 ? -6 : 1 - selectedDay;

    const selectedWeekStart = new Date(selectedDate);
    selectedWeekStart.setDate(selectedDate.getDate() + selectedMondayOffset);
    selectedWeekStart.setHours(0, 0, 0, 0);

    const timeDiff = selectedWeekStart.getTime() - currentWeekStart.getTime();
    const weeksDiff = Math.round(timeDiff / (7 * 24 * 60 * 60 * 1000));

    return weeksDiff;
  };

  // Format week display text
  const formatWeekDisplay = (weekOffset: number) => {
    if (weekOffset === 0) return "This Week";
    if (weekOffset === -1) return "Last Week";

    const { startOfWeek, endOfWeek } = getWeekBounds(weekOffset);
    const weekYear = startOfWeek.getFullYear();

    // Add year prefix with comma for weeks beyond last week
    const yearPrefix = `${weekYear}, `;

    const startMonth = startOfWeek.toLocaleDateString("en-US", {
      month: "short",
    });
    const endMonth = endOfWeek.toLocaleDateString("en-US", { month: "short" });
    const startDay = startOfWeek.getDate();
    const endDay = endOfWeek.getDate();

    if (startMonth === endMonth) {
      return `${yearPrefix}${startMonth} ${startDay}-${endDay}`;
    } else {
      return `${yearPrefix}${startMonth} ${startDay} - ${endMonth} ${endDay}`;
    }
  };

  // Pan responder for swipe gestures
  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      return (
        Math.abs(gestureState.dx) > Math.abs(gestureState.dy) &&
        Math.abs(gestureState.dx) > 20
      );
    },
    onPanResponderMove: (evt, gestureState) => {
      // Optional: Add visual feedback during swipe
    },
    onPanResponderRelease: (evt, gestureState) => {
      const swipeThreshold = screenWidth * 0.2; // 20% of screen width

      if (gestureState.dx > swipeThreshold) {
        // Swipe right - go to previous week (older)
        handlePreviousWeek();
      } else if (gestureState.dx < -swipeThreshold) {
        // Swipe left - go to next week (more recent)
        handleNextWeek();
      }
    },
  });

  // Handle navigation to previous week
  const handlePreviousWeek = () => {
    // Check if they can go further back based on earliest session data
    if (earliestSessionDate) {
      const earliestWeekOffset = getWeekOffsetFromDate(earliestSessionDate);
      if (currentWeekOffset <= earliestWeekOffset) {
        // Already at the earliest week with data
        return;
      }
    }

    setCurrentWeekOffset((prev) => prev - 1);
  };

  // Handle navigation to next week
  const handleNextWeek = () => {
    if (currentWeekOffset < 0) {
      setCurrentWeekOffset((prev) => prev + 1);
    }
  };

  // Handle calendar date selection
  const handleDateSelect = (selectedDate: Date) => {
    const weekOffset = getWeekOffsetFromDate(selectedDate);
    setCurrentWeekOffset(weekOffset);
    setShowCalendar(false);
  };

  // Find the earliest training session to determine calendar range
  const findEarliestSession = useCallback(async () => {
    try {
      const savedSessions = await AsyncStorage.getItem("training_sessions");
      if (savedSessions) {
        const parsedSessions: TrainingSession[] = JSON.parse(savedSessions);

        // Filter sessions for current user
        const userSessions = user?.id
          ? parsedSessions.filter((session) => session.userId === user.id)
          : parsedSessions;

        if (userSessions.length > 0) {
          // Find the earliest session
          const earliest = userSessions.reduce((earliest, session) =>
            session.startTime < earliest.startTime ? session : earliest
          );

          setEarliestSessionDate(new Date(earliest.startTime));
        } else {
          setEarliestSessionDate(null);
        }
      } else {
        setEarliestSessionDate(null);
      }
    } catch (error) {
      setEarliestSessionDate(null);
    }
  }, [user?.id]);

  // Calculate the number of weeks to show in calendar
  const getCalendarWeeksCount = () => {
    if (!earliestSessionDate) {
      return 4; // Default to 4 weeks if no sessions found
    }

    // Calculate weeks from earliest session to current week
    const earliestWeekOffset = getWeekOffsetFromDate(earliestSessionDate);
    const weeksCount = Math.abs(earliestWeekOffset) + 1; // +1 to include current week

    // Cap at reasonable maximum (e.g., 5 years = ~260 weeks)
    return Math.min(weeksCount, 260);
  };

  // Load training sessions from AsyncStorage
  const loadTrainingSessions = useCallback(async () => {
    try {
      setLoadingSessions(true);
      const savedSessions = await AsyncStorage.getItem("training_sessions");

      if (savedSessions) {
        const parsedSessions: TrainingSession[] = JSON.parse(savedSessions);

        // Filter sessions for current user if user ID is available
        const userSessions = user?.id
          ? parsedSessions.filter((session) => session.userId === user.id)
          : parsedSessions;

        // Filter sessions by week
        const { startOfWeek, endOfWeek } = getWeekBounds(currentWeekOffset);

        const weekSessions = userSessions.filter((session) => {
          const sessionDate = new Date(session.startTime);
          return sessionDate >= startOfWeek && sessionDate <= endOfWeek;
        });

        // Sort by start time (newest first)
        weekSessions.sort((a, b) => b.startTime - a.startTime);
        setTrainingSessions(weekSessions);
      } else {
        setTrainingSessions([]);
      }
    } catch (error) {
      setTrainingSessions([]);
    } finally {
      setLoadingSessions(false);
    }
  }, [currentWeekOffset, user?.id]);

  // Load training sessions when component mounts
  useEffect(() => {
    loadTrainingSessions();
    findEarliestSession();
  }, []);

  // Reload sessions when week changes
  useEffect(() => {
    loadTrainingSessions();
  }, [currentWeekOffset]);

  // Reload sessions when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      loadTrainingSessions();
      findEarliestSession();
    }, [])
  );

  const formatTrainingDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleDeleteTrainingSession = async (
    sessionId: string,
    sessionName: string
  ) => {
    Alert.alert(
      "Delete Training Session",
      `Are you sure you want to delete "${sessionName}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              // Remove from state
              const updatedSessions = trainingSessions.filter(
                (session) => session.id !== sessionId
              );
              setTrainingSessions(updatedSessions);

              // Update AsyncStorage
              await AsyncStorage.setItem(
                "training_sessions",
                JSON.stringify(updatedSessions)
              );
            } catch (error) {
              Alert.alert(
                "Error",
                "Failed to delete session. Please try again."
              );
            }
          },
        },
      ]
    );
  };

  const renderTrainingSession = ({ item }: { item: TrainingSession }) => (
    <TouchableOpacity
      style={[
        styles.sessionCard,
        { backgroundColor: currentTheme.colors.surface },
      ]}
      activeOpacity={0.85}
      onPress={() =>
        router.push({
          pathname: "/session-details",
          params: { sessionId: item.id },
        })
      }
    >
      <View style={styles.sessionHeader}>
        <View style={styles.sessionInfo}>
          <Text
            style={[styles.sessionTitle, { color: currentTheme.colors.text }]}
          >
            {item.trainingType}
          </Text>
          <Text
            style={[
              styles.sessionSubtitle,
              { color: currentTheme.colors.textSecondary },
            ]}
          >
            {item.horseName}
          </Text>
          <Text
            style={[
              styles.sessionDate,
              { color: currentTheme.colors.textSecondary },
            ]}
          >
            {formatDate(item.startTime)}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() =>
            handleDeleteTrainingSession(
              item.id,
              `${item.trainingType} with ${item.horseName}`
            )
          }
        >
          <Text style={styles.deleteButtonText}>🗑️</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text
            style={[
              styles.statLabel,
              { color: currentTheme.colors.textSecondary },
            ]}
          >
            Duration
          </Text>
          <Text style={[styles.statValue, { color: currentTheme.colors.text }]}>
            {item.duration ? formatTrainingDuration(item.duration) : "N/A"}
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
          <Text style={[styles.statValue, { color: currentTheme.colors.text }]}>
            {item.distance ? formatDistance(item.distance) : "N/A"}
          </Text>
        </View>

        <View style={styles.statItem}>
          <Text
            style={[
              styles.statLabel,
              { color: currentTheme.colors.textSecondary },
            ]}
          >
            Avg Speed
          </Text>
          <Text style={[styles.statValue, { color: currentTheme.colors.text }]}>
            {item.averageSpeed ? formatSpeed(item.averageSpeed) : "N/A"}
          </Text>
        </View>

        <View style={styles.statItem}>
          <Text
            style={[
              styles.statLabel,
              { color: currentTheme.colors.textSecondary },
            ]}
          >
            Max Speed
          </Text>
          <Text style={[styles.statValue, { color: currentTheme.colors.text }]}>
            {item.maxSpeed ? formatSpeed(item.maxSpeed) : "N/A"}
          </Text>
        </View>
      </View>

      {/* Media Gallery */}
      {item.media && item.media.length > 0 && (
        <View style={styles.mediaContainer}>
          <Text
            style={[styles.mediaTitle, { color: currentTheme.colors.text }]}
          >
            Session Media ({item.media.length})
          </Text>
          <ScrollView
            horizontal
            style={styles.mediaScrollView}
            showsHorizontalScrollIndicator={false}
          >
            {item.media.slice(0, 5).map((mediaItem, index) => (
              <TouchableOpacity
                key={mediaItem.id}
                style={styles.mediaItem}
                onPress={() => {
                  Alert.alert(
                    mediaItem.type === "photo" ? "Photo" : "Video",
                    `Captured at ${new Date(
                      mediaItem.timestamp
                    ).toLocaleTimeString()}`
                  );
                }}
              >
                <Image
                  source={{ uri: mediaItem.uri }}
                  style={styles.mediaThumbnail}
                  resizeMode="cover"
                />
                <View style={styles.mediaOverlay}>
                  <Text style={styles.mediaTypeIcon}>
                    {mediaItem.type === "photo" ? "📸" : "🎥"}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
            {item.media.length > 5 && (
              <View style={styles.moreMediaItem}>
                <View style={styles.moreMediaContainer}>
                  <Text style={styles.moreMediaText}>
                    +{item.media.length - 5}
                  </Text>
                  <Text style={styles.moreMediaSubtext}>more</Text>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      )}
    </TouchableOpacity>
  );

  if (loadingSessions) {
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
            <Text style={styles.header}>Training History</Text>
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
              Loading training sessions...
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
          <Text style={styles.header}>Training History</Text>
          <TouchableOpacity
            style={styles.calendarButton}
            onPress={() => setShowCalendar(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.calendarIcon}>📅</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <View
        style={[
          styles.content,
          { backgroundColor: currentTheme.colors.background },
        ]}
        {...panResponder.panHandlers}
      >
        {/* Week Navigation Header */}
        <View style={styles.weekNavigationContainer}>
          <TouchableOpacity
            style={[
              styles.weekNavButton,
              {
                backgroundColor: currentTheme.colors.surface,
                opacity:
                  earliestSessionDate &&
                  currentWeekOffset <=
                    getWeekOffsetFromDate(earliestSessionDate)
                    ? 0.5
                    : 1,
              },
            ]}
            onPress={handlePreviousWeek}
            disabled={
              !!earliestSessionDate &&
              currentWeekOffset <= getWeekOffsetFromDate(earliestSessionDate)
            }
          >
            <Text
              style={[styles.weekNavText, { color: currentTheme.colors.text }]}
            >
              ←
            </Text>
          </TouchableOpacity>

          <View style={styles.weekDisplayContainer}>
            <Text
              style={[
                styles.weekDisplayText,
                { color: currentTheme.colors.text },
              ]}
            >
              {formatWeekDisplay(currentWeekOffset)}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.weekNavButton,
              {
                backgroundColor: currentTheme.colors.surface,
                opacity: currentWeekOffset >= 0 ? 0.5 : 1,
              },
            ]}
            onPress={handleNextWeek}
            disabled={currentWeekOffset >= 0}
          >
            <Text
              style={[styles.weekNavText, { color: currentTheme.colors.text }]}
            >
              →
            </Text>
          </TouchableOpacity>
        </View>

        {loadingSessions ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator
              size="large"
              color={currentTheme.colors.primary}
            />
            <Text
              style={[
                styles.loadingText,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              Loading training sessions...
            </Text>
          </View>
        ) : trainingSessions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>📊</Text>
            <Text
              style={[styles.emptyText, { color: currentTheme.colors.text }]}
            >
              {currentWeekOffset === 0
                ? "No Training Sessions Yet"
                : "No recorded rides from this week."}
            </Text>
            {currentWeekOffset === 0 && (
              <>
                <Text
                  style={[
                    styles.emptySubtext,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  Start tracking your rides to see your training history here.
                </Text>
                <TouchableOpacity
                  style={[
                    styles.startButton,
                    { backgroundColor: currentTheme.colors.primary },
                  ]}
                  onPress={() => router.push("/(tabs)/map")}
                >
                  <Text style={styles.startButtonText}>Start Training</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        ) : (
          <>
            <View style={styles.summaryContainer}>
              <Text
                style={[
                  styles.summaryText,
                  { color: currentTheme.colors.textSecondary },
                ]}
              >
                {trainingSessions.length} training session
                {trainingSessions.length !== 1 ? "s" : ""}
              </Text>
            </View>

            <FlatList
              data={trainingSessions}
              renderItem={renderTrainingSession}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContainer}
            />
          </>
        )}

        {/* Pro Subscription Prompt Overlay - Removed since non-pro users can't access previous weeks */}
      </View>

      {/* Calendar Modal */}
      <Modal
        visible={showCalendar}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCalendar(false)}
      >
        <View style={styles.calendarOverlay}>
          <View
            style={[
              styles.calendarContainer,
              { backgroundColor: currentTheme.colors.surface },
            ]}
          >
            <View style={styles.calendarHeader}>
              <Text
                style={[
                  styles.calendarTitle,
                  { color: currentTheme.colors.text },
                ]}
              >
                Select Week
              </Text>
              <TouchableOpacity
                style={styles.calendarCloseButton}
                onPress={() => setShowCalendar(false)}
              >
                <Text
                  style={[
                    styles.calendarCloseText,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  ✕
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.calendarContent}>
              {/* Generate calendar weeks */}
              {Array.from({ length: getCalendarWeeksCount() }, (_, index) => {
                const weekOffset = -index;
                const { startOfWeek, endOfWeek } = getWeekBounds(weekOffset);
                const isCurrentWeek = weekOffset === 0;
                const isSelectedWeek = weekOffset === currentWeekOffset;

                return (
                  <TouchableOpacity
                    key={weekOffset}
                    style={[
                      styles.calendarWeekItem,
                      {
                        backgroundColor: isSelectedWeek
                          ? currentTheme.colors.primary
                          : isCurrentWeek
                          ? currentTheme.colors.accent + "20"
                          : "transparent",
                        borderBottomColor: currentTheme.colors.border,
                      },
                    ]}
                    onPress={() => handleDateSelect(startOfWeek)}
                  >
                    <View style={styles.calendarWeekInfo}>
                      <Text
                        style={[
                          styles.calendarWeekTitle,
                          {
                            color: isSelectedWeek
                              ? "#FFFFFF"
                              : currentTheme.colors.text,
                            fontWeight: isCurrentWeek ? "bold" : "normal",
                          },
                        ]}
                      >
                        {formatWeekDisplay(weekOffset)}
                      </Text>
                      <Text
                        style={[
                          styles.calendarWeekDate,
                          {
                            color: isSelectedWeek
                              ? "#FFFFFF"
                              : currentTheme.colors.textSecondary,
                          },
                        ]}
                      >
                        {startOfWeek.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}{" "}
                        -{" "}
                        {endOfWeek.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </Text>
                    </View>
                    {isCurrentWeek && (
                      <View style={styles.currentWeekBadge}>
                        <Text style={styles.currentWeekBadgeText}>Today</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    fontWeight: "600",
    flex: 1,
  },
  placeholder: {
    width: 40,
    height: 40,
  },
  calendarButton: {
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
  calendarIcon: {
    fontSize: 20,
    color: "#fff",
  },
  content: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 50,
    borderTopRightRadius: 50,
    marginTop: 5,
    paddingTop: 30,
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
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 24,
    fontFamily: "Inder",
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 10,
  },
  emptySubtext: {
    fontSize: 16,
    fontFamily: "Inder",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 30,
  },
  startButton: {
    backgroundColor: "#335C67",
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
  },
  startButtonText: {
    fontSize: 16,
    fontFamily: "Inder",
    color: "#FFFFFF",
    fontWeight: "600",
  },
  summaryContainer: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  summaryText: {
    fontSize: 14,
    fontFamily: "Inder",
    textAlign: "center",
    marginTop: -15,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  sessionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  sessionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 15,
  },
  sessionInfo: {
    flex: 1,
  },
  sessionTitle: {
    fontSize: 18,
    fontFamily: "Inder",
    fontWeight: "600",
    marginBottom: 4,
  },
  sessionSubtitle: {
    fontSize: 14,
    fontFamily: "Inder",
    marginBottom: 4,
  },
  sessionDate: {
    fontSize: 12,
    fontFamily: "Inder",
  },
  deleteButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "rgba(220, 53, 69, 0.1)",
  },
  deleteButtonText: {
    fontSize: 16,
  },
  statsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  statItem: {
    width: "48%",
    marginBottom: 10,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: "Inder",
    marginBottom: 4,
    textTransform: "uppercase",
    fontWeight: "500",
  },
  statValue: {
    fontSize: 16,
    fontFamily: "Inder",
    fontWeight: "600",
  },
  weekNavigationContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginTop: -10,
    marginBottom: 16,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
    marginHorizontal: 16,
  },
  weekNavButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  weekNavText: {
    fontSize: 18,
    fontWeight: "600",
  },
  weekDisplayContainer: {
    flex: 1,
    alignItems: "center",
    position: "relative",
  },
  weekDisplayText: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  proRequiredBadge: {
    position: "absolute",
    top: -8,
    right: -20,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  proRequiredText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  subscriptionOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  subscriptionPrompt: {
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    maxWidth: 320,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  subscriptionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 12,
  },
  subscriptionMessage: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  upgradeButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 25,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  upgradeButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  dismissButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  dismissButtonText: {
    fontSize: 14,
    textAlign: "center",
  },

  // Calendar Modal Styles
  calendarOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  calendarContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  calendarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 0, 0, 0.1)",
  },
  calendarTitle: {
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    flex: 1,
  },
  calendarCloseButton: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: "rgba(0, 0, 0, 0.1)",
  },
  calendarCloseText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  calendarContent: {
    maxHeight: 400,
  },
  calendarWeekItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  calendarWeekInfo: {
    flex: 1,
  },
  calendarWeekTitle: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 4,
  },
  calendarWeekDate: {
    fontSize: 14,
  },
  currentWeekBadge: {
    backgroundColor: "#4CAF50",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  currentWeekBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "bold",
  },

  // Media Gallery Styles
  mediaContainer: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
  mediaTitle: {
    fontSize: 14,
    fontFamily: "Inder",
    fontWeight: "600",
    marginBottom: 10,
  },
  mediaScrollView: {
    paddingVertical: 5,
  },
  mediaItem: {
    marginRight: 10,
    alignItems: "center",
  },
  mediaThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  mediaOverlay: {
    position: "absolute",
    top: 2,
    right: 2,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 6,
    padding: 2,
  },
  mediaTypeIcon: {
    fontSize: 12,
  },
  moreMediaItem: {
    marginRight: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  moreMediaContainer: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: "rgba(0, 0, 0, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderStyle: "dashed",
  },
  moreMediaText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#666",
  },
  moreMediaSubtext: {
    fontSize: 10,
    color: "#666",
  },
});

export default SessionsScreen;
