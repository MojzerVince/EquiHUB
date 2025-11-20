import AsyncStorage from "@react-native-async-storage/async-storage";
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
import { cancelSessionNotifications } from "../lib/plannedSessionNotifications";
import {
  TrackingSession,
  deletePendingSession,
  getPendingSessions,
  getSessionsForWeek,
  syncPendingSession,
} from "../lib/sessionAPI";
import * as vaccinationAPI from "../lib/vaccinationAPI";

const CalendarScreen = () => {
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const [plannedSessions, setPlannedSessions] = useState<PlannedSession[]>([]);
  const [vaccinations, setVaccinations] = useState<
    vaccinationAPI.VaccinationRecord[]
  >([]);
  const [completedSessions, setCompletedSessions] = useState<TrackingSession[]>(
    []
  );
  const [pendingSessions, setPendingSessions] = useState<TrackingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasHorses, setHasHorses] = useState(false);
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

      // Load planned sessions
      const sessionsResult = await getPlannedSessions(startOfWeek, endOfWeek);

      if (sessionsResult.success && sessionsResult.data) {
        setPlannedSessions(sessionsResult.data);
      } else {
        console.error("Error loading planned sessions:", sessionsResult.error);
        setPlannedSessions([]);
      }

      // Load completed sessions
      if (user?.id) {
        const completedResult = await getSessionsForWeek(user.id, startOfWeek);
        if (completedResult.success && completedResult.sessions) {
          setCompletedSessions(completedResult.sessions);
        } else {
          console.error(
            "Error loading completed sessions:",
            completedResult.error
          );
          setCompletedSessions([]);
        }
      }

      // Load pending sessions (not yet synced to cloud)
      const pendingResult = await getPendingSessions();
      if (pendingResult.success && pendingResult.sessions) {
        // Filter pending sessions for current week
        const filteredPending = pendingResult.sessions.filter((session) => {
          const sessionDate = new Date(session.started_at);
          return sessionDate >= startOfWeek && sessionDate <= endOfWeek;
        });
        setPendingSessions(filteredPending);
      } else {
        console.error("Error loading pending sessions:", pendingResult.error);
        setPendingSessions([]);
      }

      // Load all vaccinations (we'll filter by date in the UI)
      // This is because we need to check both vaccination_date and next_due_date
      const vaccinationsResult = await vaccinationAPI.getUserVaccinations();

      if (vaccinationsResult.success && vaccinationsResult.data) {
        // Filter to only include vaccinations relevant to this week
        const filteredVaccinations = vaccinationsResult.data.filter(
          (vaccination) => {
            const vaccinationDate = new Date(vaccination.vaccinationDate);
            const nextDueDate = vaccination.nextDueDate
              ? new Date(vaccination.nextDueDate)
              : null;

            // Include if vaccination date is in range
            const vaccinationInRange =
              vaccinationDate >= startOfWeek && vaccinationDate <= endOfWeek;

            // Include if next due date is in range
            const nextDueInRange =
              nextDueDate &&
              nextDueDate >= startOfWeek &&
              nextDueDate <= endOfWeek;

            return vaccinationInRange || nextDueInRange;
          }
        );

        setVaccinations(filteredVaccinations);
      } else {
        console.error("Error loading vaccinations:", vaccinationsResult.error);
        setVaccinations([]);
      }
    } catch (error) {
      console.error("Error loading calendar data:", error);
      setPlannedSessions([]);
      setVaccinations([]);
    } finally {
      setLoading(false);
    }
  }, [currentWeekOffset, user?.id]);

  // Check if user has horses in local storage
  const checkHorses = useCallback(async () => {
    try {
      if (!user?.id) {
        setHasHorses(false);
        return;
      }

      const cachedHorses = await AsyncStorage.getItem(`user_horses_${user.id}`);
      if (cachedHorses) {
        const horses = JSON.parse(cachedHorses);
        setHasHorses(horses.length > 0);
      } else {
        setHasHorses(false);
      }
    } catch (error) {
      console.error("Error checking horses:", error);
      setHasHorses(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadPlannedSessions();
    checkHorses();
  }, [loadPlannedSessions, checkHorses]);

  // Reload sessions and check horses when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadPlannedSessions();
      checkHorses();
    }, [loadPlannedSessions, checkHorses])
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

  // Get vaccinations for specific day
  const getVaccinationsForDay = (dayIndex: number) => {
    const date = getDateForDay(dayIndex);
    return vaccinations.filter((vaccination) => {
      // Check both vaccination date and next due date
      const vaccinationDate = new Date(vaccination.vaccinationDate);
      const nextDueDate = vaccination.nextDueDate
        ? new Date(vaccination.nextDueDate)
        : null;

      const matchesVaccinationDate =
        vaccinationDate.getDate() === date.getDate() &&
        vaccinationDate.getMonth() === date.getMonth() &&
        vaccinationDate.getFullYear() === date.getFullYear();

      const matchesNextDueDate =
        nextDueDate &&
        nextDueDate.getDate() === date.getDate() &&
        nextDueDate.getMonth() === date.getMonth() &&
        nextDueDate.getFullYear() === date.getFullYear();

      return matchesVaccinationDate || matchesNextDueDate;
    });
  };

  // Get completed sessions for specific day
  const getCompletedSessionsForDay = (dayIndex: number) => {
    const date = getDateForDay(dayIndex);
    return completedSessions.filter((session) => {
      const sessionDate = new Date(session.started_at);
      return (
        sessionDate.getDate() === date.getDate() &&
        sessionDate.getMonth() === date.getMonth() &&
        sessionDate.getFullYear() === date.getFullYear()
      );
    });
  };

  // Get pending sessions for specific day
  const getPendingSessionsForDay = (dayIndex: number) => {
    const date = getDateForDay(dayIndex);
    return pendingSessions.filter((session) => {
      const sessionDate = new Date(session.started_at);
      return (
        sessionDate.getDate() === date.getDate() &&
        sessionDate.getMonth() === date.getMonth() &&
        sessionDate.getFullYear() === date.getFullYear()
      );
    });
  };

  // Handle syncing a pending session
  const handleSyncSession = async (localId: string) => {
    Alert.alert(
      "Sync Session",
      "This will upload the session to the cloud. Make sure you have a WiFi connection for best results.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sync Now",
          onPress: async () => {
            try {
              const result = await syncPendingSession(localId);
              if (result.success) {
                Alert.alert("Success", "Session synced successfully!");
                loadPlannedSessions(); // Reload to update UI
              } else {
                Alert.alert(
                  "Sync Failed",
                  result.error ||
                    "Failed to sync session. Please check your WiFi connection."
                );
              }
            } catch (error) {
              console.error("Error syncing session:", error);
              Alert.alert("Error", "An unexpected error occurred");
            }
          },
        },
      ]
    );
  };

  // Handle deleting a pending session
  const handleDeletePendingSession = async (localId: string) => {
    Alert.alert(
      "Delete Local Session",
      "Are you sure you want to delete this locally saved session? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const result = await deletePendingSession(localId);
              if (result.success) {
                loadPlannedSessions(); // Reload to update UI
              } else {
                Alert.alert(
                  "Error",
                  result.error || "Failed to delete session"
                );
              }
            } catch (error) {
              console.error("Error deleting pending session:", error);
              Alert.alert("Error", "An unexpected error occurred");
            }
          },
        },
      ]
    );
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
              // Cancel all scheduled notifications for this session
              await cancelSessionNotifications(sessionId);

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
    const dayVaccinations = getVaccinationsForDay(dayIndex);
    const dayCompletedSessions = getCompletedSessionsForDay(dayIndex);
    const dayPendingSessions = getPendingSessionsForDay(dayIndex);
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

        {/* Sessions and Vaccinations for this day */}
        <View style={styles.daySessionsContainer}>
          {daySessions.length === 0 &&
          dayVaccinations.length === 0 &&
          dayCompletedSessions.length === 0 &&
          dayPendingSessions.length === 0 ? (
            <Text
              style={[
                styles.noSessionsText,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              No sessions or vaccinations
            </Text>
          ) : (
            <>
              {/* Render Sessions */}
              {daySessions.map((session) => (
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
                      }${session.isCompleted ? "\n\n✅ Completed" : ""}`
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
                              textDecorationLine: session.isCompleted
                                ? "line-through"
                                : "none",
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
              ))}

              {/* Render Completed Sessions */}
              {dayCompletedSessions.map((session) => {
                return (
                  <TouchableOpacity
                    key={session.id}
                    style={[
                      styles.completedSessionItem,
                      { backgroundColor: currentTheme.colors.surface + "80" },
                    ]}
                    onPress={() => {
                      router.push({
                        pathname: "/session-details",
                        params: { sessionId: session.id },
                      });
                    }}
                  >
                    <View style={styles.completedSessionContent}>
                      <Image
                        source={require("../assets/in_app_icons/diary.png")}
                        style={styles.completedSessionIcon}
                      />
                      <View style={styles.completedSessionTextContainer}>
                        <Text
                          style={[
                            styles.completedSessionTitle,
                            { color: currentTheme.colors.text },
                          ]}
                        >
                          {session.training_type}
                        </Text>
                        <Text
                          style={[
                            styles.completedSessionType,
                            { color: currentTheme.colors.textSecondary },
                          ]}
                        >
                          {session.horse_name || "No horse"} •{" "}
                          {(session.distance_meters / 1000).toFixed(2)} km •{" "}
                          {Math.floor(session.duration_seconds / 60)} min
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}

              {/* Render Vaccinations */}
              {dayVaccinations.map((vaccination) => {
                const date = getDateForDay(dayIndex);
                const nextDueDate = vaccination.nextDueDate
                  ? new Date(vaccination.nextDueDate)
                  : null;
                const isDueDate =
                  nextDueDate &&
                  nextDueDate.getDate() === date.getDate() &&
                  nextDueDate.getMonth() === date.getMonth() &&
                  nextDueDate.getFullYear() === date.getFullYear();

                return (
                  <TouchableOpacity
                    key={vaccination.id}
                    style={[
                      styles.vaccinationItem,
                      {
                        backgroundColor: isDueDate
                          ? currentTheme.colors.accent + "20"
                          : currentTheme.colors.surface + "80",
                      },
                    ]}
                    onPress={() => {
                      Alert.alert(
                        `💉 ${vaccination.vaccineName}`,
                        `Horse: ${vaccination.horseName}\n${
                          isDueDate
                            ? `Due Date: ${nextDueDate?.toLocaleDateString()}`
                            : `Vaccination Date: ${new Date(
                                vaccination.vaccinationDate
                              ).toLocaleDateString()}`
                        }${
                          vaccination.notes
                            ? `\n\nNotes: ${vaccination.notes}`
                            : ""
                        }${
                          vaccination.batchNumber
                            ? `\nBatch: ${vaccination.batchNumber}`
                            : ""
                        }${
                          vaccination.repeatEnabled
                            ? `\n\n🔁 Repeating every ${vaccination.repeatIntervalMonths} months`
                            : ""
                        }`
                      );
                    }}
                  >
                    <View style={styles.vaccinationContent}>
                      <Text style={styles.vaccinationIcon}>💉</Text>
                      <View style={styles.vaccinationTextContainer}>
                        <Text
                          style={[
                            styles.vaccinationTitle,
                            { color: currentTheme.colors.text },
                          ]}
                        >
                          {vaccination.vaccineName}
                        </Text>
                        <Text
                          style={[
                            styles.vaccinationType,
                            { color: currentTheme.colors.textSecondary },
                          ]}
                        >
                          {vaccination.horseName} •{" "}
                          {isDueDate ? "Due" : "Vaccination"}
                        </Text>
                        {vaccination.repeatEnabled && (
                          <Text style={styles.repeatIcon}>🔁</Text>
                        )}
                        {vaccination.reminderEnabled && (
                          <Text style={styles.reminderIcon}>🔔</Text>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}

              {/* Render Pending Sessions (Not Synced) */}
              {dayPendingSessions.map((session) => {
                return (
                  <View
                    key={session.localId}
                    style={[
                      styles.pendingSessionItem,
                      { backgroundColor: currentTheme.colors.surface },
                    ]}
                  >
                    <TouchableOpacity
                      style={styles.pendingSessionContent}
                      onPress={() => {
                        Alert.alert(
                          "⚠️ Pending Sync",
                          `${session.training_type}\n${
                            session.horse_name || "No horse"
                          } • ${(session.distance_meters / 1000).toFixed(
                            2
                          )} km • ${Math.floor(
                            session.duration_seconds / 60
                          )} min\n\nThis session hasn't been synced to the cloud yet. Tap the sync button to upload it when you have WiFi.`,
                          [{ text: "OK" }]
                        );
                      }}
                    >
                      <View style={styles.pendingSessionHeader}>
                        <Image
                          source={require("../assets/in_app_icons/diary.png")}
                          style={styles.pendingSessionIcon}
                        />
                        <View style={styles.pendingSessionTextContainer}>
                          <View style={styles.pendingSessionTitleRow}>
                            <Text
                              style={[
                                styles.pendingSessionTitle,
                                { color: currentTheme.colors.text },
                              ]}
                            >
                              {session.training_type}
                            </Text>
                            <View style={styles.pendingSyncBadge}>
                              <Text style={styles.pendingSyncIcon}>⚠️</Text>
                              <Text style={styles.pendingSyncText}>
                                Sync Needed
                              </Text>
                            </View>
                          </View>
                          <Text
                            style={[
                              styles.pendingSessionType,
                              { color: currentTheme.colors.textSecondary },
                            ]}
                          >
                            {session.horse_name || "No horse"} •{" "}
                            {(session.distance_meters / 1000).toFixed(2)} km •{" "}
                            {Math.floor(session.duration_seconds / 60)} min
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>

                    <View style={styles.pendingSessionActions}>
                      <TouchableOpacity
                        style={[
                          styles.syncButton,
                          { backgroundColor: currentTheme.colors.primary },
                        ]}
                        onPress={() => handleSyncSession(session.localId!)}
                      >
                        <Text style={styles.syncButtonIcon}>☁️</Text>
                        <Text style={styles.syncButtonText}>Sync</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.deletePendingButton}
                        onPress={() =>
                          handleDeletePendingSession(session.localId!)
                        }
                      >
                        <Text style={styles.deletePendingText}>🗑️</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </>
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

        {/* Add Session Button - Only show for current and future weeks and if user has horses */}
        {!isWeekInPast(currentWeekOffset) && (
          <TouchableOpacity
            style={[
              styles.addButton,
              {
                backgroundColor: hasHorses
                  ? currentTheme.colors.primary
                  : currentTheme.colors.textSecondary,
              },
            ]}
            onPress={() => {
              if (!hasHorses) {
                Alert.alert(
                  "No Horses Added",
                  "You need to add at least one horse before you can create calendar events. Would you like to add a horse now?",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Add Horse",
                      onPress: () => router.push("/(tabs)"),
                    },
                  ]
                );
                return;
              }

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
    marginBottom: Platform.OS === "ios" ? -20 : -45,
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
    width: 30,
    height: 30,
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
    paddingTop: 20,
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
  vaccinationItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.6,
    shadowRadius: 2,
    elevation: 2,
  },
  vaccinationContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  vaccinationIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  vaccinationTextContainer: {
    flex: 1,
  },
  vaccinationTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  vaccinationType: {
    fontSize: 14,
  },
  completedSessionItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 1,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  completedSessionContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  completedSessionIcon: {
    width: 24,
    height: 24,
    marginRight: 12,
    opacity: 0.7,
  },
  completedSessionTextContainer: {
    flex: 1,
  },
  completedSessionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  completedSessionType: {
    fontSize: 14,
  },
  pendingSessionItem: {
    flexDirection: "column",
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: "#FFA500",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  pendingSessionContent: {
    flex: 1,
  },
  pendingSessionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  pendingSessionIcon: {
    width: 24,
    height: 24,
    marginRight: 12,
    opacity: 0.7,
  },
  pendingSessionTextContainer: {
    flex: 1,
  },
  pendingSessionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  pendingSessionTitle: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
  },
  pendingSyncBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFA50020",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 8,
  },
  pendingSyncIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  pendingSyncText: {
    fontSize: 11,
    color: "#FFA500",
    fontWeight: "600",
  },
  pendingSessionType: {
    fontSize: 14,
  },
  pendingSessionActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(0, 0, 0, 0.1)",
  },
  syncButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginRight: 8,
  },
  syncButtonIcon: {
    fontSize: 16,
    marginRight: 4,
  },
  syncButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  deletePendingButton: {
    padding: 8,
  },
  deletePendingText: {
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  addButton: {
    position: "absolute",
    bottom: 60,
    right: 20,
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
    marginTop: -4,
  },
});

export default CalendarScreen;
