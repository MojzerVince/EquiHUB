import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { MockTutorialDataService } from "../lib/mockTutorialData";
import {
  Lesson,
  LessonProgress,
  LessonStep,
  TutorialProgressService,
} from "../lib/tutorialProgressService";

const { width: screenWidth } = Dimensions.get("window");

interface LessonScreenProps {
  tutorialId: string;
  lessonId: string;
  onComplete: () => void;
  onExit: () => void;
}

export const LessonScreen: React.FC<LessonScreenProps> = ({
  tutorialId,
  lessonId,
  onComplete,
  onExit,
}) => {
  const { currentTheme } = useTheme();
  const theme = currentTheme.colors;
  const { user } = useAuth();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [lessonProgress, setLessonProgress] = useState<LessonProgress | null>(
    null
  );
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showQuizResult, setShowQuizResult] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  const [checklistItems, setChecklistItems] = useState<boolean[]>([]);
  const [userNotes, setUserNotes] = useState("");
  const [startTime] = useState(Date.now());

  // Animations
  const progressAnim = useRef(new Animated.Value(0)).current;
  const stepAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadLesson();
    loadProgress();
  }, [tutorialId, lessonId]);

  useEffect(() => {
    if (lesson) {
      const progress = ((currentStepIndex + 1) / lesson.steps.length) * 100;
      Animated.timing(progressAnim, {
        toValue: progress,
        duration: 300,
        useNativeDriver: false,
      }).start();

      // Animate step transition
      stepAnim.setValue(0);
      Animated.timing(stepAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }
  }, [currentStepIndex, lesson]);

  const loadLesson = async () => {
    const lessonData = MockTutorialDataService.getLesson(tutorialId, lessonId);
    if (lessonData) {
      setLesson(lessonData);

      // Initialize checklist for checklist steps
      const currentStep = lessonData.steps[currentStepIndex];
      if (currentStep?.type === "checklist" && currentStep.checklist) {
        setChecklistItems(
          new Array(currentStep.checklist.items.length).fill(false)
        );
      }
    }
  };

  const loadProgress = async () => {
    if (!user?.id) return;

    const progress = await TutorialProgressService.getLessonProgress(
      user.id,
      tutorialId,
      lessonId
    );
    if (progress) {
      setLessonProgress(progress);

      // For completed lessons (review mode), start from the beginning
      // For in-progress lessons, resume from current step
      if (progress.isCompleted) {
        setCurrentStepIndex(0); // Start from beginning for review
      } else {
        setCurrentStepIndex(progress.currentStep || 0);
      }
    } else {
      // Start the lesson
      await TutorialProgressService.startLesson(user.id, tutorialId, lessonId);
      setCurrentStepIndex(0);
    }
  };

  const handleNext = async () => {
    if (!lesson || !user?.id) return;

    const currentStep = lesson.steps[currentStepIndex];

    // Safety check for currentStep
    if (!currentStep) {
      console.warn("Current step is undefined, cannot proceed");
      return;
    }

    // Validate step completion based on type
    if (currentStep.type === "quiz" && !showQuizResult) {
      handleQuizSubmit();
      return;
    }

    if (currentStep.type === "checklist") {
      const allChecked = checklistItems.every((checked) => checked);
      if (!allChecked) {
        Alert.alert(
          "Complete Checklist",
          "Please check all items before proceeding."
        );
        return;
      }
    }

    // Save step progress
    await TutorialProgressService.completeStep(
      user.id,
      tutorialId,
      lessonId,
      currentStep.id,
      currentStep.type === "quiz" ? quizScore : undefined
    );

    if (currentStepIndex < lesson.steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
      resetStepState();
    } else {
      // Lesson completed
      const totalTime = Math.floor((Date.now() - startTime) / 1000);
      await TutorialProgressService.completeLesson(
        user.id,
        tutorialId,
        lessonId,
        totalTime
      );
      onComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
      resetStepState();
    }
  };

  const resetStepState = () => {
    setSelectedAnswer(null);
    setShowQuizResult(false);
    setQuizScore(0);
    setUserNotes("");

    // Reset checklist for new step
    if (lesson) {
      const newStep =
        lesson.steps[currentStepIndex + 1] ||
        lesson.steps[currentStepIndex - 1];
      if (newStep?.type === "checklist" && newStep.checklist) {
        setChecklistItems(
          new Array(newStep.checklist.items.length).fill(false)
        );
      }
    }
  };

  const handleQuizSubmit = () => {
    if (selectedAnswer === null) {
      Alert.alert(
        "Select Answer",
        "Please select an answer before submitting."
      );
      return;
    }

    const currentStep = lesson!.steps[currentStepIndex];
    const isCorrect = selectedAnswer === currentStep.quiz!.correctAnswer;
    const score = isCorrect ? 100 : 0;

    setQuizScore(score);
    setShowQuizResult(true);
  };

  const handleChecklistToggle = (index: number) => {
    const newItems = [...checklistItems];
    newItems[index] = !newItems[index];
    setChecklistItems(newItems);
  };

  const handleExit = () => {
    Alert.alert(
      "Exit Lesson",
      "Your progress will be saved. Are you sure you want to exit?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Exit", style: "destructive", onPress: onExit },
      ]
    );
  };

  const renderStep = () => {
    if (!lesson || !lesson.steps) return null;

    const currentStep = lesson.steps[currentStepIndex];

    // Handle case where currentStepIndex is out of bounds
    if (!currentStep) {
      console.warn(
        `Step at index ${currentStepIndex} not found. Resetting to step 0.`
      );
      setCurrentStepIndex(0);
      return null;
    }

    return (
      <Animated.View
        style={[
          styles.stepContainer,
          {
            opacity: stepAnim,
            transform: [
              {
                translateY: stepAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
          },
        ]}
      >
        {renderStepContent(currentStep)}
      </Animated.View>
    );
  };

  const renderStepContent = (step: LessonStep) => {
    switch (step.type) {
      case "text":
        return (
          <ScrollView
            style={styles.stepContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styles.stepTitle, { color: theme.text }]}>
              {step.title}
            </Text>
            {step.imageUrl && (
              <Image source={{ uri: step.imageUrl }} style={styles.stepImage} />
            )}
            <Text style={[styles.stepText, { color: theme.textSecondary }]}>
              {step.content}
            </Text>
          </ScrollView>
        );

      case "video":
        return (
          <ScrollView
            style={styles.stepContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styles.stepTitle, { color: theme.text }]}>
              {step.title}
            </Text>
            <View style={styles.videoPlaceholder}>
              <Text style={styles.videoText}>🎥 Video Player</Text>
              <Text
                style={[styles.videoSubtext, { color: theme.textSecondary }]}
              >
                {step.content}
              </Text>
            </View>
            <Text style={[styles.stepText, { color: theme.textSecondary }]}>
              {step.content}
            </Text>
          </ScrollView>
        );

      case "quiz":
        return (
          <ScrollView
            style={styles.stepContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styles.stepTitle, { color: theme.text }]}>
              {step.title}
            </Text>
            <Text style={[styles.quizQuestion, { color: theme.text }]}>
              {step.quiz!.question}
            </Text>

            {step.quiz!.options.map((option: string, index: number) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.quizOption,
                  {
                    backgroundColor: theme.surface,
                    borderColor:
                      selectedAnswer === index ? theme.primary : theme.border,
                  },
                  selectedAnswer === index && { borderWidth: 2 },
                ]}
                onPress={() => !showQuizResult && setSelectedAnswer(index)}
                disabled={showQuizResult}
              >
                <View style={styles.quizOptionContent}>
                  <View
                    style={[
                      styles.quizRadio,
                      {
                        borderColor: theme.border,
                        backgroundColor:
                          selectedAnswer === index
                            ? theme.primary
                            : "transparent",
                      },
                    ]}
                  />
                  <Text style={[styles.quizOptionText, { color: theme.text }]}>
                    {option}
                  </Text>
                </View>
                {showQuizResult && index === step.quiz!.correctAnswer && (
                  <Text style={styles.correctIcon}>✓</Text>
                )}
              </TouchableOpacity>
            ))}

            {showQuizResult && step.quiz!.explanation && (
              <View
                style={[
                  styles.quizExplanation,
                  { backgroundColor: theme.surface },
                ]}
              >
                <Text style={[styles.explanationTitle, { color: theme.text }]}>
                  Explanation:
                </Text>
                <Text
                  style={[
                    styles.explanationText,
                    { color: theme.textSecondary },
                  ]}
                >
                  {step.quiz!.explanation}
                </Text>
              </View>
            )}
          </ScrollView>
        );

      case "checklist":
        return (
          <ScrollView
            style={styles.stepContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styles.stepTitle, { color: theme.text }]}>
              {step.title}
            </Text>
            <Text style={[styles.stepText, { color: theme.textSecondary }]}>
              {step.content}
            </Text>

            {step.checklist!.items.map((item: string, index: number) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.checklistItem,
                  { backgroundColor: theme.surface },
                ]}
                onPress={() => handleChecklistToggle(index)}
              >
                <View
                  style={[
                    styles.checkbox,
                    {
                      backgroundColor: checklistItems[index]
                        ? theme.primary
                        : "transparent",
                      borderColor: theme.border,
                    },
                  ]}
                >
                  {checklistItems[index] && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </View>
                <Text style={[styles.checklistText, { color: theme.text }]}>
                  {item}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        );

      case "interactive":
        return (
          <ScrollView
            style={styles.stepContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styles.stepTitle, { color: theme.text }]}>
              {step.title}
            </Text>
            {step.imageUrl && (
              <Image source={{ uri: step.imageUrl }} style={styles.stepImage} />
            )}
            <Text style={[styles.stepText, { color: theme.textSecondary }]}>
              {step.content}
            </Text>

            <View
              style={[
                styles.notesContainer,
                { backgroundColor: theme.surface },
              ]}
            >
              <Text style={[styles.notesLabel, { color: theme.text }]}>
                Your Notes:
              </Text>
              <TextInput
                style={[
                  styles.notesInput,
                  { color: theme.text, borderColor: theme.border },
                ]}
                multiline
                placeholder="Write your thoughts, questions, or observations here..."
                placeholderTextColor={theme.textSecondary}
                value={userNotes}
                onChangeText={setUserNotes}
              />
            </View>
          </ScrollView>
        );

      default:
        return (
          <Text style={[styles.stepText, { color: theme.text }]}>
            Unknown step type: {step.type}
          </Text>
        );
    }
  };

  if (!lesson || !lesson.steps || lesson.steps.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.loadingText, { color: theme.text }]}>
          Loading lesson...
        </Text>
      </View>
    );
  }

  const currentStep = lesson.steps[currentStepIndex];

  // Handle case where currentStepIndex is out of bounds
  if (!currentStep) {
    // Reset to first step if current step is invalid
    if (currentStepIndex !== 0) {
      setCurrentStepIndex(0);
    }
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.loadingText, { color: theme.text }]}>
          Loading lesson...
        </Text>
      </View>
    );
  }

  const canProceed =
    currentStep.type === "quiz"
      ? selectedAnswer !== null || showQuizResult
      : true;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.primary }]}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.exitButton} onPress={handleExit}>
          <Image
            source={require("../assets/in_app_icons/back.png")}
            style={{ width: 24, height: 24, tintColor: "#fff" }}
          />
        </TouchableOpacity>

        <View style={styles.progressContainer}>
          <View
            style={[
              styles.progressTrack,
              { backgroundColor: "rgba(255,255,255,0.3)" },
            ]}
          >
            <Animated.View
              style={[
                styles.progressBar,
                {
                  backgroundColor: "#fff",
                  width: progressAnim.interpolate({
                    inputRange: [0, 100],
                    outputRange: ["0%", "100%"],
                    extrapolate: "clamp",
                  }),
                },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {currentStepIndex + 1} / {lesson.steps.length}
          </Text>
        </View>
      </View>

      {/* Content */}
      <View style={[styles.content, { backgroundColor: theme.background }]}>
        {renderStep()}
      </View>

      {/* Navigation */}
      <View style={[styles.navigation, { backgroundColor: theme.background }]}>
        <TouchableOpacity
          style={[
            styles.navButton,
            styles.prevButton,
            {
              backgroundColor: theme.surface,
              opacity: currentStepIndex === 0 ? 0.5 : 1,
            },
          ]}
          onPress={handlePrevious}
          disabled={currentStepIndex === 0}
        >
          <Text style={[styles.navButtonText, { color: theme.text }]}>
            Previous
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.navButton,
            styles.nextButton,
            {
              backgroundColor: canProceed ? theme.primary : theme.textSecondary,
              opacity: canProceed ? 1 : 0.5,
            },
          ]}
          onPress={handleNext}
          disabled={!canProceed}
        >
          <Text style={styles.nextButtonText}>
            {currentStep.type === "quiz" && !showQuizResult
              ? "Submit"
              : currentStepIndex === lesson.steps.length - 1
              ? "Complete"
              : "Next"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
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
  exitButton: {
    padding: 10,
    marginRight: 15,
  },
  progressContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    marginRight: 15,
  },
  progressBar: {
    height: "100%",
    borderRadius: 3,
  },
  progressText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inder",
    minWidth: 50,
  },
  content: {
    flex: 1,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
  },
  stepContainer: {
    flex: 1,
    padding: 20,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: "bold",
    fontFamily: "Inder",
    marginBottom: 20,
    lineHeight: 32,
  },
  stepImage: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    marginBottom: 20,
    resizeMode: "cover",
  },
  stepText: {
    fontSize: 16,
    fontFamily: "Inder",
    lineHeight: 24,
    marginBottom: 20,
  },
  videoPlaceholder: {
    backgroundColor: "#000",
    borderRadius: 12,
    height: 200,
    marginBottom: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  videoText: {
    color: "#fff",
    fontSize: 24,
    fontFamily: "Inder",
    marginBottom: 10,
  },
  videoSubtext: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inder",
    textAlign: "center",
    paddingHorizontal: 20,
  },
  quizQuestion: {
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "Inder",
    marginBottom: 20,
    lineHeight: 26,
  },
  quizOption: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  quizOptionContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  quizRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    marginRight: 12,
  },
  quizOptionText: {
    fontSize: 16,
    fontFamily: "Inder",
    flex: 1,
  },
  correctIcon: {
    fontSize: 18,
    color: "#4CAF50",
    fontWeight: "bold",
  },
  quizExplanation: {
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  explanationTitle: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inder",
    marginBottom: 8,
  },
  explanationText: {
    fontSize: 14,
    fontFamily: "Inder",
    lineHeight: 20,
  },
  checklistItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    marginRight: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  checkmark: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  checklistText: {
    fontSize: 16,
    fontFamily: "Inder",
    flex: 1,
  },
  notesContainer: {
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
  },
  notesLabel: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inder",
    marginBottom: 12,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    fontFamily: "Inder",
    minHeight: 100,
    textAlignVertical: "top",
  },
  navigation: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 20,
    paddingTop: 10,
  },
  navButton: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 25,
    minWidth: 100,
    alignItems: "center",
  },
  prevButton: {
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
  },
  nextButton: {
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inder",
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inder",
    color: "#fff",
  },
  loadingText: {
    fontSize: 18,
    textAlign: "center",
    marginTop: 100,
    fontFamily: "Inder",
  },
});

export default LessonScreen;
