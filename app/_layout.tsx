import {
    DarkTheme,
    DefaultTheme,
    ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import * as Notifications from 'expo-notifications';
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import "react-native-reanimated";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import CustomSplashScreen from "@/components/SplashScreen";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { DialogProvider } from "@/contexts/DialogContext";
import { SplashProvider, useSplash } from "@/contexts/SplashContext";
import { ThemeProvider as CustomThemeProvider } from "@/contexts/ThemeContext";
import { TrackingProvider } from "@/contexts/TrackingContext";
import { useColorScheme } from "@/hooks/useColorScheme";
import { handleNotificationResponse } from "@/lib/notificationService";
import { useRouter } from "expo-router";

// Hide Expo's default splash screen immediately
SplashScreen.hideAsync();

const SplashWithAuth = ({ onFinish }: { onFinish: () => void }) => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { setSplashActive } = useSplash();

  const handleForceContinue = () => {
    try {
      router.replace("/login");
    } catch (error) {
      console.error("Error during force continue navigation:", error);
    }
  };

  const handleSplashFinish = () => {
    // Remove the extra delay - splash will handle timing internally
    setSplashActive(false);
    onFinish();
  };

  return (
    <CustomSplashScreen 
      onFinish={handleSplashFinish}
      loading={loading}
      user={user}
      onForceContinue={handleForceContinue}
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
  const { setSplashActive } = useSplash();

  // Initialize splash as active
  useEffect(() => {
    setSplashActive(true);
  }, [setSplashActive]);

  // Set up global notification handlers when app starts
  useEffect(() => {
    let notificationListener: Notifications.Subscription;
    let responseListener: Notifications.Subscription;

    const setupGlobalNotifications = () => {
      // Listen for notifications received while app is running
      notificationListener = Notifications.addNotificationReceivedListener(notification => {
        console.log('Global notification received:', notification);
        // Additional global handling can be added here
      });

      // Listen for notification responses (when user taps on notification)
      responseListener = Notifications.addNotificationResponseReceivedListener(response => {
        console.log('Global notification response:', response);
        
        // Handle navigation based on notification type
        const data = response.notification.request.content.data as any;
        
        if (data?.type === 'friend_request') {
          // Navigate to community screen when friend request notification is tapped
          router.push('/(tabs)/community');
        }
        
        // Call the main handler
        handleNotificationResponse(response);
      });
    };

    setupGlobalNotifications();

    // Cleanup listeners
    return () => {
      if (notificationListener) {
        Notifications.removeNotificationSubscription(notificationListener);
      }
      if (responseListener) {
        Notifications.removeNotificationSubscription(responseListener);
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
    return (
      <AuthProvider>
        <SplashWithAuth onFinish={() => setShowSplash(false)} />
      </AuthProvider>
    );
  }

  // Main app with auth loading
  return (
    <AuthProvider>
      <CustomThemeProvider>
        <DialogProvider>
          <TrackingProvider>
            <ThemeProvider
              value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
            >
              <ProtectedRoute>
                <Stack>
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
                </Stack>
              </ProtectedRoute>
            </ThemeProvider>
          </TrackingProvider>
        </DialogProvider>
      </CustomThemeProvider>
    </AuthProvider>
  );
};

export default function RootLayout() {
  return (
    <SplashProvider>
      <AppContent />
    </SplashProvider>
  );
}
