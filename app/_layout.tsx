import {
    DarkTheme,
    DefaultTheme,
    ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import React, { useState } from "react";
import "react-native-reanimated";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import SplashScreen from "@/components/SplashScreen";
import { AuthProvider } from "@/contexts/AuthContext";
import { DialogProvider } from "@/contexts/DialogContext";
import { ThemeProvider as CustomThemeProvider } from "@/contexts/ThemeContext";
import { TrackingProvider } from "@/contexts/TrackingContext";
import { useColorScheme } from "@/hooks/useColorScheme";

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    Inder: require("../assets/fonts/Inder-Regular.ttf"),
  });
  const [showSplash, setShowSplash] = useState(true);

  // Show splash screen while fonts are loading or during initial app load
  if (!loaded || showSplash) {
    if (!loaded) {
      // Still loading fonts, don't show splash yet
      return null;
    }
    
    // Fonts are loaded, show splash screen
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

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
                </Stack>
              </ProtectedRoute>
            </ThemeProvider>
          </TrackingProvider>
        </DialogProvider>
      </CustomThemeProvider>
    </AuthProvider>
  );
}
