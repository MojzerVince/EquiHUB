/**
 * Push Notification Setup Component
 * Handles push notification registration when user is authenticated
 */

import React, { useEffect } from "react";
import { Platform } from "react-native";
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
          console.log(
            "🔔 DEBUG: Starting push notification setup for user:",
            user.id
          );

          // Check build environment
          const isExpoGo = __DEV__ && !process.env.EAS_BUILD;
          const isEasBuild = !!process.env.EAS_BUILD;
          const isDev = __DEV__;

          console.log("🔍 DEBUG: Environment check:", {
            isExpoGo,
            isEasBuild,
            isDev,
            hasEasProjectId: !!process.env.EXPO_PUBLIC_EAS_PROJECT_ID,
            platform: Platform.OS,
          });

          if (isExpoGo) {
            console.log(
              "⚠️ Running in Expo Go - push notifications have limitations"
            );
            console.log(
              "💡 For full push notification testing, use a development build"
            );
          }

          console.log("🔔 DEBUG: Calling registerForPushNotificationsAsync...");
          // Register for push notifications and get token
          const token =
            await NotificationService.registerForPushNotificationsAsync();

          console.log("🔔 DEBUG: Token registration result:", {
            hasToken: !!token,
            tokenLength: token?.length || 0,
            tokenPrefix: token?.substring(0, 30) || "NO_TOKEN",
          });

          if (token) {
            console.log("🔔 DEBUG: Attempting to save token to database...");
            // Save the token to the database
            await NotificationService.savePushToken(user.id, token);
            console.log(
              "✅ Push notification token registered successfully for user:",
              user.id
            );
            console.log("📱 Full Token:", token);

            // Verify it was saved by checking the database
            console.log("🔍 DEBUG: Verifying token was saved...");
            const hasToken = await NotificationService.checkUserHasPushToken(
              user.id
            );
            console.log("🔍 DEBUG: Token verification result:", hasToken);
          } else {
            console.log("⚠️ DEBUG: No push token received for user:", user.id);
            if (isExpoGo) {
              console.log("ℹ️ This is expected in Expo Go");
            } else {
              console.log(
                "❌ This is unexpected on a physical device/production build"
              );
            }
          }
        } catch (error) {
          console.error("❌ Error setting up push notifications:", error);
          if (error instanceof Error) {
            console.error("❌ Error stack:", error.stack);
          }
        }
      } else {
        console.log(
          "⚠️ DEBUG: No user ID available for push notification setup"
        );
      }
    };

    setupPushNotifications();
  }, [user?.id]);

  return <>{children}</>;
};

export default PushNotificationSetup;
