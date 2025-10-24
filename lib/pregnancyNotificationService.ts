import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

interface Pregnancy {
  id: string;
  horseId: string;
  horseName?: string;
  coverDate: string;
  status: 'active' | 'foaled' | 'lost';
  checks: Array<{ type: string; due?: string; done?: boolean }>;
  vaccines: Array<{ type: string; due: string; done?: boolean }>;
  deworming: Array<{ type: string; due: string; done?: boolean }>;
  photos: Array<{ date: string }>;
}

const NOTIFICATION_STORAGE_KEY = 'pregnancy_notification_ids';
const LAST_MONTH_KEY = 'pregnancy_last_month_notified';
const LAST_PHOTO_REMINDER_KEY = 'pregnancy_last_photo_reminder';

export class PregnancyNotificationService {
  
  /**
   * Check if pregnancy notifications are enabled in settings
   */
  private static async areNotificationsEnabled(): Promise<boolean> {
    try {
      const settings = await AsyncStorage.getItem('notificationSettings');
      if (settings) {
        const parsed = JSON.parse(settings);
        return parsed.pregnancyReminders !== false; // Default to true if not set
      }
      return true; // Default to enabled
    } catch (error) {
      console.error('Error checking notification settings:', error);
      return true; // Default to enabled on error
    }
  }

  /**
   * Calculate days pregnant from cover date
   */
  private static getDaysPregnant(coverDate: string): number {
    const cover = new Date(coverDate);
    const today = new Date();
    const diff = today.getTime() - cover.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  /**
   * Calculate pregnancy month (1-11)
   */
  private static getPregnancyMonth(days: number): number {
    return Math.min(Math.ceil(days / 30), 11);
  }

  /**
   * Get funny month change notification text
   */
  private static getMonthChangeNotification(month: number, horseName: string): string {
    const messages = [
      `🫐 Month 1: ${horseName}'s foal is the size of a grape! Time for that first ultrasound!`,
      `🍑 Month 2: ${horseName}'s baby is now peach-sized! Don't forget to check for twins!`,
      `🍋 Month 3: Lemon alert! 🍋 ${horseName}'s foal is growing fast - organs are forming!`,
      `🍆 Month 4: ${horseName}'s little eggplant is getting facial hair! How fancy! 💇`,
      `🥒 Month 5: Butternut squash time! ${horseName} needs that EHV-1 vaccine boost!`,
      `🍉 Month 6: Small watermelon! ${horseName} is officially showing now! 🤰`,
      `🍉 Month 7: Medium watermelon! ${horseName}'s baby has a tail now! Time for another vaccine!`,
      `🎃 Month 8: Pumpkin season! ${horseName}'s foal is getting a beautiful mane! 🎃`,
      `🎃 Month 9: Giant pumpkin mode! ${horseName} needs that final vaccine and no more fescue!`,
      `🍉 Month 10: HUGE watermelon! ${horseName} is almost there - prep that foaling area! 🏠`,
      `🎃 Month 11: MASSIVE pumpkin! ${horseName} could foal any day now! Watch for signs! 👀🎉`
    ];
    return messages[month - 1] || `Month ${month}: ${horseName} is doing great!`;
  }

  /**
   * Schedule notification for a specific date/time
   */
  private static async scheduleNotification(
    title: string,
    body: string,
    triggerDate: Date,
    data?: any
  ): Promise<string | null> {
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: data || {},
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: triggerDate,
        },
      });
      return id;
    } catch (error) {
      console.error('Error scheduling notification:', error);
      return null;
    }
  }

  /**
   * Save scheduled notification IDs for later cancellation
   */
  private static async saveNotificationId(pregnancyId: string, notificationId: string): Promise<void> {
    try {
      const existing = await AsyncStorage.getItem(NOTIFICATION_STORAGE_KEY);
      const ids = existing ? JSON.parse(existing) : {};
      
      if (!ids[pregnancyId]) {
        ids[pregnancyId] = [];
      }
      ids[pregnancyId].push(notificationId);
      
      await AsyncStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(ids));
    } catch (error) {
      console.error('Error saving notification ID:', error);
    }
  }

  /**
   * Schedule Next Action reminders (7 days before due)
   */
  static async scheduleNextActionReminders(pregnancy: Pregnancy): Promise<void> {
    if (pregnancy.status !== 'active') return;

    const today = new Date();
    const horseName = pregnancy.horseName || 'Your horse';

    // Get all upcoming actions
    const upcomingActions: Array<{ type: string; date: Date; text: string }> = [];

    // Check ultrasounds
    pregnancy.checks
      .filter(c => !c.done && c.due)
      .forEach(c => {
        const dueDate = new Date(c.due!);
        if (dueDate > today) {
          upcomingActions.push({
            type: 'ultrasound',
            date: dueDate,
            text: `Ultrasound: ${c.type}`
          });
        }
      });

    // Check vaccines
    pregnancy.vaccines
      .filter(v => !v.done)
      .forEach(v => {
        const dueDate = new Date(v.due);
        if (dueDate > today) {
          upcomingActions.push({
            type: 'vaccine',
            date: dueDate,
            text: `Vaccine: ${v.type}`
          });
        }
      });

    // Check deworming
    pregnancy.deworming
      .filter(d => !d.done)
      .forEach(d => {
        const dueDate = new Date(d.due);
        if (dueDate > today) {
          upcomingActions.push({
            type: 'deworming',
            date: dueDate,
            text: 'Deworming (pre-foaling)'
          });
        }
      });

    // Schedule notifications 7 days before each action
    for (const action of upcomingActions) {
      const reminderDate = new Date(action.date);
      reminderDate.setDate(reminderDate.getDate() - 7);
      reminderDate.setHours(9, 0, 0, 0); // 9 AM reminder

      if (reminderDate > today) {
        const id = await this.scheduleNotification(
          `🐴 ${horseName} - Pregnancy Reminder`,
          `${action.text} is due in 7 days! Don't forget to schedule it.`,
          reminderDate,
          { pregnancyId: pregnancy.id, type: 'next_action' }
        );
        if (id) await this.saveNotificationId(pregnancy.id, id);
      }
    }
  }

  /**
   * Check and schedule month change notification
   */
  static async checkMonthChange(pregnancy: Pregnancy): Promise<void> {
    if (pregnancy.status !== 'active') return;

    const days = this.getDaysPregnant(pregnancy.coverDate);
    const currentMonth = this.getPregnancyMonth(days);
    const horseName = pregnancy.horseName || 'Your horse';

    try {
      // Check last notified month
      const lastMonthKey = `${LAST_MONTH_KEY}_${pregnancy.id}`;
      const lastMonthStr = await AsyncStorage.getItem(lastMonthKey);
      const lastMonth = lastMonthStr ? parseInt(lastMonthStr) : 0;

      // If we've moved to a new month, send notification
      if (currentMonth > lastMonth && currentMonth <= 11) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '🎉 Pregnancy Milestone!',
            body: this.getMonthChangeNotification(currentMonth, horseName),
            data: { pregnancyId: pregnancy.id, type: 'month_change', month: currentMonth },
            sound: true,
            priority: Notifications.AndroidNotificationPriority.HIGH,
          },
          trigger: null, // Send immediately
        });

        // Save the new month
        await AsyncStorage.setItem(lastMonthKey, currentMonth.toString());
      }
    } catch (error) {
      console.error('Error checking month change:', error);
    }
  }

  /**
   * Schedule photo reminders (every 2 weeks)
   */
  static async schedulePhotoReminders(pregnancy: Pregnancy): Promise<void> {
    if (pregnancy.status !== 'active') return;

    const horseName = pregnancy.horseName || 'Your horse';
    const today = new Date();

    try {
      // Check last photo reminder
      const lastReminderKey = `${LAST_PHOTO_REMINDER_KEY}_${pregnancy.id}`;
      const lastReminderStr = await AsyncStorage.getItem(lastReminderKey);
      const lastReminder = lastReminderStr ? new Date(lastReminderStr) : null;

      // Calculate days since last reminder
      const daysSinceReminder = lastReminder 
        ? Math.floor((today.getTime() - lastReminder.getTime()) / (1000 * 60 * 60 * 24))
        : 14;

      // If it's been 14+ days or no reminder yet
      if (daysSinceReminder >= 14) {
        // Check if there's a recent photo (within last 14 days)
        const recentPhotos = pregnancy.photos.filter(p => {
          const photoDate = new Date(p.date);
          const daysSincePhoto = Math.floor((today.getTime() - photoDate.getTime()) / (1000 * 60 * 60 * 24));
          return daysSincePhoto <= 14;
        });

        // Only remind if no recent photo
        if (recentPhotos.length === 0) {
          const days = this.getDaysPregnant(pregnancy.coverDate);
          await Notifications.scheduleNotificationAsync({
            content: {
              title: `📷 ${horseName} - Photo Time!`,
              body: `It's been 2 weeks! Time to capture ${horseName}'s pregnancy progress. Day ${days} - don't miss this moment! 🤰✨`,
              data: { pregnancyId: pregnancy.id, type: 'photo_reminder' },
              sound: true,
              priority: Notifications.AndroidNotificationPriority.DEFAULT,
            },
            trigger: null, // Send immediately
          });

          await AsyncStorage.setItem(lastReminderKey, today.toISOString());
        }
      }

      // Schedule next photo reminder in 2 weeks
      const nextReminder = new Date(today);
      nextReminder.setDate(nextReminder.getDate() + 14);
      nextReminder.setHours(10, 0, 0, 0); // 10 AM

      const id = await this.scheduleNotification(
        `📷 ${horseName} - Photo Reminder`,
        `Time for a progress photo! Capture ${horseName}'s beautiful journey! 🐴💕`,
        nextReminder,
        { pregnancyId: pregnancy.id, type: 'photo_reminder' }
      );
      if (id) await this.saveNotificationId(pregnancy.id, id);
    } catch (error) {
      console.error('Error scheduling photo reminders:', error);
    }
  }

  /**
   * Schedule late-pregnancy extra care reminders (days 320-340)
   */
  static async scheduleLatePregnancyCare(pregnancy: Pregnancy): Promise<void> {
    if (pregnancy.status !== 'active') return;

    const days = this.getDaysPregnant(pregnancy.coverDate);
    const horseName = pregnancy.horseName || 'Your horse';
    const today = new Date();

    // Only schedule if in the critical window
    if (days >= 320 && days <= 340) {
      const careMessages = [
        `🏥 ${horseName} is in the home stretch! Check udder development daily.`,
        `🌙 Night watch recommended! ${horseName} could foal anytime now. Watch for waxing.`,
        `🚨 Foal alert zone! Keep ${horseName}'s stall ready and monitor milk calcium if possible.`,
        `👀 ${horseName} is so close! Check for restlessness, sweating, and other foaling signs.`,
        `🎯 Final countdown! Make sure ${horseName} has 24/7 monitoring. The big day is near!`,
      ];

      // Send one message every 4 days during this period
      const messageIndex = Math.min(Math.floor((days - 320) / 4), careMessages.length - 1);
      const message = careMessages[messageIndex];

      // Schedule for tomorrow morning at 8 AM
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(8, 0, 0, 0);

      const id = await this.scheduleNotification(
        '🚨 Critical Pregnancy Period',
        message,
        tomorrow,
        { pregnancyId: pregnancy.id, type: 'late_pregnancy_care', days }
      );
      if (id) await this.saveNotificationId(pregnancy.id, id);

      // Also schedule evening reminder
      const evening = new Date(today);
      evening.setDate(evening.getDate() + 1);
      evening.setHours(20, 0, 0, 0); // 8 PM

      const eveningId = await this.scheduleNotification(
        `🌙 ${horseName} Evening Check`,
        `Don't forget to check on ${horseName} before bed! Look for signs of labor. You've got this! 💪`,
        evening,
        { pregnancyId: pregnancy.id, type: 'evening_check', days }
      );
      if (eveningId) await this.saveNotificationId(pregnancy.id, eveningId);
    }
  }

  /**
   * Schedule all pregnancy notifications
   */
  static async scheduleAllNotifications(pregnancy: Pregnancy): Promise<void> {
    console.log('📅 Scheduling all pregnancy notifications for:', pregnancy.id);
    
    // Check if notifications are enabled
    const enabled = await this.areNotificationsEnabled();
    if (!enabled) {
      console.log('🔕 Pregnancy notifications are disabled in settings');
      return;
    }
    
    // Cancel existing notifications first
    await this.cancelPregnancyNotifications(pregnancy.id);

    // Schedule all notification types
    await this.scheduleNextActionReminders(pregnancy);
    await this.checkMonthChange(pregnancy);
    await this.schedulePhotoReminders(pregnancy);
    await this.scheduleLatePregnancyCare(pregnancy);

    console.log('✅ All pregnancy notifications scheduled');
  }

  /**
   * Cancel all notifications for a pregnancy
   */
  static async cancelPregnancyNotifications(pregnancyId: string): Promise<void> {
    try {
      const existing = await AsyncStorage.getItem(NOTIFICATION_STORAGE_KEY);
      if (!existing) return;

      const ids = JSON.parse(existing);
      const notificationIds = ids[pregnancyId] || [];

      // Cancel each notification
      for (const id of notificationIds) {
        await Notifications.cancelScheduledNotificationAsync(id);
      }

      // Remove from storage
      delete ids[pregnancyId];
      await AsyncStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(ids));

      console.log(`🔕 Cancelled ${notificationIds.length} notifications for pregnancy ${pregnancyId}`);
    } catch (error) {
      console.error('Error cancelling pregnancy notifications:', error);
    }
  }

  /**
   * Update notifications when pregnancy changes
   */
  static async updatePregnancyNotifications(pregnancy: Pregnancy): Promise<void> {
    if (pregnancy.status === 'active') {
      await this.scheduleAllNotifications(pregnancy);
    } else {
      // Cancel notifications if pregnancy is no longer active
      await this.cancelPregnancyNotifications(pregnancy.id);
    }
  }

  /**
   * Daily check for all active pregnancies (call this when app opens)
   */
  static async dailyPregnancyCheck(pregnancies: Pregnancy[]): Promise<void> {
    // Check if notifications are enabled
    const enabled = await this.areNotificationsEnabled();
    if (!enabled) {
      console.log('🔕 Pregnancy notifications are disabled in settings');
      return;
    }
    
    const activePregnancies = pregnancies.filter(p => p.status === 'active');
    
    for (const pregnancy of activePregnancies) {
      // Check for month changes
      await this.checkMonthChange(pregnancy);
      
      // Check if photo reminder needed
      await this.schedulePhotoReminders(pregnancy);
      
      // Check if in late pregnancy period
      await this.scheduleLatePregnancyCare(pregnancy);
    }
  }
}
