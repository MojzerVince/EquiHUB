import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import * as Notifications from "expo-notifications";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import "react-native-reanimated";

import AppInitializer from "@/components/AppInitializer";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import CustomSplashScreen from "@/components/SplashScreen";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { DialogProvider } from "@/contexts/DialogContext";
import { MetricProvider } from "@/contexts/MetricContext";
import { ThemeProvider as CustomThemeProvider } from "@/contexts/ThemeContext";
import { TrackingProvider } from "@/contexts/TrackingContext";
import { useColorScheme } from "@/hooks/useColorScheme";
import { handleNotificationResponse } from "@/lib/notificationService";
import { useRouter } from "expo-router";

// Hide Expo's default splash screen immediately
SplashScreen.hideAsync();

const SplashWithAuth = ({ onFinish }: { onFinish: () => void }) => {
  const { user, loading } = useAuth();

  const handleSplashFinish = () => {
    // Call onFinish to hide splash screen
    onFinish();
  };

  return (
    <CustomSplashScreen
      onFinish={handleSplashFinish}
      loading={loading}
      user={user}
    />
  );
};

const AppContent = () => {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [loaded] = useFonts({
    Inder: require("../assets/fonts/Inder-Regular.ttf"),
  });
  const [showSplash, setShowSplash] = useState(true);

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
        (response) => {
          // Handle navigation based on notification type
          const data = response.notification.request.content.data as any;

          if (data?.type === "friend_request") {
            // Navigate to community screen when friend request notification is tapped
            router.push("/(tabs)/community");
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

  // Show splash screen while fonts are loading or splash is active
  if (!loaded || showSplash) {
    if (!loaded) {
      // Still loading fonts, don't show splash yet
      return null;
    }

    // Fonts are loaded, show splash screen immediately with auth integration
    return <SplashWithAuth onFinish={() => setShowSplash(false)} />;
  }

  // Main app with auth loading
  return (
    <CustomThemeProvider>
      <MetricProvider>
        <DialogProvider>
          <TrackingProvider>
            <ThemeProvider
              value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
            >
              <ProtectedRoute splashActive={false}>
                <Stack
                  screenOptions={{ headerShown: false, animation: "none" }}
                >
                  <Stack.Screen name="index" options={{ headerShown: false }} />
                  <Stack.Screen
                    name="(tabs)"
                    options={{ headerShown: false }}
                  />
                  <Stack.Screen name="login" options={{ headerShown: false }} />
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
                    name="session-summary"
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
                    name="user-friends"
                    options={{ headerShown: false }}
                  />
                  <Stack.Screen
                    name="user-horses"
                    options={{ headerShown: false }}
                  />
                </Stack>
              </ProtectedRoute>
            </ThemeProvider>
          </TrackingProvider>
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
