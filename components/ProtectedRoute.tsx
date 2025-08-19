import { useRouter, useSegments } from "expo-router";
import React, { useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useSplash } from "../contexts/SplashContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading, hasUserData } = useAuth();
  const { splashActive } = useSplash();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading || hasUserData === null) return;

    const inAuthGroup = segments[0] === "login" || segments[0] === "register";
    const onWelcome = !segments[0]; // Root level (welcome page)

    console.log(
      "ProtectedRoute: user=",
      !!user,
      "segments=",
      segments,
      "inAuthGroup=",
      inAuthGroup,
      "hasUserData=",
      hasUserData
    );

    // Show welcome screen only if no user AND no stored user data
    const shouldShowWelcome = !user && !hasUserData;

    if (!user && !inAuthGroup && !onWelcome) {
      // User is not authenticated and not in auth group or welcome
      if (shouldShowWelcome) {
        // First time user - redirect to welcome
        console.log("ProtectedRoute: Redirecting to welcome (first time user)");
        router.replace("/");
      } else {
        // Returning user - redirect to login
        console.log("ProtectedRoute: Redirecting to login (returning user)");
        router.replace("/login");
      }
    } else if (user && (inAuthGroup || onWelcome)) {
      // User is authenticated and in auth group or welcome, redirect to main app
      console.log("ProtectedRoute: Redirecting to tabs");
      router.replace("/(tabs)");
    } else if (!user && onWelcome && !shouldShowWelcome) {
      // User is on welcome but has stored data - redirect to login
      console.log("ProtectedRoute: Redirecting to login (returning user on welcome)");
      router.replace("/login");
    }
  }, [user, loading, segments, hasUserData]);

  // Don't show anything while splash is active OR while checking stored data
  if (splashActive || hasUserData === null) {
    return null;
  }

  return <>{children}</>;
};
