import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
  // Hardcoded theme to avoid context issues
  const currentTheme = {
    colors: {
      primary: '#335C67',
      background: '#FFFFFF',
      surface: '#F8F9FA',
      text: '#1A1A1A',
      textSecondary: '#6B7280',
      accent: '#E09F3E',
    }
  };
  
  // Hardcoded user for now - in production this would come from auth
  const user = { id: 'test-user-id' };
  
  const router = useRouter();
  const [trainingSessions, setTrainingSessions] = useState<TrainingSession[]>(
    []
  );
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0); // 0 = current week, -1 = last week, etc.
  const [isProMember, setIsProMember] = useState(false);
  const [checkingProStatus, setCheckingProStatus] = useState(false);

  // Get screen width for swipe gestures
  const screenWidth = Dimensions.get('window').width;

  // Check if user is a pro member
  const checkProMembership = useCallback(async () => {
    if (!user?.id) {
      setIsProMember(false);
      return;
    }

    try {
      setCheckingProStatus(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('is_pro_member')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error checking pro status:', error);
        setIsProMember(false);
      } else {
        setIsProMember(data?.is_pro_member || false);
      }
    } catch (error) {
      console.error('Error checking pro membership:', error);
      setIsProMember(false);
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
    startOfWeek.setDate(now.getDate() + mondayOffset + (weekOffset * 7));
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
    const startMonth = startOfWeek.toLocaleDateString('en-US', { month: 'short' });
    const endMonth = endOfWeek.toLocaleDateString('en-US', { month: 'short' });
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
      return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 20;
    },
    onPanResponderMove: (evt, gestureState) => {
      // Optional: Add visual feedback during swipe
    },
    onPanResponderRelease: (evt, gestureState) => {
      const swipeThreshold = screenWidth * 0.2; // 20% of screen width
      
      if (gestureState.dx > swipeThreshold) {
        // Swipe right - go to next week (more recent)
        handleNextWeek();
      } else if (gestureState.dx < -swipeThreshold) {
        // Swipe left - go to previous week (older)
        handlePreviousWeek();
      }
    },
  });

  // Handle navigation to previous week
  const handlePreviousWeek = () => {
    if (!isProMember && currentWeekOffset <= -1) {
      // Non-pro user trying to access older weeks
      router.push('/subscription');
      return;
    }
    setCurrentWeekOffset(prev => prev - 1);
  };

  // Handle navigation to next week
  const handleNextWeek = () => {
    if (currentWeekOffset < 0) {
      setCurrentWeekOffset(prev => prev + 1);
    }
  };

  // Load training sessions from AsyncStorage
  const loadTrainingSessions = useCallback(async () => {
    try {
      console.log('Loading training sessions for week offset:', currentWeekOffset);
      setLoadingSessions(true);
      const savedSessions = await AsyncStorage.getItem("training_sessions");
      
      console.log('Raw sessions from storage:', savedSessions ? 'Found data' : 'No data');
      
      if (savedSessions) {
        const parsedSessions: TrainingSession[] = JSON.parse(savedSessions);
        console.log('Parsed sessions count:', parsedSessions.length);
        
        // Filter sessions for current user if user ID is available
        const userSessions = user?.id
          ? parsedSessions.filter((session) => session.userId === user.id)
          : parsedSessions;

        console.log('User sessions count:', userSessions.length);

        // Filter sessions by week
        const { startOfWeek, endOfWeek } = getWeekBounds(currentWeekOffset);
        console.log('Week bounds:', { startOfWeek, endOfWeek });
        
        const weekSessions = userSessions.filter((session) => {
          const sessionDate = new Date(session.startTime);
          return sessionDate >= startOfWeek && sessionDate <= endOfWeek;
        });

        console.log('Week sessions count:', weekSessions.length);

        // Sort by start time (newest first)
        weekSessions.sort((a, b) => b.startTime - a.startTime);
        setTrainingSessions(weekSessions);
      } else {
        console.log('No saved sessions found');
        setTrainingSessions([]);
      }
    } catch (error) {
      console.error("Error loading training sessions:", error);
      setTrainingSessions([]);
    } finally {
      console.log('Finished loading sessions');
      setLoadingSessions(false);
    }
  }, [currentWeekOffset, user?.id]);

  // Load training sessions when component mounts
  useEffect(() => {
    console.log('Component mounted, starting initial load');
    loadTrainingSessions();
    checkProMembership();
  }, []);

  // Reload sessions when week changes
  useEffect(() => {
    console.log('Week offset changed to:', currentWeekOffset);
    loadTrainingSessions();
  }, [currentWeekOffset]);

  // Reload sessions when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      console.log('Screen focused, reloading sessions');
      loadTrainingSessions();
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
              console.error("Error deleting training session:", error);
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
    <View
      style={[
        styles.sessionCard,
        { backgroundColor: currentTheme.colors.surface },
      ]}
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
    </View>
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
          >
            <Text style={styles.backButtonText}>←</Text>
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
                opacity: (!isProMember && currentWeekOffset <= -1) ? 0.5 : 1
              },
            ]}
            onPress={handlePreviousWeek}
            disabled={!isProMember && currentWeekOffset <= -1}
          >
            <Text style={[styles.weekNavText, { color: currentTheme.colors.text }]}>
              ←
            </Text>
          </TouchableOpacity>
          
          <View style={styles.weekDisplayContainer}>
            <Text style={[styles.weekDisplayText, { color: currentTheme.colors.text }]}>
              {formatWeekDisplay(currentWeekOffset)}
            </Text>
            {!isProMember && currentWeekOffset < 0 && (
              <View style={[styles.proRequiredBadge, { backgroundColor: currentTheme.colors.accent }]}>
                <Text style={styles.proRequiredText}>PRO</Text>
              </View>
            )}
          </View>
          
          <TouchableOpacity
            style={[
              styles.weekNavButton,
              { 
                backgroundColor: currentTheme.colors.surface,
                opacity: currentWeekOffset >= 0 ? 0.5 : 1
              },
            ]}
            onPress={handleNextWeek}
            disabled={currentWeekOffset >= 0}
          >
            <Text style={[styles.weekNavText, { color: currentTheme.colors.text }]}>
              →
            </Text>
          </TouchableOpacity>
        </View>

        {/* Swipe instruction for non-Pro users */}
        {!checkingProStatus && !isProMember && currentWeekOffset === 0 && (
          <View style={styles.swipeInstructionContainer}>
            <Text style={[styles.swipeInstructionText, { color: currentTheme.colors.textSecondary }]}>
              ← Swipe to view previous weeks (Pro feature)
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
              No Training Sessions Yet
            </Text>
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

        {/* Pro Subscription Prompt Overlay */}
        {!checkingProStatus && !isProMember && currentWeekOffset < 0 && (
          <View style={styles.subscriptionOverlay}>
            <View style={[styles.subscriptionPrompt, { backgroundColor: currentTheme.colors.surface }]}>
              <Text style={[styles.subscriptionTitle, { color: currentTheme.colors.text }]}>
                Unlock Full History
              </Text>
              <Text style={[styles.subscriptionMessage, { color: currentTheme.colors.textSecondary }]}>
                View all your training sessions from previous weeks with EquiHub Pro
              </Text>
              <TouchableOpacity
                style={[styles.upgradeButton, { backgroundColor: currentTheme.colors.accent }]}
                onPress={() => router.push('/subscription')}
              >
                <Text style={styles.upgradeButtonText}>Upgrade to Pro</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dismissButton}
                onPress={() => setCurrentWeekOffset(0)}
              >
                <Text style={[styles.dismissButtonText, { color: currentTheme.colors.textSecondary }]}>
                  Back to Current Week
                </Text>
              </TouchableOpacity>
            </View>
          </View>
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
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginBottom: -45,
  },
  backButton: {
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
});

export default SessionsScreen;
