import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Dimensions,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { ChallengeStorageService } from "../lib/challengeStorage";
import { ActiveChallenge, ChallengeSession } from "../types/challengeTypes";

const { width } = Dimensions.get("window");

interface ChallengeProgressScreenProps {
  challengeId?: string;
}

export default function ChallengeProgressScreen({
  challengeId,
}: ChallengeProgressScreenProps) {
  const { user } = useAuth();
  const { currentTheme } = useTheme();
  const router = useRouter();
  const theme = currentTheme.colors;

  const [activeChallenge, setActiveChallenge] =
    useState<ActiveChallenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<ChallengeSession[]>([]);

  // Load active challenge data
  useEffect(() => {
    loadChallengeData();
  }, [user?.id]);

  const loadChallengeData = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const challenge = await ChallengeStorageService.getActiveChallenge(
        user.id
      );
      setActiveChallenge(challenge);

      if (challenge) {
        setSessions(challenge.sessions || []);
      }
    } catch (error) {
      console.error("Error loading challenge data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveChallenge = () => {
    Alert.alert(
      "Leave Challenge",
      "Are you sure you want to leave this challenge? Your progress will be lost.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: async () => {
            if (user?.id) {
              await ChallengeStorageService.removeActiveChallenge(user.id);
              router.back();
            }
          },
        },
      ]
    );
  };

  const addTestProgress = async () => {
    if (!user?.id || !activeChallenge) return;

    // Add some test progress based on unit
    let progressToAdd = 0;
    if (activeChallenge.unit === "km") {
      progressToAdd = 5; // Add 5km
    } else if (activeChallenge.unit === "hours") {
      progressToAdd = 1; // Add 1 hour
    } else if (activeChallenge.unit === "sessions") {
      progressToAdd = 1; // Add 1 session
    }

    const success = await ChallengeStorageService.updateChallengeProgress(
      user.id,
      progressToAdd
    );
    if (success) {
      loadChallengeData();
    }
  };

  // Calculate progress percentage
  const getProgressPercentage = () => {
    if (!activeChallenge) return 0;
    return Math.min(
      (activeChallenge.progress / activeChallenge.target) * 100,
      100
    );
  };

  // Get milestone positions for the path
  const getMilestones = () => {
    if (!activeChallenge) return [];

    const milestones = [];
    const stepSize = activeChallenge.target / 4; // 4 milestones

    for (let i = 1; i <= 4; i++) {
      milestones.push({
        value: stepSize * i,
        percentage: ((stepSize * i) / activeChallenge.target) * 100,
        label: `${Math.round(stepSize * i)} ${activeChallenge.unit}`,
        reached: activeChallenge.progress >= stepSize * i,
      });
    }

    return milestones;
  };

  // SVG Path for the winding road
  const getWindingPath = () => {
    const pathWidth = width - 64; // Account for padding
    const pathHeight = 400;

    return `
      M 32 ${pathHeight - 20}
      Q 100 ${pathHeight - 80} 200 ${pathHeight - 120}
      Q 300 ${pathHeight - 160} ${pathWidth * 0.7} ${pathHeight - 200}
      Q ${pathWidth * 0.5} ${pathHeight - 240} ${pathWidth * 0.3} ${
      pathHeight - 280
    }
      Q ${pathWidth * 0.6} ${pathHeight - 320} ${pathWidth - 32} ${
      pathHeight - 360
    }
    `;
  };

  // Get position on path for current progress
  const getCurrentPosition = () => {
    const percentage = getProgressPercentage();
    const pathWidth = width - 64;
    const pathHeight = 400;

    // Approximate position based on percentage
    const t = percentage / 100;
    const x =
      32 +
      (pathWidth - 64) * Math.sin(t * Math.PI * 2) * 0.3 +
      (pathWidth - 64) * t;
    const y =
      pathHeight - 20 - (pathHeight - 40) * t + Math.sin(t * Math.PI * 4) * 30;

    return { x, y };
  };

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.primary }]}
      >
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.text }]}>
            Loading challenge...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!activeChallenge) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.primary }]}
      >
        <View style={styles.noProgressContainer}>
          <Text style={[styles.noProgressText, { color: theme.text }]}>
            No active challenge found
          </Text>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: theme.accent }]}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const progressPercentage = getProgressPercentage();
  const milestones = getMilestones();
  const currentPosition = getCurrentPosition();

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.primary }]}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>March Distance Challenge</Text>

        <TouchableOpacity
          style={styles.menuButton}
          onPress={handleLeaveChallenge}
        >
          <Ionicons name="ellipsis-horizontal" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <View style={[styles.content, { backgroundColor: theme.surface }]}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Progress Visualization */}
          <View style={styles.progressContainer}>
            {/* Simple Progress Path */}
            <View style={styles.progressPath}>
              {/* Background track */}
              <View style={styles.progressTrack} />

              {/* Progress fill */}
              <View
                style={[
                  styles.progressFill,
                  { width: `${progressPercentage}%` },
                ]}
              />

              {/* Milestones */}
              {milestones.map((milestone, index) => (
                <View
                  key={index}
                  style={[
                    styles.milestone,
                    {
                      left: `${milestone.percentage}%`,
                      backgroundColor: milestone.reached
                        ? "#4CAF50"
                        : "#E0E0E0",
                    },
                  ]}
                >
                  <Text style={styles.milestoneText}>
                    {milestone.reached ? "✓" : "○"}
                  </Text>
                </View>
              ))}

              {/* Current position */}
              <View
                style={[
                  styles.currentPosition,
                  { left: `${Math.min(progressPercentage, 95)}%` },
                ]}
              >
                <Text style={styles.horseEmoji}>🏇</Text>
              </View>
            </View>

            {/* Progress Labels */}
            <View style={styles.progressLabels}>
              <Text
                style={[styles.progressLabel, { color: theme.textSecondary }]}
              >
                Start
              </Text>
              <Text
                style={[styles.progressLabel, { color: theme.textSecondary }]}
              >
                {activeChallenge.target} {activeChallenge.unit}
              </Text>
            </View>
          </View>

          {/* Progress Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.mainStat}>
              <Text style={[styles.progressText, { color: theme.text }]}>
                {activeChallenge.progress.toFixed(1)} {activeChallenge.unit}
              </Text>
              <Text style={[styles.targetText, { color: theme.textSecondary }]}>
                of {activeChallenge.target} {activeChallenge.unit}
              </Text>
              <Text style={[styles.percentageText, { color: theme.accent }]}>
                {progressPercentage.toFixed(1)}% Complete
              </Text>
            </View>
          </View>

          {/* Leaderboard Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Friends
              </Text>
              <Text style={[styles.sectionSubtitle, { color: theme.accent }]}>
                Top (5 miles)
              </Text>
            </View>

            <View style={styles.leaderboardContainer}>
              <View style={styles.leaderboardItem}>
                <View style={styles.friendInfo}>
                  <View style={styles.friendAvatar} />
                  <Text style={[styles.friendName, { color: theme.text }]}>
                    You
                  </Text>
                </View>
                <Text style={[styles.friendDistance, { color: theme.text }]}>
                  {activeChallenge.progress.toFixed(1)} {activeChallenge.unit}
                </Text>
              </View>
            </View>
          </View>

          {/* Test Button (for development) */}
          <TouchableOpacity
            style={[styles.testButton, { backgroundColor: theme.accent }]}
            onPress={addTestProgress}
          >
            <Text style={styles.testButtonText}>Add Test Progress</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
    flex: 1,
    textAlign: "center",
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
  },
  progressContainer: {
    alignItems: "center",
    marginBottom: 20,
    paddingHorizontal: 24,
  },
  progressPath: {
    width: "100%",
    height: 60,
    backgroundColor: "#F0F0F0",
    borderRadius: 30,
    position: "relative",
    marginVertical: 20,
  },
  progressTrack: {
    width: "100%",
    height: "100%",
    backgroundColor: "#E0E0E0",
    borderRadius: 30,
  },
  progressFill: {
    position: "absolute",
    top: 0,
    left: 0,
    height: "100%",
    backgroundColor: "#4CAF50",
    borderRadius: 30,
    minWidth: 8,
  },
  milestone: {
    position: "absolute",
    top: -10,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    transform: [{ translateX: -10 }],
  },
  milestoneText: {
    fontSize: 12,
    color: "#fff",
    fontWeight: "bold",
  },
  currentPosition: {
    position: "absolute",
    top: -15,
    width: 30,
    height: 30,
    justifyContent: "center",
    alignItems: "center",
    transform: [{ translateX: -15 }],
  },
  horseEmoji: {
    fontSize: 24,
  },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 10,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  pathSvg: {
    marginVertical: 20,
  },
  statsContainer: {
    paddingHorizontal: 24,
    marginBottom: 30,
  },
  mainStat: {
    alignItems: "center",
    backgroundColor: "#F8F9FA",
    borderRadius: 16,
    padding: 24,
  },
  progressText: {
    fontSize: 32,
    fontWeight: "bold",
  },
  targetText: {
    fontSize: 16,
    marginTop: 4,
  },
  percentageText: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 8,
  },
  section: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  sectionSubtitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  leaderboardContainer: {
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    padding: 16,
  },
  leaderboardItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  friendInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  friendAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#E0E0E0",
    marginRight: 12,
  },
  friendName: {
    fontSize: 16,
    fontWeight: "500",
  },
  friendDistance: {
    fontSize: 16,
    fontWeight: "bold",
  },
  testButton: {
    marginHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 40,
  },
  testButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
  },
  noProgressContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  noProgressText: {
    fontSize: 18,
    textAlign: "center",
    marginBottom: 24,
  },
  backButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});
