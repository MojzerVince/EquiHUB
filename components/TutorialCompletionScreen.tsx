import React, { useEffect, useState } from "react";
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import {
  TutorialProgress,
  TutorialProgressService,
} from "../lib/tutorialProgressService";

interface TutorialCompletionScreenProps {
  tutorialId: string;
  tutorialTitle: string;
  onContinue: () => void;
}

export const TutorialCompletionScreen: React.FC<
  TutorialCompletionScreenProps
> = ({ tutorialId, tutorialTitle, onContinue }) => {
  const { currentTheme } = useTheme();
  const theme = currentTheme.colors;
  const { user } = useAuth();

  const [progress, setProgress] = useState<TutorialProgress | null>(null);
  const [animationValue] = useState(new Animated.Value(0));

  useEffect(() => {
    loadProgress();
    startAnimation();
  }, []);

  const loadProgress = async () => {
    if (!user?.id) return;

    const tutorialProgress = await TutorialProgressService.getTutorialProgress(
      user.id,
      tutorialId
    );
    setProgress(tutorialProgress);
  };

  const startAnimation = () => {
    Animated.sequence([
      Animated.delay(500),
      Animated.spring(animationValue, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${remainingSeconds}s`;
  };

  const getAchievementBadges = () => {
    if (!progress) return [];

    const badges = [];

    if (progress.completedLessons.length >= 1) {
      badges.push({
        icon: "🎯",
        title: "First Steps",
        description: "Completed your first lesson",
      });
    }

    if (progress.completedLessons.length >= 3) {
      badges.push({
        icon: "🔥",
        title: "On Fire",
        description: "Completed 3 lessons",
      });
    }

    if (progress.totalProgress >= 50) {
      badges.push({
        icon: "⭐",
        title: "Half Way",
        description: "Reached 50% completion",
      });
    }

    if (progress.totalProgress >= 100) {
      badges.push({
        icon: "👑",
        title: "Master",
        description: "Completed the entire tutorial",
      });
    }

    return badges;
  };

  const achievements = getAchievementBadges();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Celebration Header */}
        <Animated.View
          style={[
            styles.celebrationContainer,
            {
              transform: [
                {
                  scale: animationValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.8, 1],
                  }),
                },
              ],
              opacity: animationValue,
            },
          ]}
        >
          <Text style={styles.celebrationEmoji}>🎉</Text>
          <Text style={[styles.celebrationTitle, { color: theme.text }]}>
            Lesson Complete!
          </Text>
          <Text
            style={[styles.celebrationSubtitle, { color: theme.textSecondary }]}
          >
            Great job on completing this lesson in {tutorialTitle}
          </Text>
        </Animated.View>

        {/* Progress Stats */}
        {progress && (
          <View
            style={[styles.statsContainer, { backgroundColor: theme.surface }]}
          >
            <Text style={[styles.statsTitle, { color: theme.text }]}>
              Your Progress
            </Text>

            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={[styles.statNumber, { color: theme.primary }]}>
                  {progress.completedLessons.length}
                </Text>
                <Text
                  style={[styles.statLabel, { color: theme.textSecondary }]}
                >
                  Lessons Completed
                </Text>
              </View>

              <View style={styles.statItem}>
                <Text style={[styles.statNumber, { color: theme.primary }]}>
                  {Math.round(progress.totalProgress)}%
                </Text>
                <Text
                  style={[styles.statLabel, { color: theme.textSecondary }]}
                >
                  Tutorial Progress
                </Text>
              </View>

              <View style={styles.statItem}>
                <Text style={[styles.statNumber, { color: theme.primary }]}>
                  {formatTime(progress.totalTimeSpent)}
                </Text>
                <Text
                  style={[styles.statLabel, { color: theme.textSecondary }]}
                >
                  Time Spent Learning
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Achievement Badges */}
        {achievements.length > 0 && (
          <View
            style={[
              styles.achievementsContainer,
              { backgroundColor: theme.surface },
            ]}
          >
            <Text style={[styles.achievementsTitle, { color: theme.text }]}>
              🏆 Achievements Unlocked
            </Text>

            {achievements.map((achievement, index) => (
              <Animated.View
                key={index}
                style={[
                  styles.achievementBadge,
                  { backgroundColor: theme.background },
                  {
                    transform: [
                      {
                        translateX: animationValue.interpolate({
                          inputRange: [0, 1],
                          outputRange: [100, 0],
                        }),
                      },
                    ],
                    opacity: animationValue,
                  },
                ]}
              >
                <Text style={styles.achievementIcon}>{achievement.icon}</Text>
                <View style={styles.achievementInfo}>
                  <Text
                    style={[styles.achievementTitle, { color: theme.text }]}
                  >
                    {achievement.title}
                  </Text>
                  <Text
                    style={[
                      styles.achievementDescription,
                      { color: theme.textSecondary },
                    ]}
                  >
                    {achievement.description}
                  </Text>
                </View>
              </Animated.View>
            ))}
          </View>
        )}

        {/* Continue Learning Button */}
        <TouchableOpacity
          style={[styles.continueButton, { backgroundColor: theme.primary }]}
          onPress={onContinue}
          activeOpacity={0.8}
        >
          <Text style={styles.continueButtonText}>Continue Learning</Text>
        </TouchableOpacity>

        {/* Motivational Quote */}
        <View style={styles.quoteContainer}>
          <Text style={[styles.quote, { color: theme.textSecondary }]}>
            "The expert in anything was once a beginner who refused to give up."
          </Text>
          <Text style={[styles.quoteAuthor, { color: theme.textSecondary }]}>
            - Helen Hayes
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    alignItems: "center",
  },
  celebrationContainer: {
    alignItems: "center",
    marginVertical: 40,
  },
  celebrationEmoji: {
    fontSize: 80,
    marginBottom: 20,
  },
  celebrationTitle: {
    fontSize: 28,
    fontWeight: "bold",
    fontFamily: "Inder",
    marginBottom: 10,
    textAlign: "center",
  },
  celebrationSubtitle: {
    fontSize: 16,
    fontFamily: "Inder",
    textAlign: "center",
    lineHeight: 24,
  },
  statsContainer: {
    width: "100%",
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  statsTitle: {
    fontSize: 20,
    fontWeight: "bold",
    fontFamily: "Inder",
    marginBottom: 16,
    textAlign: "center",
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "bold",
    fontFamily: "Inder",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: "Inder",
    textAlign: "center",
  },
  achievementsContainer: {
    width: "100%",
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  achievementsTitle: {
    fontSize: 18,
    fontWeight: "bold",
    fontFamily: "Inder",
    marginBottom: 16,
    textAlign: "center",
  },
  achievementBadge: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  achievementIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  achievementInfo: {
    flex: 1,
  },
  achievementTitle: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inder",
    marginBottom: 4,
  },
  achievementDescription: {
    fontSize: 14,
    fontFamily: "Inder",
    lineHeight: 18,
  },
  continueButton: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 25,
    alignItems: "center",
    marginBottom: 30,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  continueButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "Inder",
  },
  quoteContainer: {
    alignItems: "center",
    paddingHorizontal: 20,
  },
  quote: {
    fontSize: 16,
    fontStyle: "italic",
    fontFamily: "Inder",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 8,
  },
  quoteAuthor: {
    fontSize: 14,
    fontFamily: "Inder",
  },
});

export default TutorialCompletionScreen;
