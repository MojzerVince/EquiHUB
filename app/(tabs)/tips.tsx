import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import TutorialListScreen from "../../components/TutorialListScreen";
import { useSubscription } from "../../contexts/SubscriptionContext";
import { useTheme } from "../../contexts/ThemeContext";

// TypeScript interfaces
interface TutorialCategory {
  id: string;
  title: string;
  description: string;
  icon: string;
  tutorialCount: number;
  tutorials: Tutorial[];
}

interface Tutorial {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  lessonCount: number;
  duration: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  category: string;
  isLocked?: boolean;
  proOnly?: boolean;
}

interface StartedLesson {
  id: string;
  tutorialId: string;
  title: string;
  description: string;
  imageUrl: string;
  lessonCount: number;
  completedLessons: number;
  duration: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  category: string;
  lastAccessedDate: string;
  progressPercentage: number;
}

interface EmergencyStep {
  id: string;
  title: string;
  description: string;
  steps: string[];
  urgency: "Critical" | "Urgent" | "Important";
  icon: string;
  keywords: string[];
}

const CoachScreen = () => {
  const { currentTheme } = useTheme();
  const { isProMember } = useSubscription();
  const theme = currentTheme.colors;
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTutorial, setSelectedTutorial] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [showTutorialModal, setShowTutorialModal] = useState(false);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [emergencySearchQuery, setEmergencySearchQuery] = useState("");

  // Performance tracking state (real data only)
  const [totalTimeSpent, setTotalTimeSpent] = useState(0); // Total hours spent learning
  const [totalLessonsCompleted, setTotalLessonsCompleted] = useState(0); // Total lessons completed

  // Performance counter animation state
  const [displayTimeSpent, setDisplayTimeSpent] = useState(0);
  const [displayLessonsCompleted, setDisplayLessonsCompleted] = useState(0);

  // Real data for started lessons with progress (no mock data)
  const [startedLessons, setStartedLessons] = useState<StartedLesson[]>([
    // Real lesson progress will be added here when users actually start tutorials
    // Example: A user has completed "Basic Horse First Aid" (2 out of 2 lessons)
    {
      id: "started-basic-first-aid",
      tutorialId: "basic-first-aid",
      title: "Basic Horse First Aid",
      description:
        "Learn essential first aid techniques for common horse injuries and emergencies",
      imageUrl:
        "https://images.unsplash.com/photo-1553284965-83fd3e82fa5a?w=400&h=200&fit=crop",
      lessonCount: 2,
      completedLessons: 2, // Both lessons completed
      duration: "20 min",
      difficulty: "Beginner",
      category: "first-aid",
      lastAccessedDate: "2025-09-11",
      progressPercentage: 100,
    },
  ]);

  // Mock data for tutorial categories and content
  const tutorialCategories: TutorialCategory[] = [
    {
      id: "first-aid",
      title: "Horse First Aid",
      description: "Essential emergency care and health monitoring",
      icon: "🏥",
      tutorialCount: 3,
      tutorials: [
        {
          id: "basic-first-aid",
          title: "Basic Horse First Aid",
          description:
            "Learn essential first aid techniques for common horse injuries and emergencies",
          imageUrl:
            "https://images.unsplash.com/photo-1553284965-83fd3e82fa5a?w=400&h=200&fit=crop",
          lessonCount: 2,
          duration: "20 min",
          difficulty: "Beginner",
          category: "first-aid",
        },
        {
          id: "wound-care",
          title: "Wound Care & Bandaging",
          description:
            "Step-by-step guide to proper wound cleaning and bandaging techniques",
          imageUrl:
            "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=200&fit=crop",
          lessonCount: 4,
          duration: "30 min",
          difficulty: "Intermediate",
          category: "first-aid",
          proOnly: true,
        },
        {
          id: "emergency-assessment",
          title: "Emergency Assessment",
          description:
            "How to quickly assess a horse's condition and determine when to call a vet",
          imageUrl:
            "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=400&h=200&fit=crop",
          lessonCount: 3,
          duration: "25 min",
          difficulty: "Beginner",
          category: "first-aid",
          proOnly: true,
        },
      ],
    },
    {
      id: "grooming",
      title: "Grooming & Care",
      description: "Daily care routines and grooming techniques",
      icon: "🪮",
      tutorialCount: 3,
      tutorials: [
        {
          id: "daily-grooming",
          title: "Daily Grooming Routine",
          description:
            "Master the essential daily grooming routine for your horse's health and happiness",
          imageUrl:
            "https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=400&h=200&fit=crop",
          lessonCount: 5,
          duration: "35 min",
          difficulty: "Beginner",
          category: "grooming",
        },
        {
          id: "hoof-care",
          title: "Hoof Care Essentials",
          description:
            "Learn proper hoof picking, cleaning, and basic hoof health assessment",
          imageUrl:
            "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=200&fit=crop",
          lessonCount: 4,
          duration: "25 min",
          difficulty: "Beginner",
          category: "grooming",
          proOnly: true,
        },
        {
          id: "grooming-tools",
          title: "Grooming Tools & Equipment",
          description:
            "Complete guide to selecting and using the right grooming tools",
          imageUrl:
            "https://images.unsplash.com/photo-1569971629507-e8d8c863d045?w=400&h=200&fit=crop",
          lessonCount: 3,
          duration: "20 min",
          difficulty: "Beginner",
          category: "grooming",
          proOnly: true,
        },
      ],
    },
    {
      id: "riding",
      title: "Riding Techniques",
      description: "Improve your riding skills and techniques",
      icon: "🐎",
      tutorialCount: 3,
      tutorials: [
        {
          id: "basic-seat",
          title: "Correct Riding Position",
          description:
            "Develop a balanced and effective riding position for better communication with your horse",
          imageUrl:
            "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=200&fit=crop",
          lessonCount: 7,
          duration: "50 min",
          difficulty: "Beginner",
          category: "riding",
        },
        {
          id: "jumping-basics",
          title: "Introduction to Jumping",
          description:
            "Safe and progressive introduction to jumping with proper form and technique",
          imageUrl:
            "https://images.unsplash.com/photo-1596409883732-bb20556caa8e?w=400&h=200&fit=crop",
          lessonCount: 10,
          duration: "75 min",
          difficulty: "Intermediate",
          category: "riding",
          isLocked: true,
        },
        {
          id: "gait-transitions",
          title: "Smooth Gait Transitions",
          description:
            "Master smooth transitions between walk, trot, and canter",
          imageUrl:
            "https://images.unsplash.com/photo-1553284965-83fd3e82fa5a?w=400&h=200&fit=crop",
          lessonCount: 6,
          duration: "40 min",
          difficulty: "Intermediate",
          category: "riding",
          proOnly: true,
        },
      ],
    },
    {
      id: "training",
      title: "Horse Training",
      description: "Training methods and behavioral understanding",
      icon: "🎯",
      tutorialCount: 2,
      tutorials: [
        {
          id: "ground-work",
          title: "Foundation Ground Work",
          description:
            "Build trust and communication through essential ground work exercises",
          imageUrl:
            "https://images.unsplash.com/photo-1568605117036-3c6b41d19432?w=400&h=200&fit=crop",
          lessonCount: 8,
          duration: "60 min",
          difficulty: "Beginner",
          category: "training",
        },
        {
          id: "leading-techniques",
          title: "Safe Leading Techniques",
          description: "Learn proper leading techniques for safety and respect",
          imageUrl:
            "https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=400&h=200&fit=crop",
          lessonCount: 4,
          duration: "30 min",
          difficulty: "Beginner",
          category: "training",
          proOnly: true,
        },
      ],
    },
  ];

  // Emergency First Aid Data
  const emergencySteps: EmergencyStep[] = [
    {
      id: "colic",
      title: "Colic (Abdominal Pain)",
      description: "Immediate steps for suspected colic",
      urgency: "Critical",
      icon: "🚨",
      keywords: [
        "colic",
        "stomach",
        "pain",
        "rolling",
        "lying down",
        "sweating",
      ],
      steps: [
        "Remove all food and water immediately",
        "Call your veterinarian - this is an emergency",
        "Keep the horse moving by walking slowly",
        "Do NOT allow the horse to roll or lie down",
        "Monitor vital signs (temperature, pulse, respiration)",
        "Note symptoms and time of onset for the vet",
        "Stay calm but act quickly",
      ],
    },
    {
      id: "cuts-wounds",
      title: "Cuts and Open Wounds",
      description: "First aid for bleeding wounds",
      urgency: "Urgent",
      icon: "🩹",
      keywords: ["cut", "wound", "bleeding", "laceration", "injury"],
      steps: [
        "Stay calm and approach the horse carefully",
        "Apply direct pressure with clean cloth to control bleeding",
        "Do NOT remove embedded objects",
        "Clean around the wound (not inside) with saline solution",
        "Apply sterile bandage if possible",
        "Call veterinarian for wounds deeper than skin level",
        "Monitor for signs of shock",
        "Keep wound covered and horse calm",
      ],
    },
    {
      id: "choking",
      title: "Choking",
      description: "When horse cannot swallow or breathe properly",
      urgency: "Critical",
      icon: "🫁",
      keywords: [
        "choking",
        "coughing",
        "gagging",
        "difficulty swallowing",
        "feed",
      ],
      steps: [
        "Remove all food and water immediately",
        "Call veterinarian immediately",
        "Keep horse's head lowered to help drainage",
        "Do NOT attempt to remove object manually",
        "Gently massage throat area (external only)",
        "Monitor breathing closely",
        "Stay with the horse until help arrives",
      ],
    },
    {
      id: "lameness",
      title: "Sudden Severe Lameness",
      description: "Acute limb injury or pain",
      urgency: "Urgent",
      icon: "🦵",
      keywords: [
        "lameness",
        "limping",
        "leg",
        "hoof",
        "pain",
        "not weight bearing",
      ],
      steps: [
        "Stop all activity immediately",
        "Confine horse to prevent further injury",
        "Examine hoof for obvious foreign objects",
        "Apply ice to swollen areas (20 min on, 20 min off)",
        "Do NOT give pain medication without vet approval",
        "Call veterinarian for assessment",
        "Keep detailed notes on symptoms",
        "Provide soft, level footing",
      ],
    },
    {
      id: "eye-injury",
      title: "Eye Injury",
      description: "Trauma or foreign object in eye",
      urgency: "Urgent",
      icon: "👁️",
      keywords: [
        "eye",
        "injury",
        "swollen",
        "discharge",
        "squinting",
        "foreign object",
      ],
      steps: [
        "Do NOT touch or rub the affected eye",
        "Rinse gently with clean saline solution only",
        "Cover eye with clean, damp cloth if needed",
        "Keep horse in darkened area",
        "Call veterinarian immediately",
        "Prevent horse from rubbing eye",
        "Note any discharge or changes in appearance",
      ],
    },
    {
      id: "heat-exhaustion",
      title: "Heat Exhaustion/Overheating",
      description: "Signs of overheating and dehydration",
      urgency: "Urgent",
      icon: "🌡️",
      keywords: [
        "heat",
        "exhaustion",
        "overheating",
        "hot",
        "sweating",
        "dehydration",
      ],
      steps: [
        "Move horse to shade immediately",
        "Apply cool (not cold) water to neck, chest, and legs",
        "Provide small amounts of cool water to drink",
        "Use fans if available for air circulation",
        "Monitor temperature every 15 minutes",
        "Call vet if temperature exceeds 103°F (39.4°C)",
        "Continue cooling until temperature normalizes",
        "Watch for signs of shock",
      ],
    },
    {
      id: "vital-signs",
      title: "How to Check Vital Signs",
      description: "Essential monitoring techniques",
      urgency: "Important",
      icon: "💓",
      keywords: [
        "vital signs",
        "temperature",
        "pulse",
        "heart rate",
        "breathing",
      ],
      steps: [
        "Temperature: Use digital thermometer rectally (normal: 99-101°F)",
        "Pulse: Find artery under jaw or behind elbow (normal: 28-44 bpm)",
        "Respiration: Count chest movements (normal: 8-16 breaths/min)",
        "Capillary refill: Press gum, should return to pink in 2 seconds",
        "Record all measurements with time",
        "Note any abnormal findings",
        "Compare to horse's normal baseline values",
      ],
    },
    {
      id: "poisoning",
      title: "Suspected Poisoning",
      description: "Toxic plant or substance ingestion",
      urgency: "Critical",
      icon: "☠️",
      keywords: [
        "poisoning",
        "toxic",
        "plants",
        "chemicals",
        "drooling",
        "seizures",
      ],
      steps: [
        "Remove horse from source immediately",
        "Call veterinarian and poison control if available",
        "Do NOT induce vomiting",
        "Save sample of suspected poison if safe to do so",
        "Note time of exposure and amount if known",
        "Monitor breathing and heart rate closely",
        "Keep horse calm and still",
        "Provide supportive care as directed by vet",
      ],
    },
  ];

  // Counter animation effect for performance metrics
  useEffect(() => {
    const animateCounters = () => {
      const duration = 2000; // 2 seconds
      const steps = 60; // 60 frames for smooth animation
      const timeIncrement = totalTimeSpent / steps;
      const lessonsIncrement = totalLessonsCompleted / steps;

      let currentStep = 0;
      const timer = setInterval(() => {
        currentStep++;
        setDisplayTimeSpent(timeIncrement * currentStep);
        setDisplayLessonsCompleted(Math.floor(lessonsIncrement * currentStep));

        if (currentStep >= steps) {
          clearInterval(timer);
          setDisplayTimeSpent(totalTimeSpent);
          setDisplayLessonsCompleted(totalLessonsCompleted);
        }
      }, duration / steps);

      return timer;
    };

    const timer = animateCounters();
    return () => clearInterval(timer);
  }, [totalTimeSpent, totalLessonsCompleted]);

  // Calculate real performance data based on started lessons
  useEffect(() => {
    const calculatePerformance = () => {
      // Calculate total lessons completed across all started tutorials (REAL DATA ONLY)
      const completedCount = startedLessons.reduce(
        (sum, lesson) => sum + lesson.completedLessons,
        0
      );

      // Calculate total time spent based on actual lessons completed (REAL DATA ONLY)
      const timeSpent = startedLessons.reduce((sum, lesson) => {
        const durationMinutes = parseInt(lesson.duration.replace(" min", ""));
        const lessonDuration = durationMinutes / lesson.lessonCount; // minutes per lesson
        const timeForCompletedLessons =
          lesson.completedLessons * lessonDuration;
        return sum + timeForCompletedLessons / 60; // convert to hours
      }, 0);

      // Use only real data - no base values
      setTotalTimeSpent(Number(timeSpent.toFixed(1)));
      setTotalLessonsCompleted(completedCount);
    };

    calculatePerformance();
  }, [startedLessons]);

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

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case "Critical":
        return "#F44336";
      case "Urgent":
        return "#FF9800";
      case "Important":
        return "#2196F3";
      default:
        return theme.textSecondary;
    }
  };

  const filteredEmergencySteps = emergencySteps.filter(
    (step) =>
      step.title.toLowerCase().includes(emergencySearchQuery.toLowerCase()) ||
      step.description
        .toLowerCase()
        .includes(emergencySearchQuery.toLowerCase()) ||
      step.keywords.some((keyword) =>
        keyword.toLowerCase().includes(emergencySearchQuery.toLowerCase())
      )
  );

  const onRefresh = async () => {
    setRefreshing(true);
    // In a real app, you would fetch updated progress from an API
    // For now, just refresh the data without making changes

    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  const updateLessonProgress = (
    tutorialId: string,
    completedLessons: number
  ) => {
    setStartedLessons(
      (prevLessons) =>
        prevLessons.map((lesson) =>
          lesson.tutorialId === tutorialId
            ? {
                ...lesson,
                completedLessons,
                progressPercentage: Math.round(
                  (completedLessons / lesson.lessonCount) * 100
                ),
                lastAccessedDate: new Date().toISOString().split("T")[0],
              }
            : lesson
        )
      // Keep completed lessons in the list for "Continue Learning" section
      // They will show as completed and allow review
    );
  };

  // Function to complete a specific lesson (would be called from lesson completion)
  const completeLessonById = (tutorialId: string, lessonIndex: number) => {
    const tutorial = tutorialCategories
      .flatMap((cat) => cat.tutorials)
      .find((t) => t.id === tutorialId);
    if (!tutorial) return;

    setStartedLessons((prevLessons) => {
      const existingLesson = prevLessons.find(
        (lesson) => lesson.tutorialId === tutorialId
      );

      if (existingLesson) {
        // Update existing lesson progress
        const newCompleted = Math.min(
          existingLesson.completedLessons + 1,
          tutorial.lessonCount
        );
        return prevLessons.map((lesson) =>
          lesson.tutorialId === tutorialId
            ? {
                ...lesson,
                completedLessons: newCompleted,
                progressPercentage: Math.round(
                  (newCompleted / lesson.lessonCount) * 100
                ),
                lastAccessedDate: new Date().toISOString().split("T")[0],
              }
            : lesson
        );
      } else {
        // Create new started lesson
        const newStartedLesson: StartedLesson = {
          id: `started-${tutorial.id}`,
          tutorialId: tutorial.id,
          title: tutorial.title,
          description: tutorial.description,
          imageUrl: tutorial.imageUrl,
          lessonCount: tutorial.lessonCount,
          completedLessons: 1,
          duration: tutorial.duration,
          difficulty: tutorial.difficulty,
          category: tutorial.category,
          lastAccessedDate: new Date().toISOString().split("T")[0],
          progressPercentage: Math.round((1 / tutorial.lessonCount) * 100),
        };
        return [...prevLessons, newStartedLesson];
      }
    });
  };

  const addToStartedLessons = (tutorial: Tutorial) => {
    // Check if tutorial is already in started lessons
    const isAlreadyStarted = startedLessons.some(
      (lesson) => lesson.tutorialId === tutorial.id
    );

    if (!isAlreadyStarted) {
      const newStartedLesson: StartedLesson = {
        id: `started-${tutorial.id}`,
        tutorialId: tutorial.id,
        title: tutorial.title,
        description: tutorial.description,
        imageUrl: tutorial.imageUrl,
        lessonCount: tutorial.lessonCount,
        completedLessons: 0,
        duration: tutorial.duration,
        difficulty: tutorial.difficulty,
        category: tutorial.category,
        lastAccessedDate: new Date().toISOString().split("T")[0],
        progressPercentage: 0,
      };

      setStartedLessons((prev) => [...prev, newStartedLesson]);
    }
  };

  const handleStartTutorial = (tutorialId: string, tutorialTitle: string) => {
    // Find the tutorial to check if it's pro only
    const tutorial = tutorialCategories
      .flatMap((cat) => cat.tutorials)
      .find((t) => t.id === tutorialId);

    // Check if tutorial requires Pro membership
    if (tutorial?.proOnly && !isProMember) {
      // Navigate to pro features screen
      router.push("/pro-features");
      return;
    }

    // Add tutorial to started lessons if it's not already there
    if (tutorial) {
      addToStartedLessons(tutorial);
    }

    setSelectedTutorial({ id: tutorialId, title: tutorialTitle });
    setShowTutorialModal(true);
  };

  const handleCloseTutorial = () => {
    setShowTutorialModal(false);
    setSelectedTutorial(null);
  };

  const renderCategoryCard = (category: TutorialCategory) => (
    <TouchableOpacity
      key={category.id}
      style={[styles.categoryCard, { backgroundColor: theme.surface }]}
      activeOpacity={0.8}
      onPress={() => setSelectedCategory(category.id)}
    >
      <View style={styles.categoryHeader}>
        <Text style={styles.categoryIcon}>{category.icon}</Text>
        <View style={styles.categoryInfo}>
          <Text style={[styles.categoryTitle, { color: theme.text }]}>
            {category.title}
          </Text>
          <Text
            style={[styles.categoryDescription, { color: theme.textSecondary }]}
          >
            {category.description}
          </Text>
        </View>
        <View
          style={[styles.tutorialCount, { backgroundColor: theme.primary }]}
        >
          <Text style={styles.tutorialCountText}>{category.tutorialCount}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderTutorialCard = (tutorial: Tutorial) => {
    const isProOnlyAndNotMember = tutorial.proOnly && !isProMember;
    const isAccessible =
      !tutorial.isLocked && !(tutorial.proOnly && !isProMember);

    // Check if this tutorial is completed
    const completedLesson = startedLessons.find(
      (lesson) =>
        lesson.tutorialId === tutorial.id &&
        lesson.completedLessons >= lesson.lessonCount
    );
    const isCompleted = !!completedLesson;

    return (
      <TouchableOpacity
        key={tutorial.id}
        style={[
          styles.tutorialCard,
          { backgroundColor: theme.surface },
          isProOnlyAndNotMember && { opacity: 0.7 },
        ]}
        activeOpacity={0.8}
        disabled={tutorial.isLocked}
        onPress={() => {
          if (tutorial.isLocked) return;
          if (isProOnlyAndNotMember) {
            router.push("/pro-features");
          } else {
            handleStartTutorial(tutorial.id, tutorial.title);
          }
        }}
      >
        <View style={styles.tutorialImageContainer}>
          <Image
            source={{ uri: tutorial.imageUrl }}
            style={styles.tutorialImage}
          />
          {tutorial.isLocked && (
            <View style={styles.lockedOverlay}>
              <Text style={styles.lockedIcon}>🔒</Text>
            </View>
          )}
          {isProOnlyAndNotMember && (
            <View style={styles.proOnlyOverlay}>
              <View style={styles.proOnlyBadge}>
                <Text style={styles.proOnlyText}>PRO ONLY</Text>
              </View>
            </View>
          )}
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.7)"]}
            style={styles.imageGradient}
          >
            <View style={styles.tutorialBadges}>
              <View
                style={[
                  styles.difficultyBadge,
                  { backgroundColor: getDifficultyColor(tutorial.difficulty) },
                ]}
              >
                <Text style={styles.badgeText}>{tutorial.difficulty}</Text>
              </View>
              <View
                style={[
                  styles.durationBadge,
                  { backgroundColor: "rgba(255,255,255,0.9)" },
                ]}
              >
                <Text style={[styles.badgeText, { color: "#333" }]}>
                  {tutorial.duration}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        <View style={styles.tutorialContent}>
          <View style={styles.tutorialTitleContainer}>
            <Text
              style={[styles.tutorialTitle, { color: theme.text }]}
              numberOfLines={2}
            >
              {tutorial.title}
            </Text>
            {tutorial.proOnly && (
              <View
                style={[
                  styles.proLabel,
                  {
                    backgroundColor: isProMember ? "#FFD700" : "#FF6B35",
                    opacity: isProMember ? 1 : 0.8,
                  },
                ]}
              >
                <Text style={styles.proLabelText}>PRO</Text>
              </View>
            )}
          </View>
          <Text
            style={[styles.tutorialDescription, { color: theme.textSecondary }]}
            numberOfLines={2}
          >
            {tutorial.description}
          </Text>
          <View style={styles.tutorialFooter}>
            <Text style={[styles.lessonCount, { color: theme.primary }]}>
              {tutorial.lessonCount} lessons
            </Text>
            {isCompleted ? (
              <View
                style={[styles.completedBadge, { backgroundColor: "#4CAF50" }]}
              >
                <Text style={styles.completedBadgeText}>✓ Completed</Text>
              </View>
            ) : isProOnlyAndNotMember ? (
              <Text style={[styles.upgradeText, { color: "#FF6B35" }]}>
                Tap to upgrade
              </Text>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderStartedLessonCard = (lesson: StartedLesson) => {
    return (
      <TouchableOpacity
        key={lesson.id}
        style={[styles.startedLessonCard, { backgroundColor: theme.surface }]}
        activeOpacity={0.8}
        onPress={() => handleStartTutorial(lesson.tutorialId, lesson.title)}
      >
        <View style={styles.startedLessonIcon}>
          <View
            style={[
              styles.startedLessonIconContainer,
              { backgroundColor: theme.primary },
            ]}
          >
            <Text style={styles.startedLessonIconText}>
              {lesson.completedLessons >= lesson.lessonCount ? "✓" : "▶"}
            </Text>
          </View>
        </View>

        <View style={styles.startedLessonContent}>
          <View style={styles.startedLessonHeader}>
            <Text
              style={[styles.startedLessonTitle, { color: theme.text }]}
              numberOfLines={1}
            >
              {lesson.title}
            </Text>
            <View
              style={[
                styles.startedLessonDifficulty,
                { backgroundColor: getDifficultyColor(lesson.difficulty) },
              ]}
            >
              <Text style={styles.startedLessonDifficultyText}>
                {lesson.difficulty}
              </Text>
            </View>
            <Text
              style={[
                styles.startedLessonDuration,
                { color: theme.textSecondary },
              ]}
            >
              {lesson.duration}
            </Text>
          </View>

          <Text
            style={[
              styles.startedLessonDescription,
              { color: theme.textSecondary },
            ]}
            numberOfLines={1}
          >
            {lesson.description}
          </Text>

          <View style={styles.startedLessonFooter}>
            <Text
              style={[
                styles.startedLessonProgress,
                { color: theme.textSecondary },
              ]}
            >
              {lesson.completedLessons >= lesson.lessonCount
                ? "Review"
                : `${lesson.completedLessons}/${lesson.lessonCount} lessons completed`}
            </Text>
            <Text
              style={[
                styles.startedLessonArrow,
                { color: theme.textSecondary },
              ]}
            >
              →
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const selectedCategoryData = tutorialCategories.find(
    (cat) => cat.id === selectedCategory
  );

  const renderEmergencyModal = () => (
    <Modal
      visible={showEmergencyModal}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={() => setShowEmergencyModal(false)}
    >
      <View style={[styles.container, { backgroundColor: theme.primary }]}>
        <SafeAreaView
          style={[styles.safeArea, { backgroundColor: theme.primary }]}
        >
          <View style={styles.headerContainer}>
            <View style={styles.headerWithBack}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setShowEmergencyModal(false)}
              >
                <Image
                  source={require("../../assets/in_app_icons/back.png")}
                  style={{ width: 26, height: 26 }}
                />
              </TouchableOpacity>
              <Text style={styles.header}>Emergency First Aid</Text>
            </View>
          </View>
        </SafeAreaView>

        <ScrollView
          style={[
            styles.viewPort,
            { backgroundColor: currentTheme.colors.background },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.contentContainer}>
            {/* Search Bar */}
            <View
              style={[
                styles.searchContainer,
                { backgroundColor: theme.surface },
              ]}
            >
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={[styles.searchInput, { color: theme.text }]}
                placeholder="Search emergency situations..."
                placeholderTextColor={theme.textSecondary}
                value={emergencySearchQuery}
                onChangeText={setEmergencySearchQuery}
              />
            </View>

            {/* Emergency Instructions */}
            <View style={styles.emergencyInstructions}>
              <Text style={[styles.emergencyTitle, { color: "#F44336" }]}>
                ⚠️ EMERGENCY PROTOCOL
              </Text>
              <Text style={[styles.emergencySubtitle, { color: theme.text }]}>
                In any life-threatening situation, call your veterinarian
                immediately!
              </Text>
            </View>

            {/* Emergency Steps */}
            <View style={styles.emergencyStepsContainer}>
              {filteredEmergencySteps.map((step) => (
                <View
                  key={step.id}
                  style={[
                    styles.emergencyCard,
                    { backgroundColor: theme.surface },
                  ]}
                >
                  <View style={styles.emergencyHeader}>
                    <View style={styles.emergencyTitleContainer}>
                      <Text style={styles.emergencyIcon}>{step.icon}</Text>
                      <View style={styles.emergencyInfo}>
                        <Text
                          style={[
                            styles.emergencyCardTitle,
                            { color: theme.text },
                          ]}
                        >
                          {step.title}
                        </Text>
                        <Text
                          style={[
                            styles.emergencyDescription,
                            { color: theme.textSecondary },
                          ]}
                        >
                          {step.description}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.urgencyBadge,
                          { backgroundColor: getUrgencyColor(step.urgency) },
                        ]}
                      >
                        <Text style={styles.urgencyText}>{step.urgency}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.emergencySteps}>
                    {step.steps.map((stepText, index) => (
                      <View key={index} style={styles.emergencyStep}>
                        <View
                          style={[
                            styles.stepNumber,
                            { backgroundColor: theme.primary },
                          ]}
                        >
                          <Text style={styles.stepNumberText}>{index + 1}</Text>
                        </View>
                        <Text style={[styles.stepText, { color: theme.text }]}>
                          {stepText}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>

            {filteredEmergencySteps.length === 0 && (
              <View style={styles.noResultsContainer}>
                <Text
                  style={[styles.noResultsText, { color: theme.textSecondary }]}
                >
                  No emergency procedures found for "{emergencySearchQuery}"
                </Text>
                <Text
                  style={[styles.noResultsTip, { color: theme.textSecondary }]}
                >
                  Try searching for terms like "colic", "wound", "lameness", or
                  "choking"
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );

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
          {selectedCategory ? (
            <View style={styles.headerWithBack}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setSelectedCategory(null)}
              >
                <Image
                  source={require("../../assets/in_app_icons/back.png")}
                  style={{ width: 26, height: 26 }}
                />
              </TouchableOpacity>
              <Text style={styles.header}>
                {selectedCategoryData?.title || "Tutorials"}
              </Text>
            </View>
          ) : (
            <Text style={styles.header}>Tips & Guides</Text>
          )}
        </View>
      </SafeAreaView>
      <ScrollView
        style={[
          styles.viewPort,
          { backgroundColor: currentTheme.colors.background },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {selectedCategory ? (
          // Show tutorials for selected category
          <View style={styles.tutorialsContainer}>
            <View style={styles.categoryBanner}>
              <Text style={styles.categoryBannerIcon}>
                {selectedCategoryData?.icon}
              </Text>
              <Text
                style={[
                  styles.categoryBannerDescription,
                  { color: theme.textSecondary },
                ]}
              >
                {selectedCategoryData?.description}
              </Text>
            </View>

            <View style={styles.tutorialsList}>
              {selectedCategoryData?.tutorials.map(renderTutorialCard)}
            </View>
          </View>
        ) : (
          // Show category overview
          <View style={styles.contentContainer}>
            <View style={styles.introSection}>
              <Text style={[styles.introTitle, { color: theme.text }]}>
                Learn & Improve Your Horsemanship
              </Text>
              <Text
                style={[
                  styles.introDescription,
                  { color: theme.textSecondary },
                ]}
              >
                Explore our comprehensive guides and tutorials to enhance your
                skills in horse care, riding, and training.
              </Text>
            </View>

            {/* Emergency First Aid Button */}
            <TouchableOpacity
              style={styles.emergencyButton}
              onPress={() => setShowEmergencyModal(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.emergencyButtonText}>
                🚨 Emergency First Aid Guide
              </Text>
            </TouchableOpacity>

            <View style={styles.featuredSection}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                {startedLessons.filter(
                  (lesson) => lesson.completedLessons < lesson.lessonCount
                ).length > 0
                  ? "Continue Learning"
                  : "Featured Tutorials"}
              </Text>
              <View style={styles.featuredTutorials}>
                {startedLessons.filter(
                  (lesson) => lesson.completedLessons < lesson.lessonCount
                ).length > 0
                  ? startedLessons
                      .filter(
                        (lesson) => lesson.completedLessons < lesson.lessonCount
                      )
                      .map(renderStartedLessonCard)
                  : tutorialCategories[0]?.tutorials[0] &&
                    renderTutorialCard(tutorialCategories[0].tutorials[0])}
              </View>
            </View>

            <View style={styles.categoriesContainer}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Browse Categories
              </Text>
              {tutorialCategories.map(renderCategoryCard)}
            </View>

            {/* My Performance Section */}
            <View style={styles.performanceSection}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                My Performance
              </Text>

              <View style={styles.performanceCards}>
                {/* Time Spent Card */}
                <View
                  style={[
                    styles.performanceCard,
                    { backgroundColor: theme.surface },
                  ]}
                >
                  <View style={styles.performanceIcon}>
                    <View
                      style={[
                        styles.performanceIconContainer,
                        { backgroundColor: theme.primary },
                      ]}
                    >
                      <Text style={styles.performanceIconText}>⏱️</Text>
                    </View>
                  </View>
                  <View style={styles.performanceContent}>
                    <Text style={styles.performanceLabel}>TIME SPENT</Text>
                    <Text
                      style={[styles.performanceValue, { color: theme.text }]}
                    >
                      {displayTimeSpent.toFixed(1)} hours
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.performanceArrow,
                      { color: theme.textSecondary },
                    ]}
                  >
                    ›
                  </Text>
                </View>

                {/* Lessons Completed Card */}
                <View
                  style={[
                    styles.performanceCard,
                    { backgroundColor: theme.surface },
                  ]}
                >
                  <View style={styles.performanceIcon}>
                    <View
                      style={[
                        styles.performanceIconContainer,
                        { backgroundColor: theme.accent },
                      ]}
                    >
                      <Text style={styles.performanceIconText}>🎯</Text>
                    </View>
                  </View>
                  <View style={styles.performanceContent}>
                    <Text style={styles.performanceLabel}>
                      LESSONS COMPLETED
                    </Text>
                    <Text
                      style={[styles.performanceValue, { color: theme.text }]}
                    >
                      {displayLessonsCompleted} lessons
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.performanceArrow,
                      { color: theme.textSecondary },
                    ]}
                  >
                    ›
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Emergency Modal */}
      {renderEmergencyModal()}

      {/* Tutorial Modal */}
      <Modal
        visible={showTutorialModal}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={handleCloseTutorial}
      >
        {selectedTutorial && (
          <TutorialListScreen
            tutorialId={selectedTutorial.id}
            tutorialTitle={selectedTutorial.title}
            onClose={handleCloseTutorial}
          />
        )}
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
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    marginBottom: -45,
    marginTop: -5,
  },
  header: {
    fontSize: 30,
    fontFamily: "Inder",
    color: "#fff",
    textAlign: "center",
    flex: 1,
    fontWeight: "600",
  },
  headerWithBack: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    justifyContent: "center",
    position: "relative",
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
  backButtonText: {
    fontSize: 16,
    color: "#FFFFFF",
    fontFamily: "Inder",
  },
  viewPort: {
    backgroundColor: "#FFFFFF",
    flex: 1,
    borderTopLeftRadius: 50,
    borderTopRightRadius: 50,
    marginTop: -8,
  },
  contentContainer: {
    paddingHorizontal: 20,
    marginTop: 20,
    paddingBottom: 130,
  },
  introSection: {
    marginBottom: 30,
    alignItems: "center",
  },
  introTitle: {
    fontSize: 24,
    fontWeight: "bold",
    fontFamily: "Inder",
    textAlign: "center",
    marginBottom: 10,
  },
  introDescription: {
    fontSize: 16,
    fontFamily: "Inder",
    textAlign: "center",
    lineHeight: 24,
  },
  categoriesContainer: {
    marginBottom: 30,
  },
  featuredSection: {
    marginTop: 0,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    fontFamily: "Inder",
    marginBottom: 16,
  },
  categoryCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  categoryIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: "bold",
    fontFamily: "Inder",
    marginBottom: 4,
  },
  categoryDescription: {
    fontSize: 14,
    fontFamily: "Inder",
    lineHeight: 20,
  },
  tutorialCount: {
    backgroundColor: "#007AFF",
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 5,
  },
  tutorialCountText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "bold",
    fontFamily: "Inder",
  },
  tutorialsContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 130,
  },
  categoryBanner: {
    alignItems: "center",
    marginBottom: 30,
  },
  categoryBannerIcon: {
    fontSize: 48,
    marginBottom: 10,
  },
  categoryBannerDescription: {
    fontSize: 16,
    fontFamily: "Inder",
    textAlign: "center",
  },
  tutorialsList: {
    gap: 16,
  },
  featuredTutorials: {
    marginTop: 8,
  },
  tutorialCard: {
    borderRadius: 16,
    overflow: "hidden",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    marginBottom: 16,
  },
  tutorialImageContainer: {
    position: "relative",
    height: 180,
  },
  tutorialImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  lockedOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  lockedIcon: {
    fontSize: 32,
    color: "#FFFFFF",
  },
  imageGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    justifyContent: "flex-end",
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  tutorialBadges: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  difficultyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  durationBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
    fontFamily: "Inder",
  },
  tutorialContent: {
    padding: 16,
  },
  tutorialTitle: {
    fontSize: 18,
    fontWeight: "bold",
    fontFamily: "Inder",
    lineHeight: 24,
    flex: 1,
  },
  tutorialDescription: {
    fontSize: 14,
    fontFamily: "Inder",
    lineHeight: 20,
    marginBottom: 16,
  },
  tutorialFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  lessonCount: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inder",
  },
  startButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  startButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inder",
  },
  proOnlyOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
  },
  proOnlyBadge: {
    backgroundColor: "#FF6B35",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#FFF",
  },
  proOnlyText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "bold",
    fontFamily: "Inder",
    letterSpacing: 1,
  },
  tutorialTitleContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  proLabel: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8,
    minWidth: 35,
    alignItems: "center",
  },
  proLabelText: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "bold",
    fontFamily: "Inder",
    letterSpacing: 0.5,
  },
  upgradeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    backgroundColor: "transparent",
  },
  upgradeButtonText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inder",
  },
  progressBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
    minWidth: 45,
    alignItems: "center",
  },
  progressBadgeText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "bold",
    fontFamily: "Inder",
  },
  progressContainer: {
    marginVertical: 12,
  },
  progressBarBackground: {
    height: 6,
    borderRadius: 3,
    marginBottom: 6,
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    fontFamily: "Inder",
  },
  continueButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  upgradeText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inder",
    fontStyle: "italic",
  },
  // Emergency Modal Styles
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    padding: 6,
    marginBottom: 20,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  searchIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inder",
  },
  emergencyInstructions: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: "#FFF3E0",
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#F44336",
  },
  emergencyTitle: {
    fontSize: 18,
    fontWeight: "bold",
    fontFamily: "Inder",
    marginBottom: 8,
  },
  emergencySubtitle: {
    fontSize: 14,
    fontFamily: "Inder",
    lineHeight: 20,
  },
  emergencyStepsContainer: {
    gap: 16,
  },
  emergencyCard: {
    borderRadius: 16,
    padding: 16,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    marginBottom: 16,
  },
  emergencyHeader: {
    marginBottom: 16,
  },
  emergencyTitleContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  emergencyIcon: {
    fontSize: 24,
    marginRight: 12,
    marginTop: 2,
  },
  emergencyInfo: {
    flex: 1,
  },
  emergencyCardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    fontFamily: "Inder",
    marginBottom: 4,
  },
  emergencyDescription: {
    fontSize: 14,
    fontFamily: "Inder",
    lineHeight: 20,
  },
  urgencyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 8,
    alignItems: "center",
  },
  urgencyText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "bold",
    fontFamily: "Inder",
  },
  emergencySteps: {
    gap: 12,
  },
  emergencyStep: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    marginTop: 2,
  },
  stepNumberText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "bold",
    fontFamily: "Inder",
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inder",
    lineHeight: 20,
  },
  noResultsContainer: {
    alignItems: "center",
    padding: 40,
  },
  noResultsText: {
    fontSize: 16,
    fontFamily: "Inder",
    textAlign: "center",
    marginBottom: 8,
  },
  noResultsTip: {
    fontSize: 14,
    fontFamily: "Inder",
    textAlign: "center",
  },
  emergencyButton: {
    backgroundColor: "#F44336",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    marginBottom: 20,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  emergencyButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
    fontFamily: "Inder",
    textAlign: "center",
  },

  // My Performance section styles
  performanceSection: {
    marginTop: 20,
    marginBottom: 20,
  },

  performanceCards: {
    gap: 12,
  },

  performanceCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },

  performanceIcon: {
    marginRight: 16,
  },

  performanceIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },

  performanceIconText: {
    fontSize: 20,
  },

  performanceContent: {
    flex: 1,
  },

  performanceLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
    marginBottom: 4,
    fontFamily: "Inder",
    letterSpacing: 0.5,
  },

  performanceValue: {
    fontSize: 18,
    fontWeight: "bold",
    fontFamily: "Inder",
  },

  performanceArrow: {
    fontSize: 18,
    fontWeight: "300",
  },

  // Started Lesson Card Styles (compact horizontal design)
  startedLessonCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  startedLessonIcon: {
    marginRight: 16,
  },
  startedLessonIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  startedLessonIconText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
    fontFamily: "Inder",
  },
  startedLessonContent: {
    flex: 1,
  },
  startedLessonHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    flexWrap: "wrap",
  },
  startedLessonTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inder",
    marginRight: 8,
    minWidth: 0, // Allows text to shrink if needed
  },
  startedLessonDifficulty: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginRight: 8,
  },
  startedLessonDifficultyText: {
    fontSize: 10,
    fontWeight: "600",
    color: "white",
    textTransform: "uppercase",
    fontFamily: "Inder",
  },
  startedLessonDuration: {
    fontSize: 12,
    fontFamily: "Inder",
  },
  startedLessonDescription: {
    fontSize: 13,
    fontFamily: "Inder",
    marginBottom: 8,
  },
  startedLessonFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  startedLessonProgress: {
    fontSize: 12,
    fontFamily: "Inder",
  },
  startedLessonArrow: {
    fontSize: 16,
    fontFamily: "Inder",
  },

  // Completed badge styles
  completedBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  completedBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "bold",
    fontFamily: "Inder",
  },
});

export default CoachScreen;
