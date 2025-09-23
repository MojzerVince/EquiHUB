/**
 * Push Notification Setup Component
 * Handles push notification registration when user is authenticated
 */

import React, { useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { NotificationService } from "../lib/notificationService";

interface PushNotificationSetupProps {
  children: React.ReactNode;
}

export const PushNotificationSetup: React.FC<PushNotificationSetupProps> = ({
  children,
}) => {
  const { user } = useAuth();

  // Setup push notifications when user is authenticated
  useEffect(() => {
    const setupPushNotifications = async () => {
      if (user?.id) {
        try {
          console.log("🔔 Setting up push notifications for user:", user.id);

          // Check if we're in Expo Go (for better logging)
          const isExpoGo = __DEV__ && !process.env.EAS_BUILD;
          if (isExpoGo) {
            console.log(
              "⚠️ Running in Expo Go - push notifications have limitations"
            );
            console.log(
              "💡 For full push notification testing, use a development build"
            );
          }

          // Register for push notifications and get token
          const token =
            await NotificationService.registerForPushNotificationsAsync();

          if (token) {
            // Save the token to the database
            await NotificationService.savePushToken(user.id, token);
            console.log(
              "✅ Push notification token registered successfully for user:",
              user.id
            );
            console.log("📱 Token:", token.substring(0, 20) + "...");
          } else {
            if (isExpoGo) {
              console.log("ℹ️ No push token in Expo Go (expected behavior)");
              console.log(
                "📱 Push notifications will work properly in production builds"
              );
            } else {
              console.log("⚠️ No push token received for user:", user.id);
            }
          }
        } catch (error) {
          console.error("❌ Error setting up push notifications:", error);
        }
      }
    };

    setupPushNotifications();
  }, [user?.id]);

  return <>{children}</>;
};

export default PushNotificationSetup;
