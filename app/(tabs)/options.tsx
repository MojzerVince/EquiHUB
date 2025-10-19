import { useAuth } from "@/contexts/AuthContext";
import { useDialog } from "@/contexts/DialogContext";
import { MetricSystem, useMetric } from "@/contexts/MetricContext";
import { ThemeName, useTheme } from "@/contexts/ThemeContext";
import { AuthAPI } from "@/lib/authAPI";
import {
  EmergencyFriend,
  EmergencyFriendsAPI,
} from "@/lib/emergencyFriendsAPI";
import { FeedbackAPI } from "@/lib/feedbackAPI";
import { HiddenPost, HiddenPostsManager } from "@/lib/hiddenPostsManager";
import { NotificationService } from "@/lib/notificationService";
import { UserSearchResult } from "@/lib/userAPI";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import appConfig from "../../app.json";

const OptionsScreen = () => {
  const router = useRouter();
  const { signOut, user } = useAuth();
  const { currentTheme, setTheme, availableThemes } = useTheme();
  const { metricSystem, setMetricSystem } = useMetric();
  const { showLogout, showConfirm, showError } = useDialog();

  // Settings state
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // Push notification settings state
  const [showNotificationSettings, setShowNotificationSettings] =
    useState(false);
  const [notificationSettings, setNotificationSettings] = useState({
    vaccinationReminders: true,
    trackingStatus: true,
    weeklySummary: true,
    monthlySummary: true,
  });

  // Load hidden posts when component mounts
  useEffect(() => {
    loadHiddenPosts();
    loadEmergencyContacts();
    loadUserFriends();
  }, [user?.id]);

  // Reload hidden posts when screen is focused
  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        loadHiddenPosts();
        loadEmergencyContacts();
      }
    }, [user?.id])
  );

  // Load emergency friends from storage
  const loadEmergencyContacts = useCallback(async () => {
    if (!user?.id) {
      setEmergencyFriends([]);
      return;
    }

    setLoadingEmergencyContacts(true);
    try {
      const friends = await EmergencyFriendsAPI.getEmergencyFriends(user.id);
      setEmergencyFriends(friends);
    } catch (error) {
      console.error("Error loading emergency friends:", error);
      setEmergencyFriends([]);
    } finally {
      setLoadingEmergencyContacts(false);
    }
  }, [user?.id]);

  // Load user's friends for emergency contact selection
  const loadUserFriends = useCallback(async () => {
    if (!user?.id) {
      setUserFriends([]);
      return;
    }

    setLoadingFriends(true);
    try {
      const { friends, error } = await EmergencyFriendsAPI.getUserFriends(
        user.id
      );
      if (error) {
        console.error("Error loading user friends:", error);
        Alert.alert("Error", "Failed to load friends: " + error);
        setUserFriends([]);
      } else {
        setUserFriends(friends);
      }
    } catch (error) {
      console.error("Error loading user friends:", error);
      setUserFriends([]);
      Alert.alert("Error", "Unable to load your friends. Please try again.");
    } finally {
      setLoadingFriends(false);
    }
  }, [user?.id]);

  // Add emergency friend
  const handleAddEmergencyFriend = async (friend: UserSearchResult) => {
    if (!user?.id) return;

    try {
      const result = await EmergencyFriendsAPI.addEmergencyFriend(
        user.id,
        friend
      );

      if (result.success) {
        await loadEmergencyContacts();
        setShowAddFriend(false);
        setSearchQuery("");
        Alert.alert(
          "✅ Success!",
          "Emergency friend added successfully. They will now be notified in case of emergencies."
        );
      } else {
        Alert.alert("Error", result.error || "Failed to add emergency friend.");
      }
    } catch (error) {
      console.error("Error adding emergency friend:", error);
      Alert.alert("Error", "Failed to add emergency friend. Please try again.");
    }
  };

  // Remove emergency friend
  const handleRemoveEmergencyFriend = async (friendId: string) => {
    if (!user?.id) return;

    Alert.alert(
      "Remove Emergency Friend",
      "Are you sure you want to remove this emergency friend?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              const success = await EmergencyFriendsAPI.removeEmergencyFriend(
                user.id,
                friendId
              );
              if (success) {
                await loadEmergencyContacts();
                Alert.alert(
                  "Success",
                  "Emergency friend removed successfully."
                );
              } else {
                Alert.alert(
                  "Error",
                  "Failed to remove emergency friend. Please try again."
                );
              }
            } catch (error) {
              console.error("Error removing emergency friend:", error);
              Alert.alert(
                "Error",
                "Failed to remove emergency friend. Please try again."
              );
            }
          },
        },
      ]
    );
  };

  // Toggle emergency friend enabled status
  const handleToggleEmergencyFriend = async (
    friendId: string,
    isEnabled: boolean
  ) => {
    if (!user?.id) return;

    try {
      const success = await EmergencyFriendsAPI.toggleEmergencyFriend(
        user.id,
        friendId,
        isEnabled
      );
      if (success) {
        await loadEmergencyContacts();
      } else {
        Alert.alert(
          "Error",
          "Failed to update emergency friend. Please try again."
        );
      }
    } catch (error) {
      console.error("Error toggling emergency friend:", error);
      Alert.alert(
        "Error",
        "Failed to update emergency friend. Please try again."
      );
    }
  };

  // Load hidden posts from storage
  const loadHiddenPosts = useCallback(async () => {
    if (!user?.id) {
      setHiddenPosts([]);
      return;
    }

    setLoadingHiddenPosts(true);
    try {
      const hidden = await HiddenPostsManager.getHiddenPosts(user.id);
      setHiddenPosts(hidden);
    } catch (error) {
      console.error("Error loading hidden posts:", error);
      setHiddenPosts([]);
    } finally {
      setLoadingHiddenPosts(false);
    }
  }, [user?.id]);

  // Unhide a specific post
  const handleUnhidePost = async (postId: string) => {
    if (!user?.id) return;

    try {
      const success = await HiddenPostsManager.unhidePost(user.id, postId);
      if (success) {
        setHiddenPosts((prev) => prev.filter((post) => post.id !== postId));
        Alert.alert("Success", "Post has been restored to your feed.");
      } else {
        Alert.alert("Error", "Failed to restore post. Please try again.");
      }
    } catch (error) {
      console.error("Error unhiding post:", error);
      Alert.alert("Error", "Failed to restore post. Please try again.");
    }
  };

  // Clear all hidden posts
  const handleClearAllHiddenPosts = async () => {
    if (!user?.id) return;

    Alert.alert(
      "Clear All Hidden Posts",
      "Are you sure you want to restore all hidden posts to your feed?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Restore All",
          style: "destructive",
          onPress: async () => {
            try {
              const success = await HiddenPostsManager.clearAllHiddenPosts(
                user.id
              );
              if (success) {
                setHiddenPosts([]);
                Alert.alert(
                  "Success",
                  "All hidden posts have been restored to your feed."
                );
              } else {
                Alert.alert(
                  "Error",
                  "Failed to restore posts. Please try again."
                );
              }
            } catch (error) {
              console.error("Error clearing hidden posts:", error);
              Alert.alert(
                "Error",
                "Failed to restore posts. Please try again."
              );
            }
          },
        },
      ]
    );
  };

  // Theme dropdown state
  const [themeDropdownVisible, setThemeDropdownVisible] = useState(false);

  // Metric system dropdown state
  const [metricDropdownVisible, setMetricDropdownVisible] = useState(false);

  // Hidden posts state
  const [hiddenPosts, setHiddenPosts] = useState<HiddenPost[]>([]);
  const [showHiddenPosts, setShowHiddenPosts] = useState(false);
  const [loadingHiddenPosts, setLoadingHiddenPosts] = useState(false);

  // Emergency friends state
  const [emergencyFriends, setEmergencyFriends] = useState<EmergencyFriend[]>(
    []
  );
  const [showEmergencyContacts, setShowEmergencyContacts] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [loadingEmergencyContacts, setLoadingEmergencyContacts] =
    useState(false);
  const [userFriends, setUserFriends] = useState<any[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Feedback state
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackSubject, setFeedbackSubject] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [consentToShareEmail, setConsentToShareEmail] = useState(false);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  // Terms of Service state
  const [showTermsOfService, setShowTermsOfService] = useState(false);

  // About state
  const [showAbout, setShowAbout] = useState(false);

  // Debug state (only available in development)
  const [isSimulatingFall, setIsSimulatingFall] = useState(false);
  const [isRetryingPushToken, setIsRetryingPushToken] = useState(false);

  // Load notification settings when component mounts
  useEffect(() => {
    loadNotificationSettings();
    setupNotificationResponseListener();
    // Check and reschedule notifications on app load
    checkAndRescheduleNotifications();
  }, []);

  // Check if we need to reschedule notifications (for maintenance)
  const checkAndRescheduleNotifications = async () => {
    try {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      const summaryNotifications = scheduled.filter(
        (notification) =>
          notification.content.data?.type === "weekly_summary" ||
          notification.content.data?.type === "monthly_summary"
      );

      // If we have fewer than 5 scheduled notifications, reschedule
      if (summaryNotifications.length < 5) {
        await schedulePeriodicNotifications();
      }
    } catch (error) {
      console.log("Error checking scheduled notifications:", error);
    }
  };

  // Setup notification response listener
  const setupNotificationResponseListener = () => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const { type } = response.notification.request.content.data || {};

        if (type === "weekly_summary" || type === "monthly_summary") {
          // Navigate to statistics page
          router.push("/statistics");
        }
      }
    );

    // Cleanup listener on unmount
    return () => subscription.remove();
  };

  // Load notification settings from storage
  const loadNotificationSettings = async () => {
    try {
      const saved = await AsyncStorage.getItem("notificationSettings");
      if (saved) {
        setNotificationSettings(JSON.parse(saved));
      }
    } catch (error) {
      console.error("Error loading notification settings:", error);
    }
  };

  // Save notification settings to storage
  const saveNotificationSettings = async (
    settings: typeof notificationSettings
  ) => {
    try {
      await AsyncStorage.setItem(
        "notificationSettings",
        JSON.stringify(settings)
      );
      setNotificationSettings(settings);
    } catch (error) {
      console.error("Error saving notification settings:", error);
    }
  };

  // Handle notification setting toggle
  const handleNotificationToggle = async (
    key: keyof typeof notificationSettings
  ) => {
    const newSettings = {
      ...notificationSettings,
      [key]: !notificationSettings[key],
    };
    await saveNotificationSettings(newSettings);

    // Update scheduled notifications for weekly/monthly summaries
    if (key === "weeklySummary" || key === "monthlySummary") {
      await schedulePeriodicNotifications();
    }
  };

  // Handle weekly summary notification tap
  const handleWeeklySummaryTap = () => {
    setShowNotificationSettings(false);
    router.push("/statistics");
  };

  // Handle monthly summary notification tap
  const handleMonthlySummaryTap = () => {
    setShowNotificationSettings(false);
    router.push("/statistics");
  };

  // Schedule periodic notifications
  const schedulePeriodicNotifications = async () => {
    try {
      // Cancel existing scheduled notifications
      await Notifications.cancelAllScheduledNotificationsAsync();

      // Get current settings
      const saved = await AsyncStorage.getItem("notificationSettings");
      const currentSettings = saved ? JSON.parse(saved) : notificationSettings;

      const now = new Date();

      // Schedule weekly notification if enabled (every 7 days from next Monday at 10 AM)
      if (currentSettings.weeklySummary) {
        // Calculate next Monday at 10 AM
        const nextMonday = new Date(now);
        const daysUntilMonday = (1 + 7 - now.getDay()) % 7 || 7; // 1 = Monday
        nextMonday.setDate(now.getDate() + daysUntilMonday);
        nextMonday.setHours(10, 0, 0, 0);

        // If the calculated time is in the past, add 7 days
        if (nextMonday <= now) {
          nextMonday.setDate(nextMonday.getDate() + 7);
        }

        // Schedule next few weekly notifications (since repeats don't work reliably cross-platform)
        for (let i = 0; i < 12; i++) {
          // Schedule for next 3 months
          const notificationDate = new Date(nextMonday);
          notificationDate.setDate(nextMonday.getDate() + i * 7);

          await Notifications.scheduleNotificationAsync({
            content: {
              title: "📊 Weekly Activity Summary",
              body: "Let's see your weekly activity!",
              data: { type: "weekly_summary" },
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: notificationDate,
            },
          });
        }
      }

      // Schedule monthly notification if enabled (1st of every month at 10 AM)
      if (currentSettings.monthlySummary) {
        // Schedule for next 12 months
        for (let i = 0; i < 12; i++) {
          const notificationDate = new Date(now);
          notificationDate.setMonth(now.getMonth() + i + 1, 1); // 1st day of next months
          notificationDate.setHours(10, 0, 0, 0);

          // If we're past the 1st of current month and i === 0, use current month
          if (i === 0) {
            const firstOfCurrentMonth = new Date(
              now.getFullYear(),
              now.getMonth(),
              1,
              10,
              0,
              0,
              0
            );
            if (now < firstOfCurrentMonth) {
              notificationDate.setMonth(now.getMonth(), 1);
            }
          }

          await Notifications.scheduleNotificationAsync({
            content: {
              title: "📈 Monthly Activity Summary",
              body: "Let's see your monthly activity!",
              data: { type: "monthly_summary" },
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: notificationDate,
            },
          });
        }
      }

      console.log("Notifications scheduled successfully");
    } catch (error) {
      console.error("Error scheduling notifications:", error);
      // Don't show error to user for non-critical feature
    }
  };

  const handleLogout = () => {
    showLogout(async () => {
      try {
        console.log("Starting logout process for user:", user?.email);
        await signOut();
        console.log("User logged out successfully");
        // ProtectedRoute will handle navigation automatically
      } catch (error) {
        console.error("Logout error:", error);
        showError("Failed to sign out. Please try again.");
      }
    });
  };

  const handleDeleteAccount = () => {
    if (isDeletingAccount) {
      return; // Prevent multiple deletion attempts
    }

    Alert.alert(
      "Delete Account",
      "⚠️ This action cannot be undone!\n\nDeleting your account will permanently remove:\n• Your profile and settings\n• All your horses and training data\n• Community posts and interactions\n• Photos and media uploads\n• Friend connections\n\nAre you absolutely sure you want to continue?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete Forever",
          style: "destructive",
          onPress: () => {
            // Second confirmation
            Alert.alert(
              "Final Confirmation",
              "This is your last chance to cancel.\n\nOnce deleted, your account cannot be recovered.",
              [
                {
                  text: "Cancel",
                  style: "cancel",
                },
                {
                  text: "DELETE ACCOUNT",
                  style: "destructive",
                  onPress: async () => {
                    setIsDeletingAccount(true);

                    try {
                      console.log("Starting account deletion process...");

                      const { success, error } = await AuthAPI.deleteAccount();

                      if (success) {
                        Alert.alert(
                          "Account Deleted",
                          "Your account has been permanently deleted. Thank you for using EquiHUB.",
                          [
                            {
                              text: "OK",
                              onPress: () => {
                                // The AuthContext will handle navigation automatically when user state clears
                                console.log(
                                  "Account deletion completed successfully"
                                );
                              },
                            },
                          ],
                          { cancelable: false }
                        );
                      } else {
                        showError(
                          error ||
                            "Failed to delete account. Please try again or contact support."
                        );
                      }
                    } catch (error) {
                      console.error("Account deletion error:", error);
                      showError(
                        "An unexpected error occurred. Please try again or contact support."
                      );
                    } finally {
                      setIsDeletingAccount(false);
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const handlePrivacyPolicy = async () => {
    const url = "https://equihubapp.com/privacy";
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        showError("Unable to open the privacy policy page.");
      }
    } catch (error) {
      console.error("Error opening privacy policy:", error);
      showError("Failed to open the privacy policy page.");
    }
  };

  const handleRequestAllPermissions = async () => {
    try {
      let permissionsGranted = 0;
      let totalPermissions = 4; // Camera, Media Library, Location, Notifications
      let permissionResults = [];

      // Request Camera permission
      try {
        const cameraResult = await ImagePicker.requestCameraPermissionsAsync();
        if (cameraResult.granted) {
          permissionsGranted++;
          permissionResults.push("✅ Camera access granted");
        } else {
          permissionResults.push("❌ Camera access denied");
        }
      } catch (error) {
        permissionResults.push("❌ Camera permission failed");
      }

      // Request Media Library permission
      try {
        const mediaResult =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (mediaResult.granted) {
          permissionsGranted++;
          permissionResults.push("✅ Photo library access granted");
        } else {
          permissionResults.push("❌ Photo library access denied");
        }
      } catch (error) {
        permissionResults.push("❌ Photo library permission failed");
      }

      // Request Location permission
      try {
        const locationResult =
          await Location.requestForegroundPermissionsAsync();
        if (locationResult.granted) {
          permissionsGranted++;
          permissionResults.push("✅ Location access granted");
        } else {
          permissionResults.push("❌ Location access denied");
        }
      } catch (error) {
        permissionResults.push("❌ Location permission failed");
      }

      // Note: Contacts permission removed - now using friends system instead

      // Request Notification permission
      try {
        const notificationResult = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
          },
        });
        if (notificationResult.granted) {
          permissionsGranted++;
          permissionResults.push("✅ Notification access granted");
          // Schedule notifications if settings allow (don't await to avoid blocking)
          schedulePeriodicNotifications().catch((error) => {
            console.log("Notification scheduling failed silently:", error);
          });
        } else {
          permissionResults.push("❌ Notification access denied");
        }
      } catch (error) {
        permissionResults.push("❌ Notification permission failed");
      }

      // Show results
      const resultMessage = permissionResults.join("\n\n");
      const title =
        permissionsGranted === totalPermissions
          ? "All Permissions Granted!"
          : `${permissionsGranted}/${totalPermissions} Permissions Granted`;

      showConfirm(
        title,
        resultMessage +
          "\n\nNote: Some permissions may require you to go to your device settings if they were previously denied.",
        () => {}
      );
    } catch (error) {
      console.error("Error requesting permissions:", error);
      showError("Failed to request permissions. Please try again.");
    }
  };

  // Handle feedback submission
  const handleSubmitFeedback = async () => {
    if (!user?.id) return;

    // Validate input
    if (!feedbackSubject.trim()) {
      showError("Please enter a subject for your feedback.");
      return;
    }

    if (!feedbackMessage.trim()) {
      showError("Please enter a message for your feedback.");
      return;
    }

    setIsSubmittingFeedback(true);

    try {
      const result = await FeedbackAPI.submitFeedback(user.id, {
        subject: feedbackSubject,
        message: feedbackMessage,
        consentToShareEmail: consentToShareEmail,
      });

      if (result.success) {
        // Clear form
        setFeedbackSubject("");
        setFeedbackMessage("");
        setConsentToShareEmail(false);
        setShowFeedback(false);

        // Show success message
        showConfirm(
          "✅ Thanks for your feedback!",
          "Your feedback has been successfully submitted. We appreciate your input and will review it carefully to help improve EquiHUB.",
          () => {}
        );
      } else {
        showError(
          result.error || "Failed to submit feedback. Please try again."
        );
      }
    } catch (error) {
      console.error("Error submitting feedback:", error);
      showError("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  // DEBUG ONLY: Simulate fall detection for testing
  const handleSimulateFallDetection = async () => {
    if (!__DEV__) return;
    
    if (!user?.id) {
      Alert.alert("Error", "User not logged in");
      return;
    }

    setIsSimulatingFall(true);

    try {
      // Get current location for testing (optional)
      let testLocation = undefined;
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === "granted") {
          const location = await Location.getCurrentPositionAsync({});
          testLocation = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };
        }
      } catch (locationError) {
        console.log("Could not get location for test, using default");
      }

      const result = await EmergencyFriendsAPI.simulateFallDetection(
        user.id,
        user.email?.split("@")[0] || "Test User",
        testLocation
      );

      // Show detailed debug information
      const debugMessage = `
🧪 DEBUG FALL SIMULATION RESULTS:

✓ Emergency Friends Found: ${result.debugInfo.emergencyFriendsFound}
✓ Enabled Friends: ${result.debugInfo.enabledFriends}
✓ Test Location: ${result.debugInfo.testLocation.latitude.toFixed(
        4
      )}, ${result.debugInfo.testLocation.longitude.toFixed(4)}
✓ Notification Sent: ${result.success ? "YES" : "NO"}
✓ Friends Notified: ${result.notifiedCount}

${
  result.error ? `❌ Error: ${result.error}` : "✅ Test completed successfully!"
}

${
  result.success
    ? "Check your notifications to see the fall detection alert!"
    : "Add some emergency friends first to test notifications."
}
      `.trim();

      Alert.alert("🧪 Fall Detection Test", debugMessage, [
        { text: "OK", style: "default" },
      ]);

      console.log("🧪 DEBUG: Fall simulation completed:", result);
    } catch (error) {
      console.error("🧪 DEBUG: Fall simulation error:", error);
      Alert.alert(
        "Debug Error",
        `Fall simulation failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsSimulatingFall(false);
    }
  };

  // Retry push token registration
  const handleRetryPushToken = async () => {
    if (!__DEV__) return;
    
    if (!user?.id) {
      Alert.alert("Error", "User not logged in");
      return;
    }

    setIsRetryingPushToken(true);

    try {
      console.log("🔄 DEBUG: Retrying push token registration...");

      // Get push token
      const token =
        await NotificationService.registerForPushNotificationsAsync();

      if (token) {
        // Store token in Supabase
        await NotificationService.savePushToken(user.id, token);

        const debugMessage = `
🔄 PUSH TOKEN RETRY RESULTS:

✓ Token Generated: ${token ? "YES" : "NO"}
✓ Token Length: ${token ? token.length : 0}
✓ Token Prefix: ${token ? token.substring(0, 20) + "..." : "NO_TOKEN"}
✓ Database Storage: SUCCESS
✓ User ID: ${user.id}

✅ Token registration completed successfully!

${
  token
    ? "Your device should now receive push notifications!"
    : "Token registration failed - check device settings."
}
        `.trim();

        Alert.alert("🔄 Push Token Retry", debugMessage, [
          { text: "OK", style: "default" },
        ]);

        console.log("🔄 DEBUG: Push token retry completed:", {
          token: token?.substring(0, 20) + "...",
        });
      } else {
        Alert.alert(
          "Push Token Failed",
          "Could not get push token. Please check:\n• App permissions\n• Device settings\n• Network connection"
        );
        console.log("🔄 DEBUG: No push token received");
      }
    } catch (error) {
      console.error("🔄 DEBUG: Push token retry error:", error);
      Alert.alert(
        "Retry Error",
        `Push token retry failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsRetryingPushToken(false);
    }
  };

  // DEBUG ONLY: Test emergency notification screen
  const handleTestEmergencyScreen = () => {
    if (!__DEV__) return;
    
    if (!user?.id) {
      Alert.alert("Error", "User not logged in");
      return;
    }

    console.log("🧪 DEBUG: Testing emergency notification screen...");

    // Navigate to emergency notification screen with test data
    router.push({
      pathname: "/emergency-notification" as any,
      params: {
        data: JSON.stringify({
          riderId: user.id,
          riderName: user.email?.split("@")[0] || "Test User",
          latitude: 47.6062, // Seattle coordinates for testing
          longitude: -122.3321,
          timestamp: Date.now(),
          message:
            "This is a test emergency notification. The rider may have fallen while riding.",
        }),
      },
    });
  };

  const SettingItem = ({
    title,
    subtitle,
    value,
    onValueChange,
    type = "switch",
    dropdownValue,
    dropdownOptions,
    onDropdownSelect,
    dropdownVisible,
    setDropdownVisible,
  }: {
    title: string;
    subtitle?: string;
    value?: boolean;
    onValueChange?: (value: boolean) => void;
    type?: "switch" | "button" | "dropdown";
    dropdownValue?: string;
    dropdownOptions?: string[];
    onDropdownSelect?: (value: string) => void;
    dropdownVisible?: boolean;
    setDropdownVisible?: (visible: boolean) => void;
  }) => (
    <View
      style={[
        styles.settingItem,
        { borderBottomColor: currentTheme.colors.accent },
      ]}
    >
      <View style={styles.settingInfo}>
        <Text
          style={[styles.settingTitle, { color: currentTheme.colors.text }]}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[
              styles.settingSubtitle,
              { color: currentTheme.colors.textSecondary },
            ]}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {type === "switch" ? (
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{
            false: currentTheme.colors.accent,
            true: currentTheme.colors.primary,
          }}
          thumbColor={value ? "#fff" : "#f4f3f4"}
        />
      ) : null}
      {type === "dropdown" ? (
        <TouchableOpacity
          style={[
            styles.dropdownButton,
            { borderColor: currentTheme.colors.border },
          ]}
          onPress={() =>
            setDropdownVisible && setDropdownVisible(!dropdownVisible)
          }
        >
          <Text
            style={[
              styles.dropdownButtonText,
              { color: currentTheme.colors.text },
            ]}
          >
            {dropdownValue}
          </Text>
          <Text
            style={[styles.dropdownArrow, { color: currentTheme.colors.text }]}
          >
            {dropdownVisible ? "▲" : "▼"}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  const ActionButton = ({
    title,
    onPress,
    style,
    textStyle,
    disabled = false,
    showLoading = false,
  }: {
    title: string;
    onPress: () => void;
    style?: any;
    textStyle?: any;
    disabled?: boolean;
    showLoading?: boolean;
  }) => (
    <TouchableOpacity
      style={[
        styles.actionButton,
        { borderBottomColor: currentTheme.colors.accent },
        style,
        disabled && styles.disabledButton,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <View style={styles.actionButtonContent}>
        {showLoading && (
          <ActivityIndicator
            size="small"
            color="#fff"
            style={styles.actionButtonLoader}
          />
        )}
        <Text
          style={[
            styles.actionButtonText,
            { color: currentTheme.colors.text },
            textStyle,
          ]}
        >
          {title}
        </Text>
      </View>
    </TouchableOpacity>
  );

  // Theme Dropdown Modal
  const ThemeDropdownModal = () => (
    <Modal
      transparent={true}
      visible={themeDropdownVisible}
      animationType="fade"
      onRequestClose={() => setThemeDropdownVisible(false)}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        onPress={() => setThemeDropdownVisible(false)}
      >
        <View
          style={[
            styles.dropdownModal,
            { backgroundColor: currentTheme.colors.card },
          ]}
        >
          <Text style={[styles.dropdownModalTitle, { color: "#fff" }]}>
            Select Theme
          </Text>
          <ScrollView style={styles.dropdownModalContent}>
            {availableThemes.map((theme, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.dropdownOption,
                  {
                    borderBottomColor: "rgba(255, 255, 255, 0.1)",
                    backgroundColor:
                      currentTheme.name === theme
                        ? "rgba(255, 255, 255, 0.1)"
                        : "transparent",
                  },
                ]}
                onPress={() => {
                  setTheme(theme as ThemeName);
                  setThemeDropdownVisible(false);
                }}
              >
                <Text
                  style={[
                    styles.dropdownOptionText,
                    {
                      color: "#fff",
                      fontWeight:
                        currentTheme.name === theme ? "bold" : "normal",
                    },
                  ]}
                >
                  {theme}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  // Metric System Dropdown Modal
  const MetricDropdownModal = () => {
    const metricOptions = ["Metric", "Imperial"];
    const currentMetricDisplay =
      metricSystem === "metric" ? "Metric" : "Imperial";

    return (
      <Modal
        transparent={true}
        visible={metricDropdownVisible}
        animationType="fade"
        onRequestClose={() => setMetricDropdownVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={() => setMetricDropdownVisible(false)}
        >
          <View
            style={[
              styles.dropdownModal,
              { backgroundColor: currentTheme.colors.card },
            ]}
          >
            <Text style={[styles.dropdownModalTitle, { color: "#fff" }]}>
              Select Measurement System
            </Text>
            <ScrollView style={styles.dropdownModalContent}>
              {metricOptions.map((option, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.dropdownOption,
                    {
                      borderBottomColor: "rgba(255, 255, 255, 0.1)",
                      backgroundColor:
                        currentMetricDisplay === option
                          ? "rgba(255, 255, 255, 0.1)"
                          : "transparent",
                    },
                  ]}
                  onPress={() => {
                    setMetricSystem(option.toLowerCase() as MetricSystem);
                    setMetricDropdownVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.dropdownOptionText,
                      {
                        color: "#fff",
                        fontWeight:
                          currentMetricDisplay === option ? "bold" : "normal",
                      },
                    ]}
                  >
                    {option}
                    {option === "Metric" && (
                      <Text
                        style={[
                          styles.dropdownOptionDescription,
                          { color: "rgba(255, 255, 255, 0.7)" },
                        ]}
                      >
                        {"\n"}km, m/s, °C, kg
                      </Text>
                    )}
                    {option === "Imperial" && (
                      <Text
                        style={[
                          styles.dropdownOptionDescription,
                          { color: "rgba(255, 255, 255, 0.7)" },
                        ]}
                      >
                        {"\n"}mi, mph, °F, lbs
                      </Text>
                    )}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

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
            onPress={() => router.push("/(tabs)/profile")}
            activeOpacity={0.7}
          >
            <Image
              source={require("../../assets/in_app_icons/back.png")}
              style={styles.backIcon}
            />
          </TouchableOpacity>
          <Text style={styles.header}>Options</Text>
        </View>
      </SafeAreaView>

      <ScrollView
        style={[
          styles.viewPort,
          { backgroundColor: currentTheme.colors.background },
        ]}
      >
        <View style={styles.optionsContainer}>
          {/* Account Settings Section */}
          <View style={styles.section}>
            <Text
              style={[styles.sectionTitle, { color: currentTheme.colors.text }]}
            >
              Account
            </Text>
            <View
              style={[
                styles.sectionContent,
                { backgroundColor: currentTheme.colors.surface },
              ]}
            >
              <ActionButton
                title={`Emergency Friends (${emergencyFriends.length}/3)`}
                onPress={() => setShowEmergencyContacts(true)}
              />
            </View>
          </View>

          {/* Debug Section - Token debugging temporarily available to all users */}
          {__DEV__ && (
            <View style={styles.section}>
              <Text
                style={[styles.sectionTitle, { color: currentTheme.colors.text }]}
              >
                🧪 Debug Tools (Token Testing)
              </Text>
              <View
                style={[
                  styles.sectionContent,
                  { backgroundColor: currentTheme.colors.surface },
                ]}
              >
                <ActionButton
                  title={
                    isSimulatingFall
                      ? "Simulating Fall..."
                      : "🚨 Test Fall Detection"
                  }
                  onPress={handleSimulateFallDetection}
                  disabled={isSimulatingFall}
                  showLoading={isSimulatingFall}
                  style={[
                    {
                      backgroundColor: isSimulatingFall
                        ? currentTheme.colors.textSecondary
                        : currentTheme.colors.warning,
                    },
                  ]}
                  textStyle={{ color: "#fff", fontWeight: "bold" }}
                />
                <ActionButton
                  title={
                    isRetryingPushToken
                      ? "Retrying Push Token..."
                      : "🔄 Retry Push Token Registration"
                  }
                  onPress={handleRetryPushToken}
                  disabled={isRetryingPushToken}
                  showLoading={isRetryingPushToken}
                  style={[
                    {
                      backgroundColor: isRetryingPushToken
                        ? currentTheme.colors.textSecondary
                        : currentTheme.colors.primary,
                    },
                  ]}
                  textStyle={{ color: "#fff", fontWeight: "bold" }}
                />
                <ActionButton
                  title="📱 Test Emergency Screen"
                  onPress={handleTestEmergencyScreen}
                  style={[
                    {
                      backgroundColor: "#dc3545", // Red color for emergency
                    },
                  ]}
                  textStyle={{ color: "#fff", fontWeight: "bold" }}
                />
              </View>
            </View>
          )}

          {/* Privacy Settings Section */}
          <View style={styles.section}>
            <Text
              style={[styles.sectionTitle, { color: currentTheme.colors.text }]}
            >
              Privacy
            </Text>
            <View
              style={[
                styles.sectionContent,
                { backgroundColor: currentTheme.colors.surface },
              ]}
            >
              <ActionButton
                title="Push Notifications"
                onPress={() => setShowNotificationSettings(true)}
              />
            </View>
          </View>

          {/* Hidden Posts Section */}
          <View style={styles.section}>
            <Text
              style={[styles.sectionTitle, { color: currentTheme.colors.text }]}
            >
              Hidden Content
            </Text>
            <View
              style={[
                styles.sectionContent,
                { backgroundColor: currentTheme.colors.surface },
              ]}
            >
              <ActionButton
                title={`Hidden Posts (${hiddenPosts.length})`}
                onPress={() => setShowHiddenPosts(true)}
              />
              {hiddenPosts.length > 0 && (
                <ActionButton
                  title="Clear All Hidden Posts"
                  onPress={handleClearAllHiddenPosts}
                  textStyle={{ color: currentTheme.colors.warning }}
                />
              )}
            </View>
          </View>

          {/* App Settings Section */}
          <View style={styles.section}>
            <Text
              style={[styles.sectionTitle, { color: currentTheme.colors.text }]}
            >
              App Settings
            </Text>
            <View
              style={[
                styles.sectionContent,
                { backgroundColor: currentTheme.colors.surface },
              ]}
            >
              <SettingItem
                title="Theme"
                subtitle="Choose your preferred color theme"
                type="dropdown"
                dropdownValue={currentTheme.name}
                dropdownOptions={availableThemes}
                onDropdownSelect={(theme) => setTheme(theme as ThemeName)}
                dropdownVisible={themeDropdownVisible}
                setDropdownVisible={setThemeDropdownVisible}
              />
              <SettingItem
                title="Measurement System"
                subtitle="Choose between metric and imperial units"
                type="dropdown"
                dropdownValue={
                  metricSystem === "metric" ? "Metric" : "Imperial"
                }
                dropdownOptions={["Metric", "Imperial"]}
                onDropdownSelect={(system) =>
                  setMetricSystem(system.toLowerCase() as MetricSystem)
                }
                dropdownVisible={metricDropdownVisible}
                setDropdownVisible={setMetricDropdownVisible}
              />
              <ActionButton
                title="Request All Permissions"
                onPress={handleRequestAllPermissions}
              />
            </View>
          </View>

          {/* General Actions Section */}
          <View style={styles.section}>
            <Text
              style={[styles.sectionTitle, { color: currentTheme.colors.text }]}
            >
              General
            </Text>
            <View
              style={[
                styles.sectionContent,
                { backgroundColor: currentTheme.colors.surface },
              ]}
            >
              <ActionButton title="About" onPress={() => setShowAbout(true)} />
              <ActionButton
                title="Help & Support"
                onPress={() => console.log("Help pressed")}
              />
              <ActionButton
                title="Terms of Service"
                onPress={() => setShowTermsOfService(true)}
              />
              <ActionButton
                title="Privacy Policy"
                onPress={handlePrivacyPolicy}
              />
              <ActionButton
                title="Feedback"
                onPress={() => setShowFeedback(true)}
              />
            </View>
          </View>

          {/* Account Actions Section */}
          <View style={styles.section}>
            <Text
              style={[styles.sectionTitle, { color: currentTheme.colors.text }]}
            >
              Account Actions
            </Text>
            <View
              style={[
                styles.sectionContent,
                { backgroundColor: currentTheme.colors.surface },
              ]}
            >
              <ActionButton
                title="Logout"
                onPress={handleLogout}
                style={[
                  styles.logoutButton,
                  { backgroundColor: currentTheme.colors.warning },
                ]}
                textStyle={styles.logoutButtonText}
              />
              <ActionButton
                title={
                  isDeletingAccount ? "Deleting Account..." : "Delete Account"
                }
                onPress={handleDeleteAccount}
                disabled={isDeletingAccount}
                showLoading={isDeletingAccount}
                style={[
                  styles.deleteButton,
                  {
                    backgroundColor: isDeletingAccount
                      ? currentTheme.colors.textSecondary
                      : currentTheme.colors.error,
                  },
                ]}
                textStyle={styles.deleteButtonText}
              />
            </View>
          </View>

          {/* Version Information */}
          <View style={styles.versionContainer}>
            <Text
              style={[
                styles.versionText,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              Version {appConfig.expo.version}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Theme Dropdown Modal */}
      <ThemeDropdownModal />

      {/* Metric System Dropdown Modal */}
      <MetricDropdownModal />

      {/* Push Notifications Settings Modal */}
      <Modal
        visible={showNotificationSettings}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowNotificationSettings(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.notificationSettingsModal,
              { backgroundColor: currentTheme.colors.background },
            ]}
          >
            <View
              style={[
                styles.notificationSettingsHeader,
                { borderBottomColor: currentTheme.colors.accent },
              ]}
            >
              <Text
                style={[
                  styles.notificationSettingsTitle,
                  { color: currentTheme.colors.text },
                ]}
              >
                Push Notification Settings
              </Text>
              <TouchableOpacity
                style={styles.notificationSettingsCloseButton}
                onPress={() => setShowNotificationSettings(false)}
              >
                <Text
                  style={[
                    styles.notificationSettingsCloseText,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  ✕
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.notificationSettingsContent}>
              <Text
                style={[
                  styles.notificationSettingsDescription,
                  { color: currentTheme.colors.textSecondary },
                ]}
              >
                Choose which notifications you'd like to receive
              </Text>

              {/* Vaccination Reminders */}
              <View
                style={[
                  styles.notificationSettingItem,
                  { backgroundColor: currentTheme.colors.surface },
                ]}
              >
                <View style={styles.notificationSettingInfo}>
                  <Text
                    style={[
                      styles.notificationSettingTitle,
                      { color: currentTheme.colors.text },
                    ]}
                  >
                    💉 Vaccination Reminders
                  </Text>
                  <Text
                    style={[
                      styles.notificationSettingSubtitle,
                      { color: currentTheme.colors.textSecondary },
                    ]}
                  >
                    Get notified when your horse's vaccinations are due
                  </Text>
                </View>
                <Switch
                  value={notificationSettings.vaccinationReminders}
                  onValueChange={() =>
                    handleNotificationToggle("vaccinationReminders")
                  }
                  trackColor={{
                    false: currentTheme.colors.accent,
                    true: currentTheme.colors.primary,
                  }}
                  thumbColor={
                    notificationSettings.vaccinationReminders
                      ? "#fff"
                      : "#f4f3f4"
                  }
                />
              </View>

              {/* Tracking Status Notifications */}
              <View
                style={[
                  styles.notificationSettingItem,
                  { backgroundColor: currentTheme.colors.surface },
                ]}
              >
                <View style={styles.notificationSettingInfo}>
                  <Text
                    style={[
                      styles.notificationSettingTitle,
                      { color: currentTheme.colors.text },
                    ]}
                  >
                    📍 Tracking Status
                  </Text>
                  <Text
                    style={[
                      styles.notificationSettingSubtitle,
                      { color: currentTheme.colors.textSecondary },
                    ]}
                  >
                    Receive updates about your tracking sessions
                  </Text>
                </View>
                <Switch
                  value={notificationSettings.trackingStatus}
                  onValueChange={() =>
                    handleNotificationToggle("trackingStatus")
                  }
                  trackColor={{
                    false: currentTheme.colors.accent,
                    true: currentTheme.colors.primary,
                  }}
                  thumbColor={
                    notificationSettings.trackingStatus ? "#fff" : "#f4f3f4"
                  }
                />
              </View>

              {/* Weekly Summary */}
              <View
                style={[
                  styles.notificationSettingItem,
                  { backgroundColor: currentTheme.colors.surface },
                ]}
              >
                <TouchableOpacity
                  style={styles.notificationSettingInfo}
                  onPress={handleWeeklySummaryTap}
                >
                  <Text
                    style={[
                      styles.notificationSettingTitle,
                      { color: currentTheme.colors.text },
                    ]}
                  >
                    📊 Weekly Summary
                  </Text>
                  <Text
                    style={[
                      styles.notificationSettingSubtitle,
                      { color: currentTheme.colors.textSecondary },
                    ]}
                  >
                    "Let's see your weekly activity!" - Tap to view weekly
                    statistics
                  </Text>
                </TouchableOpacity>
                <Switch
                  value={notificationSettings.weeklySummary}
                  onValueChange={() =>
                    handleNotificationToggle("weeklySummary")
                  }
                  trackColor={{
                    false: currentTheme.colors.accent,
                    true: currentTheme.colors.primary,
                  }}
                  thumbColor={
                    notificationSettings.weeklySummary ? "#fff" : "#f4f3f4"
                  }
                />
              </View>

              {/* Monthly Summary */}
              <View
                style={[
                  styles.notificationSettingItem,
                  { backgroundColor: currentTheme.colors.surface },
                ]}
              >
                <TouchableOpacity
                  style={styles.notificationSettingInfo}
                  onPress={handleMonthlySummaryTap}
                >
                  <Text
                    style={[
                      styles.notificationSettingTitle,
                      { color: currentTheme.colors.text },
                    ]}
                  >
                    📈 Monthly Summary
                  </Text>
                  <Text
                    style={[
                      styles.notificationSettingSubtitle,
                      { color: currentTheme.colors.textSecondary },
                    ]}
                  >
                    "Let's see your monthly activity!" - Tap to view monthly
                    statistics
                  </Text>
                </TouchableOpacity>
                <Switch
                  value={notificationSettings.monthlySummary}
                  onValueChange={() =>
                    handleNotificationToggle("monthlySummary")
                  }
                  trackColor={{
                    false: currentTheme.colors.accent,
                    true: currentTheme.colors.primary,
                  }}
                  thumbColor={
                    notificationSettings.monthlySummary ? "#fff" : "#f4f3f4"
                  }
                />
              </View>

              <View style={styles.notificationSettingsFooter}>
                <Text
                  style={[
                    styles.notificationSettingsFooterText,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  Summary notifications are sent every week/month to help you
                  track your progress
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Emergency Contacts Modal */}
      <Modal
        visible={showEmergencyContacts}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowEmergencyContacts(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.emergencyContactsModal,
              { backgroundColor: currentTheme.colors.background },
            ]}
          >
            <View
              style={[
                styles.emergencyContactsHeader,
                { borderBottomColor: currentTheme.colors.accent },
              ]}
            >
              <Text
                style={[
                  styles.emergencyContactsTitle,
                  { color: currentTheme.colors.text },
                ]}
              >
                Emergency Contacts
              </Text>
              <TouchableOpacity
                style={styles.emergencyContactsCloseButton}
                onPress={() => setShowEmergencyContacts(false)}
              >
                <Text
                  style={[
                    styles.emergencyContactsCloseText,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  ✕
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.emergencyContactsContent}>
              {/* Add Friend Button - Only show if under limit */}
              {emergencyFriends.length < 3 ? (
                <TouchableOpacity
                  style={[
                    styles.addContactButton,
                    { backgroundColor: currentTheme.colors.primary },
                  ]}
                  onPress={() => {
                    setShowAddFriend(true);
                  }}
                >
                  <Text style={styles.addContactButtonText}>
                    + Add Emergency Friend
                  </Text>
                </TouchableOpacity>
              ) : (
                <View
                  style={[
                    styles.addContactButton,
                    { backgroundColor: currentTheme.colors.textSecondary },
                  ]}
                >
                  <Text style={[styles.addContactButtonText, { opacity: 0.8 }]}>
                    ✓ Emergency Friend Limit Reached (3/3)
                  </Text>
                </View>
              )}

              {/* Emergency Friends List */}
              {loadingEmergencyContacts ? (
                <View style={styles.emergencyContactsLoading}>
                  <ActivityIndicator
                    color={currentTheme.colors.primary}
                    size="small"
                  />
                  <Text
                    style={[
                      styles.emergencyContactsLoadingText,
                      { color: currentTheme.colors.textSecondary },
                    ]}
                  >
                    Loading emergency contacts...
                  </Text>
                </View>
              ) : emergencyFriends.length > 0 ? (
                emergencyFriends.map((friend) => (
                  <View
                    key={friend.id}
                    style={[
                      styles.emergencyContactItem,
                      { backgroundColor: currentTheme.colors.surface },
                    ]}
                  >
                    <View style={styles.emergencyContactInfo}>
                      <Text
                        style={[
                          styles.emergencyContactName,
                          { color: currentTheme.colors.text },
                        ]}
                      >
                        {friend.name}
                      </Text>
                      <Text
                        style={[
                          styles.emergencyContactPhone,
                          { color: currentTheme.colors.textSecondary },
                        ]}
                      >
                        Emergency Friend
                      </Text>
                    </View>
                    <View style={styles.emergencyContactControls}>
                      <Switch
                        value={friend.isEnabled}
                        onValueChange={(value) =>
                          handleToggleEmergencyFriend(friend.id, value)
                        }
                        trackColor={{
                          false: currentTheme.colors.accent,
                          true: currentTheme.colors.primary,
                        }}
                        thumbColor={friend.isEnabled ? "#fff" : "#f4f3f4"}
                      />
                      <TouchableOpacity
                        style={[
                          styles.removeContactButton,
                          { backgroundColor: currentTheme.colors.error },
                        ]}
                        onPress={() => handleRemoveEmergencyFriend(friend.id)}
                      >
                        <Text style={styles.removeContactButtonText}>
                          Remove
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.emergencyContactsEmpty}>
                  <Text
                    style={[
                      styles.emergencyContactsEmptyTitle,
                      { color: currentTheme.colors.text },
                    ]}
                  >
                    No Emergency Contacts
                  </Text>
                  <Text
                    style={[
                      styles.emergencyContactsEmptyText,
                      { color: currentTheme.colors.textSecondary },
                    ]}
                  >
                    Add emergency contacts who will receive alerts with your
                    location in case of emergency during rides.
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Add Contact Modal */}
      <Modal
        visible={showAddFriend}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAddFriend(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.addContactModal,
              { backgroundColor: currentTheme.colors.background },
            ]}
          >
            <View
              style={[
                styles.addContactHeader,
                { borderBottomColor: currentTheme.colors.accent },
              ]}
            >
              <Text
                style={[
                  styles.addContactTitle,
                  { color: currentTheme.colors.text },
                ]}
              >
                Add Emergency Friend
              </Text>
              <TouchableOpacity
                style={styles.addContactCloseButton}
                onPress={() => {
                  setShowAddFriend(false);
                  setSearchQuery("");
                }}
              >
                <Text
                  style={[
                    styles.addContactCloseText,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  ✕
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.addContactContent}>
              {/* Search Bar */}
              <TextInput
                style={[
                  styles.searchInput,
                  {
                    backgroundColor: currentTheme.colors.surface,
                    color: currentTheme.colors.text,
                    borderColor: currentTheme.colors.accent,
                  },
                ]}
                placeholder="Search friends..."
                placeholderTextColor={currentTheme.colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />

              {/* Friends List */}
              {loadingFriends ? (
                <View style={styles.emergencyContactsLoading}>
                  <ActivityIndicator
                    color={currentTheme.colors.primary}
                    size="small"
                  />
                  <Text
                    style={[
                      styles.emergencyContactsLoadingText,
                      { color: currentTheme.colors.textSecondary },
                    ]}
                  >
                    Loading friends...
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={userFriends.filter(
                    (friend) =>
                      friend.name
                        ?.toLowerCase()
                        .includes(searchQuery.toLowerCase()) ||
                      friend.username
                        ?.toLowerCase()
                        .includes(searchQuery.toLowerCase())
                  )}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[
                        styles.deviceContactItem,
                        { backgroundColor: currentTheme.colors.surface },
                      ]}
                      onPress={() => handleAddEmergencyFriend(item)}
                    >
                      <View style={styles.deviceContactInfo}>
                        <Text
                          style={[
                            styles.deviceContactName,
                            { color: currentTheme.colors.text },
                          ]}
                        >
                          {item.name || item.username}
                        </Text>
                        <Text
                          style={[
                            styles.deviceContactPhone,
                            { color: currentTheme.colors.textSecondary },
                          ]}
                        >
                          @{item.username}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}
                  style={styles.contactsList}
                  showsVerticalScrollIndicator={false}
                  ListEmptyComponent={
                    <View style={styles.addContactNoPermission}>
                      <Text
                        style={[
                          styles.addContactNoPermissionTitle,
                          { color: currentTheme.colors.text },
                        ]}
                      >
                        No friends found
                      </Text>
                      <Text
                        style={[
                          styles.addContactNoPermissionText,
                          { color: currentTheme.colors.textSecondary },
                        ]}
                      >
                        Try adjusting your search or add friends first.
                      </Text>
                    </View>
                  }
                />
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Hidden Posts Modal */}
      <Modal
        visible={showHiddenPosts}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowHiddenPosts(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.hiddenPostsModal,
              { backgroundColor: currentTheme.colors.background },
            ]}
          >
            <View
              style={[
                styles.hiddenPostsHeader,
                { borderBottomColor: currentTheme.colors.accent },
              ]}
            >
              <Text
                style={[
                  styles.hiddenPostsTitle,
                  { color: currentTheme.colors.text },
                ]}
              >
                Hidden Posts
              </Text>
              <TouchableOpacity
                style={styles.hiddenPostsCloseButton}
                onPress={() => setShowHiddenPosts(false)}
              >
                <Text
                  style={[
                    styles.hiddenPostsCloseText,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  ✕
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.hiddenPostsContent}>
              {loadingHiddenPosts ? (
                <View style={styles.hiddenPostsLoading}>
                  <ActivityIndicator
                    color={currentTheme.colors.primary}
                    size="small"
                  />
                  <Text
                    style={[
                      styles.hiddenPostsLoadingText,
                      { color: currentTheme.colors.textSecondary },
                    ]}
                  >
                    Loading hidden posts...
                  </Text>
                </View>
              ) : hiddenPosts.length > 0 ? (
                hiddenPosts.map((post) => (
                  <View
                    key={post.id}
                    style={[
                      styles.hiddenPostItem,
                      { backgroundColor: currentTheme.colors.surface },
                    ]}
                  >
                    <View style={styles.hiddenPostInfo}>
                      <Text
                        style={[
                          styles.hiddenPostAuthor,
                          { color: currentTheme.colors.text },
                        ]}
                      >
                        {post.authorName}
                      </Text>
                      <Text
                        style={[
                          styles.hiddenPostContent,
                          { color: currentTheme.colors.textSecondary },
                        ]}
                      >
                        {post.content}
                      </Text>
                      <Text
                        style={[
                          styles.hiddenPostDate,
                          { color: currentTheme.colors.textSecondary },
                        ]}
                      >
                        Hidden on {new Date(post.hiddenAt).toLocaleDateString()}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.unhideButton,
                        { backgroundColor: currentTheme.colors.primary },
                      ]}
                      onPress={() => handleUnhidePost(post.id)}
                    >
                      <Text style={styles.unhideButtonText}>Restore</Text>
                    </TouchableOpacity>
                  </View>
                ))
              ) : (
                <View style={styles.hiddenPostsEmpty}>
                  <Text
                    style={[
                      styles.hiddenPostsEmptyTitle,
                      { color: currentTheme.colors.text },
                    ]}
                  >
                    No Hidden Posts
                  </Text>
                  <Text
                    style={[
                      styles.hiddenPostsEmptyText,
                      { color: currentTheme.colors.textSecondary },
                    ]}
                  >
                    You haven't hidden any posts yet. When you hide posts from
                    your feed, they'll appear here.
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Feedback Modal */}
      <Modal
        visible={showFeedback}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowFeedback(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.feedbackModal,
              { backgroundColor: currentTheme.colors.background },
            ]}
          >
            <View
              style={[
                styles.feedbackHeader,
                { borderBottomColor: currentTheme.colors.accent },
              ]}
            >
              <Text
                style={[
                  styles.feedbackTitle,
                  { color: currentTheme.colors.text },
                ]}
              >
                Send Feedback
              </Text>
              <TouchableOpacity
                style={styles.feedbackCloseButton}
                onPress={() => setShowFeedback(false)}
              >
                <Text
                  style={[
                    styles.feedbackCloseText,
                    { color: currentTheme.colors.text },
                  ]}
                >
                  ✕
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.feedbackContent}>
              <Text
                style={[
                  styles.feedbackDescription,
                  { color: currentTheme.colors.textSecondary },
                ]}
              >
                We value your feedback! Help us improve EquiHUB by sharing your
                thoughts, suggestions, or reporting issues.
              </Text>

              {/* Subject Input */}
              <Text
                style={[
                  styles.feedbackLabel,
                  { color: currentTheme.colors.text },
                ]}
              >
                Subject*
              </Text>
              <TextInput
                style={[
                  styles.feedbackSubjectInput,
                  {
                    borderColor: currentTheme.colors.border,
                    backgroundColor: currentTheme.colors.surface,
                    color: currentTheme.colors.text,
                  },
                ]}
                placeholder="Brief description of your feedback"
                placeholderTextColor={currentTheme.colors.textSecondary}
                value={feedbackSubject}
                onChangeText={setFeedbackSubject}
                maxLength={200}
                editable={!isSubmittingFeedback}
              />
              <Text
                style={[
                  styles.feedbackCharacterCount,
                  { color: currentTheme.colors.textSecondary },
                ]}
              >
                {feedbackSubject.length}/200
              </Text>

              {/* Message Input */}
              <Text
                style={[
                  styles.feedbackLabel,
                  { color: currentTheme.colors.text },
                ]}
              >
                Message*
              </Text>
              <TextInput
                style={[
                  styles.feedbackMessageInput,
                  {
                    borderColor: currentTheme.colors.border,
                    backgroundColor: currentTheme.colors.surface,
                    color: currentTheme.colors.text,
                  },
                ]}
                placeholder="Please describe your feedback in detail..."
                placeholderTextColor={currentTheme.colors.textSecondary}
                value={feedbackMessage}
                onChangeText={setFeedbackMessage}
                maxLength={2000}
                multiline={true}
                numberOfLines={8}
                textAlignVertical="top"
                editable={!isSubmittingFeedback}
              />
              <Text
                style={[
                  styles.feedbackCharacterCount,
                  { color: currentTheme.colors.textSecondary },
                ]}
              >
                {feedbackMessage.length}/2000
              </Text>

              {/* Consent Checkbox */}
              <View style={styles.consentContainer}>
                <TouchableOpacity
                  style={styles.checkboxContainer}
                  onPress={() => setConsentToShareEmail(!consentToShareEmail)}
                  disabled={isSubmittingFeedback}
                >
                  <View
                    style={[
                      styles.checkbox,
                      {
                        borderColor: currentTheme.colors.border,
                        backgroundColor: consentToShareEmail
                          ? currentTheme.colors.primary
                          : currentTheme.colors.surface,
                      },
                    ]}
                  >
                    {consentToShareEmail && (
                      <Text style={styles.checkboxCheckmark}>✓</Text>
                    )}
                  </View>
                  <View style={styles.checkboxTextContainer}>
                    <Text
                      style={[
                        styles.consentOptionalText,
                        { color: currentTheme.colors.textSecondary },
                      ]}
                    >
                      Optional
                    </Text>
                    <Text
                      style={[
                        styles.consentText,
                        { color: currentTheme.colors.text },
                      ]}
                    >
                      I consent to share my email address to receive updates
                      about my feedback
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={[
                  styles.feedbackSubmitButton,
                  {
                    backgroundColor:
                      isSubmittingFeedback ||
                      !feedbackSubject.trim() ||
                      !feedbackMessage.trim()
                        ? currentTheme.colors.textSecondary
                        : currentTheme.colors.primary,
                  },
                ]}
                onPress={handleSubmitFeedback}
                disabled={
                  isSubmittingFeedback ||
                  !feedbackSubject.trim() ||
                  !feedbackMessage.trim()
                }
              >
                {isSubmittingFeedback && (
                  <ActivityIndicator
                    size="small"
                    color="#fff"
                    style={{ marginRight: 8 }}
                  />
                )}
                <Text style={styles.feedbackSubmitButtonText}>
                  {isSubmittingFeedback ? "Sending..." : "Send Feedback"}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Terms of Service Modal */}
      <Modal
        visible={showTermsOfService}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowTermsOfService(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.termsOfServiceModal,
              { backgroundColor: currentTheme.colors.background },
            ]}
          >
            <View
              style={[
                styles.termsOfServiceHeader,
                { borderBottomColor: currentTheme.colors.accent },
              ]}
            >
              <Text
                style={[
                  styles.termsOfServiceTitle,
                  { color: currentTheme.colors.text },
                ]}
              >
                Terms of Service
              </Text>
              <TouchableOpacity
                style={styles.termsOfServiceCloseButton}
                onPress={() => setShowTermsOfService(false)}
              >
                <Text
                  style={[
                    styles.termsOfServiceCloseText,
                    { color: currentTheme.colors.text },
                  ]}
                >
                  ✕
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.termsOfServiceContent}>
              <Text
                style={[
                  styles.termsOfServiceText,
                  { color: currentTheme.colors.text },
                ]}
              >
                <Text style={styles.termsOfServiceSectionTitle}>
                  1. Acceptance of Terms{"\n"}
                </Text>
                By downloading, installing, or using EquiHUB, you agree to be
                bound by these Terms of Service. If you do not agree to these
                terms, please do not use our application.{"\n\n"}
                <Text style={styles.termsOfServiceSectionTitle}>
                  2. Description of Service{"\n"}
                </Text>
                EquiHUB is a mobile application designed for equestrian
                enthusiasts to track horse training sessions, manage horse care,
                connect with the equestrian community, and access safety
                features including emergency contacts and first aid guidance.
                {"\n\n"}
                <Text style={styles.termsOfServiceSectionTitle}>
                  3. User Accounts and Registration{"\n"}
                </Text>
                • You must provide accurate and complete information when
                creating an account{"\n"}• You are responsible for maintaining
                the security of your account credentials{"\n"}• You must be at
                least 13 years old to use EquiHUB{"\n"}• One account per user is
                permitted{"\n\n"}
                <Text style={styles.termsOfServiceSectionTitle}>
                  4. User Conduct and Content{"\n"}
                </Text>
                You agree not to:{"\n"}• Post inappropriate, offensive, or
                harmful content{"\n"}• Harass, bully, or threaten other users
                {"\n"}• Share false or misleading information{"\n"}• Violate any
                applicable laws or regulations{"\n"}• Attempt to hack, disrupt,
                or damage the application{"\n\n"}
                <Text style={styles.termsOfServiceSectionTitle}>
                  5. Privacy and Data Protection{"\n"}
                </Text>
                Your privacy is important to us. Please review our Privacy
                Policy to understand how we collect, use, and protect your
                information. By using EquiHUB, you consent to our data practices
                as described in our Privacy Policy.{"\n\n"}
                <Text style={styles.termsOfServiceSectionTitle}>
                  6. Safety Features and Emergency Services{"\n"}
                </Text>
                • Emergency contact features are provided as a convenience but
                should not replace professional emergency services{"\n"}• Always
                call local emergency services (911, 112, etc.) in case of
                serious emergencies{"\n"}• First aid information is for
                educational purposes only and does not replace professional
                medical training{"\n"}• EquiHUB is not responsible for the
                accuracy or effectiveness of emergency features{"\n\n"}
                <Text style={styles.termsOfServiceSectionTitle}>
                  7. Location Services{"\n"}
                </Text>
                EquiHUB may use location services to provide tracking features
                and safety functionality. You can control location permissions
                through your device settings.{"\n\n"}
                <Text style={styles.termsOfServiceSectionTitle}>
                  8. Subscription and Pro Features{"\n"}
                </Text>
                • Some features may require a paid subscription{"\n"}•
                Subscription fees are charged according to your selected plan
                {"\n"}• Cancellation policies apply as described in your app
                store{"\n"}• Pro features may be modified or discontinued with
                notice{"\n\n"}
                <Text style={styles.termsOfServiceSectionTitle}>
                  9. Intellectual Property{"\n"}
                </Text>
                EquiHUB and its content are protected by copyright, trademark,
                and other intellectual property laws. You may not copy,
                distribute, or create derivative works without permission.
                {"\n\n"}
                <Text style={styles.termsOfServiceSectionTitle}>
                  10. Limitation of Liability{"\n"}
                </Text>
                EquiHUB is provided "as is" without warranties. We are not
                liable for any damages arising from your use of the application,
                including but not limited to data loss, injury, or equipment
                damage.{"\n\n"}
                <Text style={styles.termsOfServiceSectionTitle}>
                  11. Indemnification{"\n"}
                </Text>
                You agree to indemnify and hold EquiHUB harmless from any
                claims, damages, or expenses arising from your use of the
                application or violation of these terms.{"\n\n"}
                <Text style={styles.termsOfServiceSectionTitle}>
                  12. Termination{"\n"}
                </Text>
                We may suspend or terminate your account for violation of these
                terms. You may delete your account at any time through the
                application settings.{"\n\n"}
                <Text style={styles.termsOfServiceSectionTitle}>
                  13. Changes to Terms{"\n"}
                </Text>
                We reserve the right to modify these Terms of Service at any
                time. Users will be notified of significant changes through the
                application or email.{"\n\n"}
                <Text style={styles.termsOfServiceSectionTitle}>
                  14. Governing Law{"\n"}
                </Text>
                These terms are governed by the laws of the jurisdiction where
                EquiHUB is operated, without regard to conflict of law
                principles.{"\n\n"}
                <Text style={styles.termsOfServiceSectionTitle}>
                  15. Contact Information{"\n"}
                </Text>
                For questions about these Terms of Service, please contact us
                through the feedback feature in the application.{"\n\n"}
                <Text
                  style={[
                    styles.termsOfServiceFooter,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  Last Updated: {new Date().toLocaleDateString()}
                  {"\n"}
                  Version 1.0{"\n\n"}
                  Thank you for using EquiHUB and being part of our equestrian
                  community!
                </Text>
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* About Modal */}
      <Modal
        visible={showAbout}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAbout(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.aboutModal,
              { backgroundColor: currentTheme.colors.background },
            ]}
          >
            <View
              style={[
                styles.aboutHeader,
                { borderBottomColor: currentTheme.colors.accent },
              ]}
            >
              <Text
                style={[styles.aboutTitle, { color: currentTheme.colors.text }]}
              >
                About EquiHUB
              </Text>
              <TouchableOpacity
                style={styles.aboutCloseButton}
                onPress={() => setShowAbout(false)}
              >
                <Text
                  style={[
                    styles.aboutCloseText,
                    { color: currentTheme.colors.text },
                  ]}
                >
                  ✕
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.aboutContent}>
              <View style={styles.aboutLogoContainer}>
                <Image
                  source={require("../../assets/icons/512x512.png")}
                  style={styles.aboutAppIcon}
                />
                <Text
                  style={[
                    styles.aboutAppName,
                    { color: currentTheme.colors.text },
                  ]}
                >
                  EquiHUB
                </Text>
                <Text
                  style={[
                    styles.aboutVersion,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  Version {appConfig.expo.version}
                </Text>
              </View>

              <Text
                style={[styles.aboutText, { color: currentTheme.colors.text }]}
              >
                <Text style={styles.aboutSectionTitle}>
                  Welcome to EquiHUB!{"\n"}
                </Text>
                EquiHUB is your comprehensive companion for all things
                equestrian. Whether you're a professional rider, a passionate
                enthusiast, or just starting your journey with horses, our app
                is designed to enhance your experience and keep you connected
                with the equestrian community.{"\n\n"}
                <Text style={styles.aboutSectionTitle}>
                  🎯 Our Mission{"\n"}
                </Text>
                To empower equestrians with innovative tools that make horse
                care, training, and community connection easier, safer, and more
                enjoyable. We believe that technology can enhance the timeless
                bond between humans and horses.{"\n\n"}
                <Text style={styles.aboutSectionTitle}>
                  ✨ Key Features{"\n"}
                </Text>
                <Text style={styles.aboutFeatureItem}>🐴 Horse Management</Text>
                Comprehensive profiles for all your horses with health records,
                training progress, and care schedules.{"\n\n"}
                <Text style={styles.aboutFeatureItem}>
                  📊 Training Tracking
                </Text>
                Record and analyze your riding sessions with detailed metrics,
                GPS tracking, and progress visualization.{"\n\n"}
                <Text style={styles.aboutFeatureItem}>
                  🏆 Community Challenges
                </Text>
                Join global and stable-specific challenges to stay motivated and
                connect with fellow riders.{"\n\n"}
                <Text style={styles.aboutFeatureItem}>💬 Social Features</Text>
                Share your achievements, connect with friends, and engage with
                the equestrian community.{"\n\n"}
                <Text style={styles.aboutFeatureItem}>🚨 Safety First</Text>
                Emergency contacts, first aid guidance, and safety features
                designed specifically for equestrians.{"\n\n"}
                <Text style={styles.aboutFeatureItem}>📚 Tips & Guides</Text>
                Expert advice, training tips, and educational content to improve
                your horsemanship skills.{"\n\n"}
                <Text style={styles.aboutSectionTitle}>
                  🌟 Pro Features{"\n"}
                </Text>
                Unlock advanced analytics, unlimited horses, priority support,
                and exclusive content with EquiHUB Pro.{"\n\n"}
                <Text style={styles.aboutSectionTitle}>
                  🛡️ Safety & Privacy{"\n"}
                </Text>
                Your data security and privacy are our top priorities. We use
                industry-standard encryption and never share your personal
                information without your consent.{"\n\n"}
                <Text style={styles.aboutSectionTitle}>
                  🤝 Community-Driven{"\n"}
                </Text>
                EquiHUB is built by equestrians, for equestrians. We listen to
                our community and continuously improve based on your feedback
                and needs.{"\n\n"}
                <Text style={styles.aboutSectionTitle}>
                  📧 Contact & Support{"\n"}
                </Text>
                Need help or have suggestions? Use the feedback feature in the
                app or visit our support resources. We're here to help you make
                the most of your equestrian journey.{"\n\n"}
                <Text style={styles.aboutSectionTitle}>
                  🙏 Acknowledgments{"\n"}
                </Text>
                Special thanks to the equestrian community for their invaluable
                feedback, testing, and support in making EquiHUB the best it can
                be.{"\n\n"}
                <Text
                  style={[
                    styles.aboutFooter,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  Made with ❤️ for the equestrian community{"\n"}© 2025 EquiHUB.
                  All rights reserved.{"\n\n"}
                  Follow your passion. Track your progress. Connect with your
                  community.{"\n"}
                  Happy riding! 🐎✨
                </Text>
              </Text>
            </ScrollView>
          </View>
        </View>
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
    marginBottom: Platform.OS === "ios" ? -50 : -45,
    marginTop: Platform.OS === "ios" ? -15 : -5,
  },
  header: {
    fontSize: 30,
    fontFamily: "Inder",
    color: "#fff",
    textAlign: "center",
    flex: 1,
    fontWeight: "600",
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
  backIcon: {
    width: 26,
    height: 26,
    tintColor: "#fff",
  },
  viewPort: {
    backgroundColor: "#FFFFFF",
    flex: 1,
    borderTopLeftRadius: 50,
    borderTopRightRadius: 50,
    marginTop: -4,
    paddingTop: 15,
    paddingBottom: 150, // Add bottom padding to account for tab bar
  },
  optionsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#335C67",
    marginBottom: 15,
    fontFamily: "Inder",
  },
  sectionContent: {
    backgroundColor: "#E9F5F0",
    borderRadius: 20,
    padding: 5,
  },
  settingItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#C5D9D1",
  },
  settingInfo: {
    flex: 1,
    marginRight: 15,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#335C67",
    fontFamily: "Inder",
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 14,
    color: "#666",
    fontFamily: "Inder",
  },
  dropdownButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 8,
    minWidth: 100,
    justifyContent: "space-between",
  },
  dropdownButtonText: {
    fontSize: 14,
    fontFamily: "Inder",
    marginRight: 5,
  },
  dropdownArrow: {
    fontSize: 12,
    fontFamily: "Inder",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  dropdownModal: {
    borderRadius: 12,
    padding: 20,
    width: "80%",
    maxWidth: 300,
    maxHeight: 400,
  },
  dropdownModalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 15,
    fontFamily: "Inder",
  },
  dropdownModalContent: {
    maxHeight: 250,
  },
  dropdownOption: {
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  dropdownOptionText: {
    fontSize: 16,
    textAlign: "center",
    fontFamily: "Inder",
  },
  dropdownOptionDescription: {
    fontSize: 12,
    textAlign: "center",
    fontFamily: "Inder",
    fontStyle: "italic",
  },
  actionButton: {
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  actionButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonLoader: {
    marginRight: 8,
  },
  actionButtonText: {
    fontSize: 16,
    color: "#335C67",
    fontFamily: "Inder",
    fontWeight: "500",
  },
  disabledButton: {
    opacity: 0.6,
  },
  logoutButton: {
    backgroundColor: "#FF9800",
    borderRadius: 15,
    marginVertical: 5,
    borderBottomWidth: 0,
  },
  logoutButtonText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "bold",
  },
  deleteButton: {
    backgroundColor: "#FF6B6B",
    borderRadius: 15,
    marginVertical: 5,
    borderBottomWidth: 0,
  },
  deleteButtonText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "bold",
  },
  // Hidden Posts Modal Styles
  hiddenPostsModal: {
    maxHeight: "80%",
    minHeight: "50%",
    borderRadius: 20,
    padding: 0,
    margin: 0,
    width: "95%",
  },
  hiddenPostsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
  },
  hiddenPostsTitle: {
    fontSize: 20,
    fontWeight: "bold",
    fontFamily: "Inder",
  },
  hiddenPostsCloseButton: {
    padding: 8,
    borderRadius: 20,
  },
  hiddenPostsCloseText: {
    fontSize: 18,
    fontWeight: "bold",
  },
  hiddenPostsContent: {
    padding: 20,
    maxHeight: 400,
  },
  hiddenPostsLoading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  hiddenPostsLoadingText: {
    marginLeft: 8,
    fontSize: 14,
    fontFamily: "Inder",
  },
  hiddenPostItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  hiddenPostInfo: {
    flex: 1,
    marginRight: 12,
  },
  hiddenPostAuthor: {
    fontSize: 16,
    fontWeight: "bold",
    fontFamily: "Inder",
    marginBottom: 4,
  },
  hiddenPostContent: {
    fontSize: 14,
    fontFamily: "Inder",
    marginBottom: 4,
    lineHeight: 18,
  },
  hiddenPostDate: {
    fontSize: 12,
    fontFamily: "Inder",
  },
  unhideButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    minWidth: 80,
  },
  unhideButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    fontFamily: "Inder",
  },
  hiddenPostsEmpty: {
    alignItems: "center",
    padding: 40,
  },
  hiddenPostsEmptyTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
    fontFamily: "Inder",
  },
  hiddenPostsEmptyText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    fontFamily: "Inder",
  },

  // Emergency Contacts Modal Styles
  emergencyContactsModal: {
    maxHeight: "85%",
    minHeight: "60%",
    borderRadius: 20,
    padding: 0,
    margin: 0,
    width: "95%",
  },
  emergencyContactsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
  },
  emergencyContactsTitle: {
    fontSize: 20,
    fontWeight: "bold",
    fontFamily: "Inder",
  },
  emergencyContactsCloseButton: {
    padding: 8,
    borderRadius: 20,
  },
  emergencyContactsCloseText: {
    fontSize: 18,
    fontWeight: "bold",
  },
  emergencyContactsContent: {
    padding: 20,
    maxHeight: 500,
  },
  emergencyContactsLoading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  emergencyContactsLoadingText: {
    marginLeft: 8,
    fontSize: 14,
    fontFamily: "Inder",
  },
  permissionBanner: {
    backgroundColor: "rgba(74, 144, 226, 0.1)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(74, 144, 226, 0.3)",
  },
  permissionBannerText: {
    fontSize: 14,
    fontFamily: "Inder",
    lineHeight: 20,
    marginBottom: 12,
  },
  permissionBannerButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  permissionBannerButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inder",
  },
  addContactButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  addContactButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inder",
  },
  emergencyContactItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 12,
    marginTop: 10,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  emergencyContactInfo: {
    flex: 1,
    marginRight: 12,
  },
  emergencyContactName: {
    fontSize: 16,
    fontWeight: "bold",
    fontFamily: "Inder",
    marginBottom: 4,
  },
  emergencyContactPhone: {
    fontSize: 14,
    fontFamily: "Inder",
  },
  emergencyContactControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  removeContactButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  removeContactButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Inder",
  },
  emergencyContactsEmpty: {
    alignItems: "center",
    padding: 40,
  },
  emergencyContactsEmptyTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
    fontFamily: "Inder",
  },
  emergencyContactsEmptyText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    fontFamily: "Inder",
  },

  // Add Contact Modal Styles
  addContactModal: {
    maxHeight: "85%",
    minHeight: "60%",
    borderRadius: 20,
    padding: 0,
    margin: 0,
    width: "95%",
  },
  addContactHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
  },
  addContactTitle: {
    fontSize: 20,
    fontWeight: "bold",
    fontFamily: "Inder",
  },
  addContactCloseButton: {
    padding: 8,
    borderRadius: 20,
  },
  addContactCloseText: {
    fontSize: 18,
    fontWeight: "bold",
  },
  addContactContent: {
    flex: 1,
    padding: 20,
  },
  searchInput: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
    fontSize: 16,
    fontFamily: "Inder",
  },
  contactsList: {
    flex: 1,
  },
  deviceContactItem: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  deviceContactInfo: {
    flex: 1,
  },
  deviceContactName: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inder",
    marginBottom: 4,
  },
  deviceContactPhone: {
    fontSize: 14,
    fontFamily: "Inder",
  },
  addContactNoPermission: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  addContactNoPermissionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
    fontFamily: "Inder",
    textAlign: "center",
  },
  addContactNoPermissionText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
    fontFamily: "Inder",
  },
  addContactPermissionButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  addContactPermissionButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inder",
  },
  // Version styles
  versionContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  versionText: {
    fontSize: 12,
    fontFamily: "Inder",
    textAlign: "center",
    opacity: 0.7,
  },

  // Push Notification Settings Modal Styles
  notificationSettingsModal: {
    maxHeight: "85%",
    minHeight: "60%",
    borderRadius: 20,
    padding: 0,
    margin: 0,
    width: "95%",
  },
  notificationSettingsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  notificationSettingsTitle: {
    fontSize: 20,
    fontWeight: "bold",
    fontFamily: "Inder",
  },
  notificationSettingsCloseButton: {
    padding: 8,
    borderRadius: 20,
  },
  notificationSettingsCloseText: {
    fontSize: 18,
    fontWeight: "bold",
  },
  notificationSettingsContent: {
    padding: 20,
    maxHeight: 500,
  },
  notificationSettingsDescription: {
    fontSize: 14,
    fontFamily: "Inder",
    marginBottom: 20,
    textAlign: "center",
    lineHeight: 20,
  },
  notificationSettingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  notificationSettingInfo: {
    flex: 1,
    marginRight: 12,
  },
  notificationSettingTitle: {
    fontSize: 16,
    fontWeight: "bold",
    fontFamily: "Inder",
    marginBottom: 4,
    flex: 1,
  },
  notificationSettingSubtitle: {
    fontSize: 14,
    fontFamily: "Inder",
    lineHeight: 18,
  },
  notificationSettingsFooter: {
    marginTop: 10,
    marginBottom: 40,
    padding: 16,
    borderRadius: 8,
    backgroundColor: "rgba(51, 92, 103, 0.1)",
  },
  notificationSettingsFooterText: {
    fontSize: 12,
    fontFamily: "Inder",
    textAlign: "center",
    lineHeight: 16,
    fontStyle: "italic",
  },

  // Feedback Modal Styles
  feedbackModal: {
    maxHeight: "90%",
    minHeight: "80%",
    borderRadius: 20,
    padding: 0,
    margin: 0,
    width: "95%",
  },
  feedbackHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  feedbackTitle: {
    fontSize: 20,
    fontWeight: "bold",
    fontFamily: "Inder",
  },
  feedbackCloseButton: {
    padding: 8,
    borderRadius: 20,
  },
  feedbackCloseText: {
    fontSize: 18,
    fontWeight: "bold",
  },
  feedbackContent: {
    padding: 20,
    flex: 1,
  },
  feedbackDescription: {
    fontSize: 14,
    fontFamily: "Inder",
    marginBottom: 20,
    textAlign: "center",
    lineHeight: 20,
  },
  feedbackLabel: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inder",
    marginBottom: 8,
    marginTop: 8,
  },
  feedbackSubjectInput: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
    fontFamily: "Inder",
    marginBottom: 4,
  },
  feedbackMessageInput: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
    fontFamily: "Inder",
    marginBottom: 4,
    minHeight: 120,
  },
  feedbackCharacterCount: {
    fontSize: 12,
    fontFamily: "Inder",
    textAlign: "right",
    marginBottom: 8,
    opacity: 0.7,
  },
  feedbackSubmitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 20,
    marginBottom: 50,
  },
  feedbackSubmitButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inder",
  },
  consentContainer: {
    marginTop: 20,
    marginBottom: 10,
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderRadius: 4,
    marginRight: 12,
    marginTop: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxCheckmark: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "bold",
    lineHeight: 16,
  },
  checkboxTextContainer: {
    flex: 1,
    paddingRight: 8,
  },
  consentOptionalText: {
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "Inder",
    marginBottom: 4,
  },
  consentText: {
    fontSize: 14,
    fontFamily: "Inder",
    lineHeight: 20,
  },

  // Terms of Service Modal Styles
  termsOfServiceModal: {
    maxHeight: "90%",
    minHeight: "85%",
    borderRadius: 20,
    padding: 0,
    margin: 0,
    width: "95%",
  },
  termsOfServiceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    paddingTop: 10,
    paddingBottom: 15,
    borderBottomWidth: 1,
  },
  termsOfServiceTitle: {
    fontSize: 20,
    fontWeight: "bold",
    fontFamily: "Inder",
  },
  termsOfServiceCloseButton: {
    padding: 8,
    borderRadius: 20,
  },
  termsOfServiceCloseText: {
    fontSize: 18,
    fontWeight: "bold",
  },
  termsOfServiceContent: {
    padding: 20,
    flex: 1,
  },
  termsOfServiceText: {
    fontSize: 14,
    fontFamily: "Inder",
    lineHeight: 22,
    textAlign: "left",
  },
  termsOfServiceSectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    fontFamily: "Inder",
    marginTop: 8,
    marginBottom: 4,
  },
  termsOfServiceFooter: {
    fontSize: 12,
    fontFamily: "Inder",
    fontStyle: "italic",
    textAlign: "center",
    lineHeight: 18,
    marginTop: 10,
  },

  // About Modal Styles
  aboutModal: {
    maxHeight: "90%",
    minHeight: "85%",
    borderRadius: 20,
    padding: 0,
    margin: 0,
    width: "95%",
  },
  aboutHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    paddingTop: 10,
    paddingBottom: 15,
    borderBottomWidth: 1,
  },
  aboutTitle: {
    fontSize: 20,
    fontWeight: "bold",
    fontFamily: "Inder",
  },
  aboutCloseButton: {
    padding: 8,
    borderRadius: 20,
  },
  aboutCloseText: {
    fontSize: 18,
    fontWeight: "bold",
  },
  aboutContent: {
    padding: 20,
    flex: 1,
  },
  aboutLogoContainer: {
    alignItems: "center",
    marginBottom: 20,
    paddingVertical: 10,
  },
  aboutAppIcon: {
    width: 80,
    height: 80,
    marginBottom: 12,
    borderRadius: 16,
  },
  aboutAppName: {
    fontSize: 32,
    fontWeight: "bold",
    fontFamily: "Inder",
    marginBottom: 8,
    textAlign: "center",
  },
  aboutVersion: {
    fontSize: 16,
    fontFamily: "Inder",
    textAlign: "center",
    opacity: 0.8,
  },
  aboutText: {
    fontSize: 14,
    fontFamily: "Inder",
    lineHeight: 22,
    textAlign: "left",
  },
  aboutSectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    fontFamily: "Inder",
    marginTop: 8,
    marginBottom: 4,
  },
  aboutFeatureItem: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Inder",
    marginBottom: 4,
    marginTop: 4,
  },
  aboutFooter: {
    fontSize: 12,
    fontFamily: "Inder",
    fontStyle: "italic",
    textAlign: "center",
    lineHeight: 18,
    marginTop: 10,
  },
});

export default OptionsScreen;
