import {
    DarkTheme,
    DefaultTheme,
    ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import React, { useEffect, useState } from "react";
import "react-native-reanimated";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import SplashScreen from "@/components/SplashScreen";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { DialogProvider } from "@/contexts/DialogContext";
import { SplashProvider, useSplash } from "@/contexts/SplashContext";
import { ThemeProvider as CustomThemeProvider } from "@/contexts/ThemeContext";
import { TrackingProvider } from "@/contexts/TrackingContext";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useRouter } from "expo-router";

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
    <SplashScreen 
      onFinish={handleSplashFinish}
      loading={loading}
      user={user}
      onForceContinue={handleForceContinue}
    />
  );
};

const AppContent = () => {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    Inder: require("../assets/fonts/Inder-Regular.ttf"),
  });
  const [showSplash, setShowSplash] = useState(true);
  const { setSplashActive } = useSplash();

  // Initialize splash as active
  useEffect(() => {
    setSplashActive(true);
  }, [setSplashActive]);

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
