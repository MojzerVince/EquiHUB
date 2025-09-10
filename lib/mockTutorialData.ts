import { Lesson } from './tutorialProgressService';

export class MockTutorialDataService {
  /**
   * Get lessons for a specific tutorial
   */
  static getLessonsForTutorial(tutorialId: string): Lesson[] {
    switch (tutorialId) {
      case 'basic-first-aid':
        return this.getBasicFirstAidLessons();
      case 'wound-care':
        return this.getWoundCareLessons();
      case 'daily-grooming':
        return this.getDailyGroomingLessons();
      case 'hoof-care':
        return this.getHoofCareLessons();
      case 'basic-seat':
        return this.getBasicSeatLessons();
      case 'ground-work':
        return this.getGroundWorkLessons();
      default:
        return this.getDefaultLessons(tutorialId);
    }
  }

  private static getBasicFirstAidLessons(): Lesson[] {
    return [
      {
        id: 'lesson-1',
        tutorialId: 'basic-first-aid',
        title: 'Introduction to Horse First Aid',
        description: 'Learn the fundamentals of horse emergency care',
        estimatedDuration: 8,
        difficulty: 'Beginner',
        steps: [
          {
            id: 'step-1',
            type: 'text',
            title: 'Welcome to Horse First Aid',
            content: 'In this lesson, you\'ll learn the essential skills needed to provide emergency care for horses. Understanding basic first aid can be the difference between life and death in critical situations.',
            imageUrl: 'https://images.unsplash.com/photo-1553284965-83fd3e82fa5a?w=400&h=300&fit=crop',
            duration: 60
          },
          {
            id: 'step-2',
            type: 'video',
            title: 'Assessing a Horse\'s Vital Signs',
            content: 'Learn how to check a horse\'s pulse, breathing rate, and temperature - the foundation of any emergency assessment.',
            videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
            duration: 180
          },
          {
            id: 'step-3',
            type: 'quiz',
            title: 'Vital Signs Knowledge Check',
            content: 'Test your understanding of normal horse vital signs.',
            quiz: {
              question: 'What is the normal resting heart rate for an adult horse?',
              options: ['20-30 beats per minute', '28-44 beats per minute', '60-80 beats per minute', '100-120 beats per minute'],
              correctAnswer: 1,
              explanation: 'A healthy adult horse\'s resting heart rate is typically 28-44 beats per minute. Foals and young horses have higher rates.'
            },
            duration: 90
          },
          {
            id: 'step-4',
            type: 'checklist',
            title: 'First Aid Kit Essentials',
            content: 'Every horse owner should have these items readily available:',
            checklist: {
              items: [
                'Digital thermometer',
                'Stethoscope',
                'Clean towels and gauze',
                'Antiseptic solution',
                'Bandaging materials',
                'Emergency contact numbers'
              ]
            },
            duration: 120
          },
          {
            id: 'step-5',
            type: 'interactive',
            title: 'Emergency Response Plan',
            content: 'Create your personal emergency action plan. Write down the steps you would take when discovering an injured horse.',
            imageUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=300&fit=crop',
            duration: 180
          }
        ]
      },
      {
        id: 'lesson-2',
        tutorialId: 'basic-first-aid',
        title: 'Common Horse Injuries',
        description: 'Identify and treat the most frequent horse injuries',
        estimatedDuration: 12,
        difficulty: 'Beginner',
        steps: [
          {
            id: 'step-1',
            type: 'text',
            title: 'Types of Common Injuries',
            content: 'Horses are susceptible to various injuries including cuts, bruises, sprains, and puncture wounds. Each requires different treatment approaches.',
            imageUrl: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=400&h=300&fit=crop',
            duration: 90
          },
          {
            id: 'step-2',
            type: 'video',
            title: 'Wound Assessment Techniques',
            content: 'Learn how to properly assess wound severity and determine when veterinary care is needed.',
            videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
            duration: 240
          },
          {
            id: 'step-3',
            type: 'quiz',
            title: 'Injury Assessment Quiz',
            content: 'Test your ability to assess different types of injuries.',
            quiz: {
              question: 'Which type of wound requires immediate veterinary attention?',
              options: ['Small surface cut', 'Deep puncture wound', 'Minor scrape', 'Small bruise'],
              correctAnswer: 1,
              explanation: 'Deep puncture wounds can cause internal damage and infection. They always require professional veterinary care.'
            },
            duration: 60
          }
        ]
      }
    ];
  }

  private static getWoundCareLessons(): Lesson[] {
    return [
      {
        id: 'lesson-1',
        tutorialId: 'wound-care',
        title: 'Wound Cleaning Basics',
        description: 'Master the fundamentals of proper wound cleaning',
        estimatedDuration: 10,
        difficulty: 'Intermediate',
        steps: [
          {
            id: 'step-1',
            type: 'text',
            title: 'Preparation for Wound Care',
            content: 'Before treating any wound, ensure you have the right supplies and the horse is safely restrained. Safety for both you and the horse is paramount.',
            imageUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=300&fit=crop',
            duration: 120
          },
          {
            id: 'step-2',
            type: 'video',
            title: 'Step-by-Step Wound Cleaning',
            content: 'Watch the proper technique for cleaning wounds to prevent infection and promote healing.',
            videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
            duration: 300
          }
        ]
      }
    ];
  }

  private static getDailyGroomingLessons(): Lesson[] {
    return [
      {
        id: 'lesson-1',
        tutorialId: 'daily-grooming',
        title: 'Grooming Tools and Techniques',
        description: 'Learn about essential grooming tools and their proper use',
        estimatedDuration: 15,
        difficulty: 'Beginner',
        steps: [
          {
            id: 'step-1',
            type: 'text',
            title: 'Essential Grooming Tools',
            content: 'A proper grooming kit includes curry combs, dandy brushes, body brushes, mane combs, and hoof picks. Each tool serves a specific purpose in maintaining your horse\'s health and appearance.',
            imageUrl: 'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=400&h=300&fit=crop',
            duration: 90
          },
          {
            id: 'step-2',
            type: 'video',
            title: 'Proper Brushing Technique',
            content: 'Learn the correct way to brush your horse for maximum effectiveness and comfort.',
            videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
            duration: 240
          },
          {
            id: 'step-3',
            type: 'checklist',
            title: 'Daily Grooming Routine',
            content: 'Follow this checklist for a complete daily grooming session:',
            checklist: {
              items: [
                'Pick out hooves',
                'Curry comb in circular motions',
                'Brush with dandy brush',
                'Fine brush for finishing',
                'Comb mane and tail',
                'Check for injuries or abnormalities'
              ]
            },
            duration: 180
          }
        ]
      }
    ];
  }

  private static getHoofCareLessons(): Lesson[] {
    return [
      {
        id: 'lesson-1',
        tutorialId: 'hoof-care',
        title: 'Understanding Hoof Anatomy',
        description: 'Learn about hoof structure and health indicators',
        estimatedDuration: 12,
        difficulty: 'Beginner',
        steps: [
          {
            id: 'step-1',
            type: 'text',
            title: 'Hoof Structure Basics',
            content: 'The horse\'s hoof is a complex structure consisting of the wall, sole, frog, and bars. Understanding these parts is crucial for proper hoof care.',
            imageUrl: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=300&fit=crop',
            duration: 120
          },
          {
            id: 'step-2',
            type: 'quiz',
            title: 'Hoof Anatomy Quiz',
            content: 'Test your knowledge of hoof parts and their functions.',
            quiz: {
              question: 'Which part of the hoof acts as a shock absorber?',
              options: ['Hoof wall', 'Sole', 'Frog', 'Coronet band'],
              correctAnswer: 2,
              explanation: 'The frog acts as a shock absorber and helps with circulation when the horse moves.'
            },
            duration: 90
          }
        ]
      }
    ];
  }

  private static getBasicSeatLessons(): Lesson[] {
    return [
      {
        id: 'lesson-1',
        tutorialId: 'basic-seat',
        title: 'Fundamentals of Riding Position',
        description: 'Develop a balanced and effective seat',
        estimatedDuration: 18,
        difficulty: 'Beginner',
        steps: [
          {
            id: 'step-1',
            type: 'text',
            title: 'The Independent Seat',
            content: 'An independent seat means you can maintain balance without relying on the reins or stirrups. This is the foundation of all good riding.',
            imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop',
            duration: 150
          },
          {
            id: 'step-2',
            type: 'video',
            title: 'Mounting and Position Check',
            content: 'Learn proper mounting technique and how to establish correct position in the saddle.',
            videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
            duration: 360
          },
          {
            id: 'step-3',
            type: 'interactive',
            title: 'Position Self-Assessment',
            content: 'Practice checking your position. Can you draw an imaginary line from your ear through your shoulder, hip, and heel?',
            imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop',
            duration: 240
          }
        ]
      }
    ];
  }

  private static getGroundWorkLessons(): Lesson[] {
    return [
      {
        id: 'lesson-1',
        tutorialId: 'ground-work',
        title: 'Building Trust and Respect',
        description: 'Establish a foundation of communication with your horse',
        estimatedDuration: 20,
        difficulty: 'Beginner',
        steps: [
          {
            id: 'step-1',
            type: 'text',
            title: 'The Importance of Ground Work',
            content: 'Ground work is the foundation of all horse training. It establishes respect, trust, and clear communication between horse and handler.',
            imageUrl: 'https://images.unsplash.com/photo-1568605117036-3c6b41d19432?w=400&h=300&fit=crop',
            duration: 120
          },
          {
            id: 'step-2',
            type: 'video',
            title: 'Basic Leading Exercises',
            content: 'Learn proper leading techniques that establish your role as a confident leader.',
            videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
            duration: 420
          }
        ]
      }
    ];
  }

  private static getDefaultLessons(tutorialId: string): Lesson[] {
    return [
      {
        id: 'lesson-1',
        tutorialId: tutorialId,
        title: 'Getting Started',
        description: 'Introduction to this tutorial',
        estimatedDuration: 5,
        difficulty: 'Beginner',
        steps: [
          {
            id: 'step-1',
            type: 'text',
            title: 'Welcome',
            content: 'Welcome to this tutorial! We\'ll guide you through everything you need to know.',
            duration: 60
          },
          {
            id: 'step-2',
            type: 'quiz',
            title: 'Quick Check',
            content: 'Let\'s make sure you\'re ready to begin.',
            quiz: {
              question: 'Are you ready to learn?',
              options: ['Yes, let\'s start!', 'I need more preparation', 'Maybe later', 'I\'m not sure'],
              correctAnswer: 0,
              explanation: 'Great! Let\'s begin your learning journey.'
            },
            duration: 30
          }
        ]
      }
    ];
  }

  /**
   * Get a specific lesson by ID
   */
  static getLesson(tutorialId: string, lessonId: string): Lesson | null {
    const lessons = this.getLessonsForTutorial(tutorialId);
    return lessons.find(lesson => lesson.id === lessonId) || null;
  }

  /**
   * Get total number of lessons for a tutorial
   */
  static getTotalLessonsCount(tutorialId: string): number {
    return this.getLessonsForTutorial(tutorialId).length;
  }

  /**
   * Get total estimated duration for a tutorial
   */
  static getTotalTutorialDuration(tutorialId: string): number {
    const lessons = this.getLessonsForTutorial(tutorialId);
    return lessons.reduce((total, lesson) => total + lesson.estimatedDuration, 0);
  }
}
