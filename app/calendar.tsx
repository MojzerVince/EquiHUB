import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import {
  PlannedSession,
  deletePlannedSession as deletePlannedSessionAPI,
  getPlannedSessions,
} from "../lib/plannedSessionAPI";

const CalendarScreen = () => {
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const [plannedSessions, setPlannedSessions] = useState<PlannedSession[]>([]);
  const [loading, setLoading] = useState(true);
  const screenWidth = Dimensions.get("window").width;

  // Get the start and end dates for a specific week offset
  const getWeekBounds = (weekOffset: number) => {
    const now = new Date();
    const currentDay = now.getDay();
    const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;

    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() + mondayOffset + weekOffset * 7);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    return { startOfWeek, endOfWeek };
  };

  // Format week display text
  const formatWeekDisplay = (weekOffset: number) => {
    if (weekOffset === 0) return "This Week";
    if (weekOffset === -1) return "Last Week";
    if (weekOffset === 1) return "Next Week";

    const { startOfWeek, endOfWeek } = getWeekBounds(weekOffset);
    const weekYear = startOfWeek.getFullYear();
    const yearPrefix = weekOffset < -1 ? `${weekYear}, ` : "";

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

  // Check if a week is in the past (before current week)
  const isWeekInPast = (weekOffset: number) => {
    return weekOffset < 0;
  };

  // Get day name
  const getDayName = (dayIndex: number): string => {
    const days = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ];
    return days[dayIndex];
  };

  // Get date for specific day in current week
  const getDateForDay = (dayIndex: number) => {
    const { startOfWeek } = getWeekBounds(currentWeekOffset);
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + dayIndex);
    return date;
  };

  // Format day display (e.g., "Mon 27")
  const formatDayDisplay = (dayIndex: number) => {
    const date = getDateForDay(dayIndex);
    const dayName = getDayName(dayIndex).substring(0, 3);
    const dayNumber = date.getDate();
    return { dayName, dayNumber, fullDate: date };
  };

  // Check if a day is today
  const isToday = (dayIndex: number) => {
    const date = getDateForDay(dayIndex);
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  // Load planned sessions
  const loadPlannedSessions = useCallback(async () => {
    try {
      setLoading(true);
      const { startOfWeek, endOfWeek } = getWeekBounds(currentWeekOffset);

      const result = await getPlannedSessions(startOfWeek, endOfWeek);

      if (result.success && result.data) {
        setPlannedSessions(result.data);
      } else {
        console.error("Error loading planned sessions:", result.error);
        setPlannedSessions([]);
      }
    } catch (error) {
      console.error("Error loading planned sessions:", error);
      setPlannedSessions([]);
    } finally {
      setLoading(false);
    }
  }, [currentWeekOffset, user?.id]);

  useEffect(() => {
    loadPlannedSessions();
  }, [loadPlannedSessions]);

  // Reload sessions when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadPlannedSessions();
    }, [loadPlannedSessions])
  );

  // Get sessions for specific day
  const getSessionsForDay = (dayIndex: number) => {
    const date = getDateForDay(dayIndex);
    return plannedSessions.filter((session) => {
      const sessionDate = new Date(session.plannedDate);
      return (
        sessionDate.getDate() === date.getDate() &&
        sessionDate.getMonth() === date.getMonth() &&
        sessionDate.getFullYear() === date.getFullYear()
      );
    });
  };

  // Delete session
  const handleDeleteSession = async (sessionId: string) => {
    Alert.alert(
      "Delete Planned Session",
      "Are you sure you want to delete this planned session?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const result = await deletePlannedSessionAPI(sessionId);
              if (result.success) {
                loadPlannedSessions();
              } else {
                throw new Error(result.error);
              }
            } catch (error) {
              console.error("Error deleting session:", error);
              Alert.alert("Error", "Failed to delete session");
            }
          },
        },
      ]
    );
  };

  // Pan responder for swipe gestures
  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      return (
        Math.abs(gestureState.dx) > Math.abs(gestureState.dy) &&
        Math.abs(gestureState.dx) > 20
      );
    },
    onPanResponderRelease: (evt, gestureState) => {
      const swipeThreshold = screenWidth * 0.2;

      if (gestureState.dx > swipeThreshold) {
        // Swipe right - previous week
        setCurrentWeekOffset((prev) => prev - 1);
      } else if (gestureState.dx < -swipeThreshold) {
        // Swipe left - next week
        setCurrentWeekOffset((prev) => prev + 1);
      }
    },
  });

  const renderDaySection = (dayIndex: number) => {
    const { dayName, dayNumber, fullDate } = formatDayDisplay(dayIndex);
    const daySessions = getSessionsForDay(dayIndex);
    const isTodayDay = isToday(dayIndex);

    return (
      <View
        key={dayIndex}
        style={[
          styles.daySection,
          {
            borderBottomColor: currentTheme.colors.border,
            backgroundColor: isTodayDay
              ? currentTheme.colors.accent + "10"
              : "transparent",
          },
        ]}
      >
        <View style={styles.dayHeader}>
          <View style={styles.dayInfo}>
            <Text
              style={[
                styles.dayName,
                {
                  color: isTodayDay
                    ? currentTheme.colors.primary
                    : currentTheme.colors.text,
                  fontWeight: isTodayDay ? "bold" : "600",
                },
              ]}
            >
              {dayName}
            </Text>
            <Text
              style={[
                styles.dayNumber,
                {
                  color: isTodayDay
                    ? currentTheme.colors.primary
                    : currentTheme.colors.textSecondary,
                },
              ]}
            >
              {dayNumber}
            </Text>
          </View>
          {isTodayDay && (
            <View
              style={[
                styles.todayBadge,
                { backgroundColor: currentTheme.colors.primary },
              ]}
            >
              <Text style={styles.todayBadgeText}>Today</Text>
            </View>
          )}
        </View>

        {/* Sessions for this day */}
        <View style={styles.daySessionsContainer}>
          {daySessions.length === 0 ? (
            <Text
              style={[
                styles.noSessionsText,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              No sessions planned
            </Text>
          ) : (
            daySessions.map((session) => (
              <TouchableOpacity
                key={session.id}
                style={[
                  styles.sessionItem,
                  { 
                    backgroundColor: currentTheme.colors.surface,
                    opacity: session.isCompleted ? 0.7 : 1,
                  },
                ]}
                onPress={() => {
                  Alert.alert(
                    session.title,
                    `${session.trainingType}\nHorse: ${session.horseName}\n${
                      session.description ? `\n${session.description}` : ""
                    }${session.isCompleted ? '\n\n✅ Completed' : ''}`
                  );
                }}
              >
                <View style={styles.sessionItemContent}>
                  {session.imageUrl && (
                    <Image
                      source={{ uri: session.imageUrl }}
                      style={styles.sessionImage}
                    />
                  )}
                  <View style={styles.sessionTextContainer}>
                    <View style={styles.sessionTitleRow}>
                      <Text
                        style={[
                          styles.sessionTitle,
                          { 
                            color: currentTheme.colors.text,
                            textDecorationLine: session.isCompleted ? 'line-through' : 'none',
                          },
                        ]}
                      >
                        {session.title}
                      </Text>
                      {session.isCompleted && (
                        <Text style={styles.completedIcon}>✅</Text>
                      )}
                    </View>
                    <Text
                      style={[
                        styles.sessionType,
                        { color: currentTheme.colors.textSecondary },
                      ]}
                    >
                      {session.trainingType} • {session.horseName}
                    </Text>
                    {session.reminderEnabled && (
                      <Text style={styles.reminderIcon}>🔔</Text>
                    )}
                    {session.repeatEnabled && (
                      <Text style={styles.repeatIcon}>🔁</Text>
                    )}
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.deleteSessionButton}
                  onPress={() => handleDeleteSession(session.id)}
                >
                  <Text style={styles.deleteSessionText}>🗑️</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))
          )}
        </View>
      </View>
    );
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
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Image
              source={require("../assets/in_app_icons/back.png")}
              style={styles.backIcon}
            />
          </TouchableOpacity>
          <Text style={styles.header}>Calendar</Text>
          <View style={styles.placeholder} />
        </View>
      </SafeAreaView>

      <View
        style={[
          styles.viewPort,
          { backgroundColor: currentTheme.colors.background },
        ]}
        {...panResponder.panHandlers}
      >
        {/* Week Navigation */}
        <View style={styles.weekNavigationContainer}>
          <TouchableOpacity
            style={[
              styles.weekNavButton,
              { backgroundColor: currentTheme.colors.surface },
            ]}
            onPress={() => setCurrentWeekOffset((prev) => prev - 1)}
          >
            <Image
              source={require("../assets/in_app_icons/arrow.png")}
              style={[styles.navIcon, { transform: [{ rotate: "180deg" }] }]}
            />
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
              { backgroundColor: currentTheme.colors.surface },
            ]}
            onPress={() => setCurrentWeekOffset((prev) => prev + 1)}
          >
            <Image
              source={require("../assets/in_app_icons/arrow.png")}
              style={styles.navIcon}
            />
          </TouchableOpacity>
        </View>

        {/* Week Days */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator
              size="large"
              color={currentTheme.colors.primary}
            />
          </View>
        ) : (
          <ScrollView
            style={styles.daysScrollView}
            showsVerticalScrollIndicator={false}
          >
            {[0, 1, 2, 3, 4, 5, 6].map((dayIndex) =>
              renderDaySection(dayIndex)
            )}
          </ScrollView>
        )}

        {/* Add Session Button - Only show for current and future weeks */}
        {!isWeekInPast(currentWeekOffset) && (
          <TouchableOpacity
            style={[
              styles.addButton,
              { backgroundColor: currentTheme.colors.primary },
            ]}
            onPress={() => {
              router.push({
                pathname: "/add-planned-session",
                params: { weekOffset: currentWeekOffset.toString() },
              });
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.addButtonText}>+</Text>
          </TouchableOpacity>
        )}
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
    width: 30,
    height: 30,
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
    width: 60,
  },
  viewPort: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 50,
    borderTopRightRadius: 50,
    marginTop: -8,
    paddingTop: 30,
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
  navIcon: {
    width: 30,
    height: 30,
  },
  weekDisplayContainer: {
    flex: 1,
    alignItems: "center",
  },
  weekDisplayText: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  daysScrollView: {
    flex: 1,
  },
  daySection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  dayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  dayInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  dayName: {
    fontSize: 18,
    fontWeight: "600",
    marginRight: 8,
  },
  dayNumber: {
    fontSize: 16,
  },
  todayBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  todayBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "bold",
  },
  daySessionsContainer: {
    paddingLeft: 8,
  },
  noSessionsText: {
    fontSize: 14,
    fontStyle: "italic",
    paddingVertical: 8,
  },
  sessionItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sessionItemContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  sessionImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
  },
  sessionTextContainer: {
    flex: 1,
  },
  sessionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  sessionTitle: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
  },
  completedIcon: {
    fontSize: 16,
    marginLeft: 8,
  },
  sessionType: {
    fontSize: 14,
  },
  reminderIcon: {
    fontSize: 12,
    position: "absolute",
    top: 0,
    right: 0,
  },
  repeatIcon: {
    fontSize: 12,
    position: "absolute",
    top: 0,
    right: 20,
  },
  deleteSessionButton: {
    padding: 8,
  },
  deleteSessionText: {
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  addButton: {
    position: "absolute",
    bottom: 30,
    right: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  addButtonText: {
    fontSize: 36,
    color: "#FFFFFF",
    fontWeight: "300",
  },
});

export default CalendarScreen;
