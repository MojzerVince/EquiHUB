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
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { supabase } from "../lib/supabase";

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
}

const SessionsScreen = () => {
  // Get current theme from context
  const { currentTheme } = useTheme();

  // Get the authenticated user
  const { user } = useAuth();

  const router = useRouter();
  const [trainingSessions, setTrainingSessions] = useState<TrainingSession[]>(
    []
  );
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0); // 0 = current week, -1 = last week, etc.
  const [isProMember, setIsProMember] = useState(false);
  const [checkingProStatus, setCheckingProStatus] = useState(false);
  const [showProBrief, setShowProBrief] = useState(false);

  // Get screen width for swipe gestures
  const screenWidth = Dimensions.get("window").width;

  // Check if user is a pro member
  const checkProMembership = useCallback(async () => {
    if (!user?.id) {
      setIsProMember(false);
      return;
    }

    try {
      setCheckingProStatus(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("is_pro_member")
        .eq("id", user.id)
        .single();

      if (error) {
        setIsProMember(false);
      } else {
        const proStatus = data?.is_pro_member || false;
        setIsProMember(proStatus);

        // If user is not pro and viewing previous weeks, reset to current week
        if (!proStatus && currentWeekOffset < 0) {
          setCurrentWeekOffset(0);
        }
      }
    } catch (error) {
      setIsProMember(false);
      // If error occurred and user is viewing previous weeks, reset to current week
      if (currentWeekOffset < 0) {
        setCurrentWeekOffset(0);
      }
    } finally {
      setCheckingProStatus(false);
    }
  }, [user?.id]);

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

  // Format week display text
  const formatWeekDisplay = (weekOffset: number) => {
    if (weekOffset === 0) return "This Week";
    if (weekOffset === -1) return "Last Week";

    const { startOfWeek, endOfWeek } = getWeekBounds(weekOffset);
    const startMonth = startOfWeek.toLocaleDateString("en-US", {
      month: "short",
    });
    const endMonth = endOfWeek.toLocaleDateString("en-US", { month: "short" });
    const startDay = startOfWeek.getDate();
    const endDay = endOfWeek.getDate();

    if (startMonth === endMonth) {
      return `${startMonth} ${startDay}-${endDay}`;
    } else {
      return `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
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
    if (!isProMember && currentWeekOffset === 0) {
      // Non-pro user trying to access last week - show brief
      setShowProBrief(true);
      return;
    }
    setCurrentWeekOffset((prev) => prev - 1);
  };

  // Handle navigation to next week
  const handleNextWeek = () => {
    if (currentWeekOffset < 0) {
      setCurrentWeekOffset((prev) => prev + 1);
    }
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
    checkProMembership();
  }, []);

  // Reload sessions when week changes
  useEffect(() => {
    loadTrainingSessions();
  }, [currentWeekOffset]);

  // Reload sessions when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      loadTrainingSessions();
      checkProMembership(); // Also refresh pro status when screen is focused
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
            {item.distance ? `${(item.distance / 1000).toFixed(2)} km` : "N/A"}
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
            {item.averageSpeed
              ? `${(item.averageSpeed * 3.6).toFixed(1)} km/h`
              : "N/A"}
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
            {item.maxSpeed ? `${(item.maxSpeed * 3.6).toFixed(1)} km/h` : "N/A"}
          </Text>
        </View>
      </View>
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
              source={require("../assets/UI_resources/UI_white/arrow_white.png")}
              style={styles.backIcon}
            />
          </TouchableOpacity>
          <Text style={styles.header}>Training History</Text>
          <View style={styles.placeholder} />
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
                opacity: !isProMember && currentWeekOffset === 0 ? 0.5 : 1,
              },
            ]}
            onPress={handlePreviousWeek}
            disabled={!isProMember && currentWeekOffset === 0}
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
            {/* Pro badge removed since non-pro users can't access previous weeks */}
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

        {/* Swipe instruction for non-Pro users */}
        {!checkingProStatus && !isProMember && currentWeekOffset === 0 && (
          <View style={styles.swipeInstructionContainer}>
            <Text
              style={[
                styles.swipeInstructionText,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              Swipe right → to view previous weeks (Pro feature)
            </Text>
          </View>
        )}

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

      {/* Pro Brief Modal */}
      <Modal
        visible={showProBrief}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowProBrief(false)}
      >
        <View style={styles.proBriefOverlay}>
          <View
            style={[
              styles.proBriefContainer,
              { backgroundColor: currentTheme.colors.surface },
            ]}
          >
            <View style={styles.proBriefHeader}>
              <Text
                style={[
                  styles.proBriefTitle,
                  { color: currentTheme.colors.text },
                ]}
              >
                🔓 Pro Feature
              </Text>
              <TouchableOpacity
                style={styles.proBriefCloseButton}
                onPress={() => setShowProBrief(false)}
              >
                <Text
                  style={[
                    styles.proBriefCloseText,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  ✕
                </Text>
              </TouchableOpacity>
            </View>

            <Text
              style={[
                styles.proBriefMessage,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              Access to previous weeks' training history is available with
              EquiHub Pro.
            </Text>

            <View style={styles.proBriefFeatures}>
              <Text
                style={[
                  styles.proBriefFeatureItem,
                  { color: currentTheme.colors.text },
                ]}
              >
                ✓ Unlimited training history
              </Text>
              <Text
                style={[
                  styles.proBriefFeatureItem,
                  { color: currentTheme.colors.text },
                ]}
              >
                ✓ Advanced analytics
              </Text>
              <Text
                style={[
                  styles.proBriefFeatureItem,
                  { color: currentTheme.colors.text },
                ]}
              >
                ✓ Export your data
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.proBriefUpgradeButton,
                { backgroundColor: currentTheme.colors.accent },
              ]}
              onPress={() => {
                setShowProBrief(false);
                router.push("/subscription");
              }}
            >
              <Text style={styles.proBriefUpgradeButtonText}>
                Upgrade to Pro
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.proBriefDismissButton}
              onPress={() => setShowProBrief(false)}
            >
              <Text
                style={[
                  styles.proBriefDismissButtonText,
                  { color: currentTheme.colors.textSecondary },
                ]}
              >
                Maybe Later
              </Text>
            </TouchableOpacity>
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
    paddingVertical: 10,
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
    paddingVertical: 16,
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
  swipeInstructionContainer: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginBottom: 12,
    alignItems: "center",
  },
  swipeInstructionText: {
    fontSize: 12,
    fontStyle: "italic",
    textAlign: "center",
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
  // Pro Brief Modal Styles
  proBriefOverlay: {
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
  proBriefContainer: {
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    maxWidth: 320,
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  proBriefHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginBottom: 16,
  },
  proBriefTitle: {
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    flex: 1,
  },
  proBriefCloseButton: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: "rgba(0, 0, 0, 0.1)",
  },
  proBriefCloseText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  proBriefMessage: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  proBriefFeatures: {
    alignSelf: "stretch",
    marginBottom: 24,
  },
  proBriefFeatureItem: {
    fontSize: 14,
    marginBottom: 8,
    textAlign: "left",
  },
  proBriefUpgradeButton: {
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
  proBriefUpgradeButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  proBriefDismissButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  proBriefDismissButtonText: {
    fontSize: 14,
    textAlign: "center",
  },
});

export default SessionsScreen;
