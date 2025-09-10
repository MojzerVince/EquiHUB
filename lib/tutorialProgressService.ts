import AsyncStorage from '@react-native-async-storage/async-storage';

// TypeScript interfaces for tutorial system
export interface LessonStep {
  id: string;
  type: 'video' | 'text' | 'quiz' | 'interactive' | 'checklist';
  title: string;
  content: string;
  videoUrl?: string;
  imageUrl?: string;
  quiz?: {
    question: string;
    options: string[];
    correctAnswer: number;
    explanation?: string;
  };
  checklist?: {
    items: string[];
  };
  duration?: number; // in seconds
}

export interface Lesson {
  id: string;
  tutorialId: string;
  title: string;
  description: string;
  steps: LessonStep[];
  estimatedDuration: number; // in minutes
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
}

export interface TutorialProgress {
  tutorialId: string;
  completedLessons: string[];
  currentLesson?: string;
  lessonProgress: { [lessonId: string]: LessonProgress };
  totalProgress: number; // 0-100
  lastAccessed: string;
  totalTimeSpent: number; // in seconds
}

export interface LessonProgress {
  lessonId: string;
  completedSteps: string[];
  currentStep: number;
  isCompleted: boolean;
  timeSpent: number; // in seconds
  quizScores: { [stepId: string]: number };
  startedAt?: string;
  completedAt?: string;
}

export class TutorialProgressService {
  private static readonly STORAGE_KEY = 'tutorial_progress';

  /**
   * Get all tutorial progress for a user
   */
  static async getAllProgress(userId: string): Promise<{ [tutorialId: string]: TutorialProgress }> {
    try {
      const storageKey = `${this.STORAGE_KEY}_${userId}`;
      const progressJson = await AsyncStorage.getItem(storageKey);
      
      if (!progressJson) {
        return {};
      }

      return JSON.parse(progressJson);
    } catch (error) {
      console.error('Error getting tutorial progress:', error);
      return {};
    }
  }

  /**
   * Get progress for a specific tutorial
   */
  static async getTutorialProgress(userId: string, tutorialId: string): Promise<TutorialProgress | null> {
    try {
      const allProgress = await this.getAllProgress(userId);
      return allProgress[tutorialId] || null;
    } catch (error) {
      console.error('Error getting tutorial progress:', error);
      return null;
    }
  }

  /**
   * Save progress for a tutorial
   */
  static async saveTutorialProgress(userId: string, progress: TutorialProgress): Promise<boolean> {
    try {
      const allProgress = await this.getAllProgress(userId);
      allProgress[progress.tutorialId] = progress;

      const storageKey = `${this.STORAGE_KEY}_${userId}`;
      await AsyncStorage.setItem(storageKey, JSON.stringify(allProgress));
      
      return true;
    } catch (error) {
      console.error('Error saving tutorial progress:', error);
      return false;
    }
  }

  /**
   * Start a new lesson
   */
  static async startLesson(userId: string, tutorialId: string, lessonId: string): Promise<boolean> {
    try {
      let progress = await this.getTutorialProgress(userId, tutorialId);
      
      if (!progress) {
        progress = {
          tutorialId,
          completedLessons: [],
          lessonProgress: {},
          totalProgress: 0,
          lastAccessed: new Date().toISOString(),
          totalTimeSpent: 0,
        };
      }

      progress.currentLesson = lessonId;
      progress.lastAccessed = new Date().toISOString();

      if (!progress.lessonProgress[lessonId]) {
        progress.lessonProgress[lessonId] = {
          lessonId,
          completedSteps: [],
          currentStep: 0,
          isCompleted: false,
          timeSpent: 0,
          quizScores: {},
          startedAt: new Date().toISOString(),
        };
      }

      return await this.saveTutorialProgress(userId, progress);
    } catch (error) {
      console.error('Error starting lesson:', error);
      return false;
    }
  }

  /**
   * Complete a lesson step
   */
  static async completeStep(
    userId: string, 
    tutorialId: string, 
    lessonId: string, 
    stepId: string,
    quizScore?: number
  ): Promise<boolean> {
    try {
      const progress = await this.getTutorialProgress(userId, tutorialId);
      if (!progress) return false;

      const lessonProgress = progress.lessonProgress[lessonId];
      if (!lessonProgress) return false;

      // Add step to completed if not already there
      if (!lessonProgress.completedSteps.includes(stepId)) {
        lessonProgress.completedSteps.push(stepId);
      }

      // Save quiz score if provided
      if (quizScore !== undefined) {
        lessonProgress.quizScores[stepId] = quizScore;
      }

      // Move to next step
      lessonProgress.currentStep = Math.min(
        lessonProgress.currentStep + 1,
        lessonProgress.completedSteps.length
      );

      progress.lastAccessed = new Date().toISOString();

      return await this.saveTutorialProgress(userId, progress);
    } catch (error) {
      console.error('Error completing step:', error);
      return false;
    }
  }

  /**
   * Complete a lesson
   */
  static async completeLesson(userId: string, tutorialId: string, lessonId: string, timeSpent: number): Promise<boolean> {
    try {
      const progress = await this.getTutorialProgress(userId, tutorialId);
      if (!progress) return false;

      const lessonProgress = progress.lessonProgress[lessonId];
      if (!lessonProgress) return false;

      // Mark lesson as completed
      lessonProgress.isCompleted = true;
      lessonProgress.completedAt = new Date().toISOString();
      lessonProgress.timeSpent += timeSpent;

      // Add to completed lessons if not already there
      if (!progress.completedLessons.includes(lessonId)) {
        progress.completedLessons.push(lessonId);
      }

      progress.totalTimeSpent += timeSpent;
      progress.lastAccessed = new Date().toISOString();

      // Calculate total progress (simple calculation based on completed lessons)
      // This would need to be adjusted based on actual tutorial structure
      progress.totalProgress = Math.min(100, (progress.completedLessons.length / 6) * 100); // Assuming 6 lessons per tutorial

      return await this.saveTutorialProgress(userId, progress);
    } catch (error) {
      console.error('Error completing lesson:', error);
      return false;
    }
  }

  /**
   * Get lesson progress
   */
  static async getLessonProgress(userId: string, tutorialId: string, lessonId: string): Promise<LessonProgress | null> {
    try {
      const progress = await this.getTutorialProgress(userId, tutorialId);
      return progress?.lessonProgress[lessonId] || null;
    } catch (error) {
      console.error('Error getting lesson progress:', error);
      return null;
    }
  }

  /**
   * Reset tutorial progress
   */
  static async resetTutorialProgress(userId: string, tutorialId: string): Promise<boolean> {
    try {
      const allProgress = await this.getAllProgress(userId);
      delete allProgress[tutorialId];

      const storageKey = `${this.STORAGE_KEY}_${userId}`;
      await AsyncStorage.setItem(storageKey, JSON.stringify(allProgress));
      
      return true;
    } catch (error) {
      console.error('Error resetting tutorial progress:', error);
      return false;
    }
  }

  /**
   * Get tutorial completion percentage
   */
  static async getTutorialCompletionPercentage(userId: string, tutorialId: string): Promise<number> {
    try {
      const progress = await this.getTutorialProgress(userId, tutorialId);
      return progress?.totalProgress || 0;
    } catch (error) {
      console.error('Error getting completion percentage:', error);
      return 0;
    }
  }
}
