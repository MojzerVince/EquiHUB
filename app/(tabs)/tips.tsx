import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
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

  // Mock data for started lessons with progress
  const [startedLessons, setStartedLessons] = useState<StartedLesson[]>([
    {
      id: "started-basic-first-aid",
      tutorialId: "basic-first-aid",
      title: "Basic Horse First Aid",
      description: "Learn essential first aid techniques for common horse injuries and emergencies",
      imageUrl: "https://images.unsplash.com/photo-1553284965-83fd3e82fa5a?w=400&h=200&fit=crop",
      lessonCount: 6,
      completedLessons: 3,
      duration: "45 min",
      difficulty: "Beginner",
      category: "first-aid",
      lastAccessedDate: "2025-09-10",
      progressPercentage: 50,
    },
    {
      id: "started-daily-grooming",
      tutorialId: "daily-grooming",
      title: "Daily Grooming Routine",
      description: "Master the essential daily grooming routine for your horse's health and happiness",
      imageUrl: "https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=400&h=200&fit=crop",
      lessonCount: 5,
      completedLessons: 2,
      duration: "35 min",
      difficulty: "Beginner",
      category: "grooming",
      lastAccessedDate: "2025-09-09",
      progressPercentage: 40,
    }
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
          lessonCount: 6,
          duration: "45 min",
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

  const onRefresh = async () => {
    setRefreshing(true);
    // Simulate loading new content and updating progress
    // In a real app, you would fetch updated progress from an API
    
    // Simulate some random progress updates for demonstration
    setStartedLessons(prevLessons => 
      prevLessons.map(lesson => {
        // Randomly advance some lessons by 1 (for demo purposes)
        if (Math.random() > 0.7 && lesson.completedLessons < lesson.lessonCount) {
          const newCompleted = Math.min(lesson.completedLessons + 1, lesson.lessonCount);
          return {
            ...lesson,
            completedLessons: newCompleted,
            progressPercentage: Math.round((newCompleted / lesson.lessonCount) * 100),
            lastAccessedDate: new Date().toISOString().split('T')[0]
          };
        }
        return lesson;
      }).filter(lesson => lesson.completedLessons < lesson.lessonCount)
    );
    
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  const updateLessonProgress = (tutorialId: string, completedLessons: number) => {
    setStartedLessons(prevLessons => 
      prevLessons.map(lesson => 
        lesson.tutorialId === tutorialId 
          ? {
              ...lesson,
              completedLessons,
              progressPercentage: Math.round((completedLessons / lesson.lessonCount) * 100),
              lastAccessedDate: new Date().toISOString().split('T')[0]
            }
          : lesson
      ).filter(lesson => lesson.completedLessons < lesson.lessonCount) // Remove completed lessons
    );
  };

  const addToStartedLessons = (tutorial: Tutorial) => {
    // Check if tutorial is already in started lessons
    const isAlreadyStarted = startedLessons.some(lesson => lesson.tutorialId === tutorial.id);
    
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
        lastAccessedDate: new Date().toISOString().split('T')[0],
        progressPercentage: 0,
      };
      
      setStartedLessons(prev => [...prev, newStartedLesson]);
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

    return (
      <TouchableOpacity
        key={tutorial.id}
        style={[
          styles.tutorialCard,
          { backgroundColor: theme.surface },
          isProOnlyAndNotMember && { opacity: 0.7 },
        ]}
        activeOpacity={0.8}
        disabled={tutorial.isLocked || isProOnlyAndNotMember}
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
            {isAccessible && (
              <TouchableOpacity
                style={[styles.startButton, { backgroundColor: theme.primary }]}
                onPress={() => handleStartTutorial(tutorial.id, tutorial.title)}
              >
                <Text style={styles.startButtonText}>Start</Text>
              </TouchableOpacity>
            )}
            {isProOnlyAndNotMember && (
              <TouchableOpacity
                style={[styles.upgradeButton, { borderColor: "#FF6B35" }]}
                onPress={() => router.push("/pro-features")}
              >
                <Text style={[styles.upgradeButtonText, { color: "#FF6B35" }]}>
                  Upgrade
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderStartedLessonCard = (lesson: StartedLesson) => {
    return (
      <TouchableOpacity
        key={lesson.id}
        style={[styles.tutorialCard, { backgroundColor: theme.surface }]}
        activeOpacity={0.8}
        onPress={() => handleStartTutorial(lesson.tutorialId, lesson.title)}
      >
        <View style={styles.tutorialImageContainer}>
          <Image
            source={{ uri: lesson.imageUrl }}
            style={styles.tutorialImage}
          />
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.7)"]}
            style={styles.imageGradient}
          >
            <View style={styles.tutorialBadges}>
              <View
                style={[
                  styles.difficultyBadge,
                  { backgroundColor: getDifficultyColor(lesson.difficulty) },
                ]}
              >
                <Text style={styles.badgeText}>{lesson.difficulty}</Text>
              </View>
              <View
                style={[
                  styles.durationBadge,
                  { backgroundColor: "rgba(255,255,255,0.9)" },
                ]}
              >
                <Text style={[styles.badgeText, { color: "#333" }]}>
                  {lesson.duration}
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
              {lesson.title}
            </Text>
            <View style={[styles.progressBadge, { backgroundColor: theme.primary }]}>
              <Text style={styles.progressBadgeText}>
                {Math.round(lesson.progressPercentage)}%
              </Text>
            </View>
          </View>
          <Text
            style={[styles.tutorialDescription, { color: theme.textSecondary }]}
            numberOfLines={2}
          >
            {lesson.description}
          </Text>
          
          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={[styles.progressBarBackground, { backgroundColor: theme.border }]}>
              <View
                style={[
                  styles.progressBarFill,
                  { 
                    backgroundColor: theme.primary,
                    width: `${lesson.progressPercentage}%`
                  }
                ]}
              />
            </View>
            <Text style={[styles.progressText, { color: theme.textSecondary }]}>
              {lesson.completedLessons} of {lesson.lessonCount} lessons completed
            </Text>
          </View>

          <View style={styles.tutorialFooter}>
            <Text style={[styles.lessonCount, { color: theme.textSecondary }]}>
              Last accessed: {new Date(lesson.lastAccessedDate).toLocaleDateString()}
            </Text>
            <TouchableOpacity
              style={[styles.continueButton, { backgroundColor: theme.primary }]}
              onPress={() => handleStartTutorial(lesson.tutorialId, lesson.title)}
            >
              <Text style={styles.startButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const selectedCategoryData = tutorialCategories.find(
    (cat) => cat.id === selectedCategory
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

            <View style={styles.featuredSection}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                {startedLessons.length > 0 ? "Continue Learning" : "Featured Tutorials"}
              </Text>
              <View style={styles.featuredTutorials}>
                {startedLessons.length > 0 ? (
                  startedLessons.map(renderStartedLessonCard)
                ) : (
                  tutorialCategories[0]?.tutorials[0] &&
                  renderTutorialCard(tutorialCategories[0].tutorials[0])
                )}
              </View>
            </View>

            <View style={styles.categoriesContainer}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Browse Categories
              </Text>
              {tutorialCategories.map(renderCategoryCard)}
            </View>
          </View>
        )}
      </ScrollView>

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
    paddingTop: 10,
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
});

export default CoachScreen;
