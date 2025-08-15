import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";

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
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [trainingSessions, setTrainingSessions] = useState<TrainingSession[]>(
    []
  );
  const [loadingSessions, setLoadingSessions] = useState(true);

  // Load training sessions from AsyncStorage
  const loadTrainingSessions = async () => {
    try {
      setLoadingSessions(true);
      const savedSessions = await AsyncStorage.getItem("training_sessions");
      if (savedSessions) {
        const parsedSessions: TrainingSession[] = JSON.parse(savedSessions);
        // Filter sessions for current user if user ID is available
        const userSessions = user?.id
          ? parsedSessions.filter((session) => session.userId === user.id)
          : parsedSessions;

        // Sort by start time (newest first)
        userSessions.sort((a, b) => b.startTime - a.startTime);
        setTrainingSessions(userSessions);
      } else {
        setTrainingSessions([]);
      }
    } catch (error) {
      console.error("Error loading training sessions:", error);
      setTrainingSessions([]);
    } finally {
      setLoadingSessions(false);
    }
  };

  // Load training sessions when component mounts
  useEffect(() => {
    loadTrainingSessions();
  }, [user]);

  // Reload sessions when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      loadTrainingSessions();
    }, [user])
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
      >
        {trainingSessions.length === 0 ? (
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
});

export default SessionsScreen;
