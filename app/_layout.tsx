import {
    DarkTheme,
    DefaultTheme,
    ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import * as Notifications from "expo-notifications";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import "react-native-reanimated";

import AppInitializer from "@/components/AppInitializer";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AuthProvider } from "@/contexts/AuthContext";
import { DialogProvider } from "@/contexts/DialogContext";
import { MetricProvider } from "@/contexts/MetricContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { ThemeProvider as CustomThemeProvider } from "@/contexts/ThemeContext";
import { TrackingProvider } from "@/contexts/TrackingContext";
import { useColorScheme } from "@/hooks/useColorScheme";
import { BackgroundFallDetectionAPI } from "@/lib/backgroundFallDetectionAPI";
import { handleNotificationResponse } from "@/lib/notificationService";
import { useRouter } from "expo-router";

// Hide Expo's default splash screen immediately
SplashScreen.hideAsync();

const AppContent = () => {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [loaded] = useFonts({
    Inder: require("../assets/fonts/Inder-Regular.ttf"),
  });

  // Set up global notification handlers when app starts
  useEffect(() => {
    let notificationListener: Notifications.Subscription;
    let responseListener: Notifications.Subscription;

    const setupGlobalNotifications = () => {
      // Listen for notifications received while app is running
      notificationListener = Notifications.addNotificationReceivedListener(
        (notification) => {
          // Additional global handling can be added here (silent handling)
        }
      );

      // Listen for notification responses (when user taps on notification)
      responseListener = Notifications.addNotificationResponseReceivedListener(
        async (response) => {
          // Handle navigation based on notification type
          const data = response.notification.request.content.data as any;

          if (data?.type === "friend_request") {
            // Navigate to community screen when friend request notification is tapped
            router.push("/(tabs)/community");
          } else if (data?.type === "emergency_alert") {
            // Navigate to emergency notification screen
            console.log(
              "🚨 Emergency notification tapped, navigating to emergency screen"
            );
            console.log("Emergency data:", data);

            // Navigate to the emergency notification screen with data
            router.push({
              pathname: "/emergency-notification",
              params: {
                data:
                  data.data ||
                  JSON.stringify({
                    riderId: data.senderId,
                    riderName: data.senderName,
                    message: data.message,
                    timestamp: Date.now(),
                  }),
              },
            });
          } else if (data?.type === "post_fall_monitoring_complete") {
            // Handle post-fall monitoring completion automatically
            console.log(
              "⏰ Post-fall monitoring notification received, processing..."
            );
            await BackgroundFallDetectionAPI.handlePostFallMonitoringComplete(
              data
            );
          }

          // Call the main handler
          handleNotificationResponse(response);
        }
      );
    };

    setupGlobalNotifications();

    // Cleanup listeners
    return () => {
      if (notificationListener) {
        notificationListener.remove();
      }
      if (responseListener) {
        responseListener.remove();
      }
    };
  }, [router]);

  // Show null while fonts are loading
  if (!loaded) {
    return null;
  }

  // Main app - no splash screen, load directly
  return (
    <CustomThemeProvider>
      <MetricProvider>
        <DialogProvider>
          <SubscriptionProvider>
            <TrackingProvider>
              <ThemeProvider
                value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
              >
                <ProtectedRoute splashActive={false}>
                  <Stack
                    screenOptions={{ headerShown: false, animation: "none" }}
                  >
                    <Stack.Screen
                      name="index"
                      options={{ headerShown: false }}
                    />
                    <Stack.Screen
                      name="(tabs)"
                      options={{ headerShown: false }}
                    />
                    <Stack.Screen
                      name="login"
                      options={{ headerShown: false }}
                    />
                    <Stack.Screen
                      name="register"
                      options={{ headerShown: false }}
                    />
                    <Stack.Screen
                      name="sessions"
                      options={{ headerShown: false }}
                    />
                    <Stack.Screen
                      name="statistics"
                      options={{ headerShown: false }}
                    />
                    <Stack.Screen
                      name="session-details"
                      options={{ headerShown: false }}
                    />
                    <Stack.Screen
                      name="subscription"
                      options={{ headerShown: false }}
                    />
                    <Stack.Screen
                      name="pro-features"
                      options={{ headerShown: false }}
                    />
                    <Stack.Screen
                      name="session-share"
                      options={{ headerShown: false }}
                    />
                    <Stack.Screen
                      name="user-profile"
                      options={{ headerShown: false }}
                    />
                    <Stack.Screen
                      name="user-horses"
                      options={{ headerShown: false }}
                    />
                    <Stack.Screen
                      name="session-summary"
                      options={{ headerShown: false }}
                    />
                    <Stack.Screen
                      name="emergency-notification"
                      options={{ headerShown: false }}
                    />
                    <Stack.Screen
                      name="add-planned-session"
                      options={{ headerShown: false }}
                    />
                    <Stack.Screen
                      name="calendar"
                      options={{ headerShown: false }}
                    />
                    <Stack.Screen
                      name="auth/callback"
                      options={{ headerShown: false }}
                    />
                  </Stack>
                </ProtectedRoute>
              </ThemeProvider>
            </TrackingProvider>
          </SubscriptionProvider>
        </DialogProvider>
      </MetricProvider>
    </CustomThemeProvider>
  );
};

export default function RootLayout() {
  return (
    <AppInitializer>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </AppInitializer>
  );
}
