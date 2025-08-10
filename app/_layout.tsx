import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import "react-native-reanimated";

import { ProtectedRoute } from "@/components/ProtectedRoute";
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

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
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
                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                  <Stack.Screen name="login" options={{ headerShown: false }} />
                  <Stack.Screen
                    name="register"
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
