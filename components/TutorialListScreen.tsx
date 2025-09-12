import React, { useEffect, useState } from "react";
import {
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { MockTutorialDataService } from "../lib/mockTutorialData";
import {
  Lesson,
  TutorialProgress,
  TutorialProgressService,
} from "../lib/tutorialProgressService";
import CustomLessonDialog from "./CustomLessonDialog";
import LessonScreen from "./LessonScreen";

interface TutorialListScreenProps {
  tutorialId: string;
  tutorialTitle: string;
  onClose: () => void;
}

export const TutorialListScreen: React.FC<TutorialListScreenProps> = ({
  tutorialId,
  tutorialTitle,
  onClose,
}) => {
  const { currentTheme } = useTheme();
  const theme = currentTheme.colors;
  const { user } = useAuth();

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [progress, setProgress] = useState<TutorialProgress | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [showLessonModal, setShowLessonModal] = useState(false);

  // Dialog state
  const [dialogVisible, setDialogVisible] = useState(false);
  const [dialogConfig, setDialogConfig] = useState({
    title: "",
    message: "",
    type: "info" as "success" | "warning" | "error" | "info",
    onConfirm: undefined as (() => void) | undefined,
    confirmText: "OK",
    cancelText: "Cancel",
  });

  useEffect(() => {
    loadLessons();
    loadProgress();
  }, [tutorialId]);

  // Helper function to show dialog
  const showDialog = (
    title: string,
    message: string,
    type: "success" | "warning" | "error" | "info" = "info",
    onConfirm?: () => void,
    confirmText: string = "OK",
    cancelText: string = "Cancel"
  ) => {
    setDialogConfig({
      title,
      message,
      type,
      onConfirm,
      confirmText,
      cancelText,
    });
    setDialogVisible(true);
  };

  const hideDialog = () => {
    setDialogVisible(false);
  };

  const loadLessons = () => {
    const tutorialLessons =
      MockTutorialDataService.getLessonsForTutorial(tutorialId);
    setLessons(tutorialLessons);
  };

  const loadProgress = async () => {
    if (!user?.id) return;

    const tutorialProgress = await TutorialProgressService.getTutorialProgress(
      user.id,
      tutorialId
    );
    setProgress(tutorialProgress);
  };

  const handleStartLesson = (lessonId: string) => {
    setSelectedLessonId(lessonId);
    setShowLessonModal(true);
  };

  const handleLessonComplete = async () => {
    setShowLessonModal(false);
    setSelectedLessonId(null);

    // Reload progress to update UI
    await loadProgress();

    showDialog(
      "Lesson Complete!",
      "Great job! You've successfully completed this lesson.",
      "success",
      undefined,
      "Continue Learning"
    );
  };

  const handleLessonExit = () => {
    setShowLessonModal(false);
    setSelectedLessonId(null);
    // Reload progress to save any partial progress
    loadProgress();
  };

  const isLessonCompleted = (lessonId: string) => {
    return progress?.completedLessons.includes(lessonId) || false;
  };

  const getLessonProgress = (lessonId: string) => {
    const lessonProgress = progress?.lessonProgress[lessonId];
    if (!lessonProgress) return 0;

    const lesson = lessons.find((l) => l.id === lessonId);
    if (!lesson) return 0;

    return (lessonProgress.completedSteps.length / lesson.steps.length) * 100;
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "Beginner":
        return "#4CAF50";
      case "Intermediate":
        return "#FF9800";
      case "Advanced":
        return "#F44336";
      default:
        return theme.textSecondary;
    }
  };

  const renderLessonCard = (lesson: Lesson, index: number) => {
    const isCompleted = isLessonCompleted(lesson.id);
    const progressPercentage = getLessonProgress(lesson.id);
    const isInProgress = progressPercentage > 0 && progressPercentage < 100;

    return (
      <TouchableOpacity
        key={lesson.id}
        style={[
          styles.lessonCard,
          { backgroundColor: theme.surface },
          isCompleted && { backgroundColor: "rgba(76, 175, 80, 0.1)" },
        ]}
        onPress={() => handleStartLesson(lesson.id)}
        activeOpacity={0.8}
      >
        <View style={styles.lessonHeader}>
          <View style={styles.lessonNumber}>
            <Text style={styles.lessonNumberText}>
              {isCompleted ? "✓" : index + 1}
            </Text>
          </View>

          <View style={styles.lessonInfo}>
            <Text
              style={[styles.lessonTitle, { color: theme.text }]}
              numberOfLines={2}
            >
              {lesson.title}
            </Text>
            <Text
              style={[styles.lessonDescription, { color: theme.textSecondary }]}
              numberOfLines={2}
            >
              {lesson.description}
            </Text>

            <View style={styles.lessonMeta}>
              <View
                style={[
                  styles.difficultyBadge,
                  { backgroundColor: getDifficultyColor(lesson.difficulty) },
                ]}
              >
                <Text style={styles.difficultyText}>{lesson.difficulty}</Text>
              </View>
              <Text
                style={[styles.durationText, { color: theme.textSecondary }]}
              >
                {lesson.estimatedDuration} min
              </Text>
            </View>
          </View>
        </View>

        {/* Progress Bar */}
        {isInProgress && (
          <View style={styles.progressContainer}>
            <View
              style={[styles.progressTrack, { backgroundColor: theme.border }]}
            >
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: theme.primary,
                    width: `${progressPercentage}%`,
                  },
                ]}
              />
            </View>
            <Text style={[styles.progressText, { color: theme.textSecondary }]}>
              {Math.round(progressPercentage)}% complete
            </Text>
          </View>
        )}

        {/* Action Button */}
        <View style={styles.lessonAction}>
          <Text style={[styles.actionText, { color: theme.primary }]}>
            {isCompleted ? "Review" : isInProgress ? "Continue" : "Start"}
          </Text>
          <Text style={[styles.actionArrow, { color: theme.primary }]}>→</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const completedLessons = progress?.completedLessons.length || 0;
  const totalLessons = lessons.length;
  const overallProgress =
    totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;

  return (
    <>
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.primary }]}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onClose}>
            <Image
              source={require("../assets/in_app_icons/back.png")}
              style={{ width: 24, height: 24, tintColor: "#fff" }}
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {tutorialTitle}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Progress Overview */}
        <View style={styles.progressOverview}>
          <Text style={styles.progressLabel}>
            Progress: {completedLessons} / {totalLessons} lessons
          </Text>
          <View
            style={[
              styles.overallProgressTrack,
              { backgroundColor: "rgba(255,255,255,0.3)" },
            ]}
          >
            <View
              style={[
                styles.overallProgressFill,
                {
                  backgroundColor: "#fff",
                  width: `${overallProgress}%`,
                },
              ]}
            />
          </View>
          <Text style={styles.progressPercentage}>
            {Math.round(overallProgress)}%
          </Text>
        </View>

        {/* Content */}
        <View style={[styles.content, { backgroundColor: theme.background }]}>
          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.lessonsContainer}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Lessons
              </Text>

              {lessons.length > 0 ? (
                lessons.map((lesson, index) => renderLessonCard(lesson, index))
              ) : (
                <View style={styles.emptyState}>
                  <Text
                    style={[styles.emptyText, { color: theme.textSecondary }]}
                  >
                    No lessons available for this tutorial yet.
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>

      {/* Lesson Modal */}
      <Modal
        visible={showLessonModal}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={handleLessonExit}
      >
        {selectedLessonId && (
          <LessonScreen
            tutorialId={tutorialId}
            lessonId={selectedLessonId}
            onComplete={handleLessonComplete}
            onExit={handleLessonExit}
          />
        )}
      </Modal>

      {/* Custom Dialog */}
      <CustomLessonDialog
        visible={dialogVisible}
        title={dialogConfig.title}
        message={dialogConfig.message}
        type={dialogConfig.type}
        onClose={hideDialog}
        onConfirm={dialogConfig.onConfirm}
        confirmText={dialogConfig.confirmText}
        cancelText={dialogConfig.cancelText}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  backButton: {
    padding: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#fff",
    fontFamily: "Inder",
    flex: 1,
    textAlign: "center",
    marginHorizontal: 10,
  },
  headerSpacer: {
    width: 44, // Same width as back button to center title
  },
  progressOverview: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  progressLabel: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inder",
    marginBottom: 10,
  },
  overallProgressTrack: {
    height: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  overallProgressFill: {
    height: "100%",
    borderRadius: 4,
  },
  progressPercentage: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inder",
    alignSelf: "flex-end",
  },
  content: {
    flex: 1,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  lessonsContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: "bold",
    fontFamily: "Inder",
    marginBottom: 20,
  },
  lessonCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  lessonHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  lessonNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  lessonNumberText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    fontFamily: "Inder",
  },
  lessonInfo: {
    flex: 1,
  },
  lessonTitle: {
    fontSize: 18,
    fontWeight: "bold",
    fontFamily: "Inder",
    marginBottom: 6,
    lineHeight: 24,
  },
  lessonDescription: {
    fontSize: 14,
    fontFamily: "Inder",
    lineHeight: 20,
    marginBottom: 12,
  },
  lessonMeta: {
    flexDirection: "row",
    alignItems: "center",
  },
  difficultyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 12,
  },
  difficultyText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Inder",
  },
  durationText: {
    fontSize: 14,
    fontFamily: "Inder",
  },
  progressContainer: {
    marginBottom: 12,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    marginBottom: 6,
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    fontFamily: "Inder",
    alignSelf: "flex-end",
  },
  lessonAction: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  actionText: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inder",
  },
  actionArrow: {
    fontSize: 18,
    fontWeight: "bold",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: "Inder",
    textAlign: "center",
  },
});

export default TutorialListScreen;
