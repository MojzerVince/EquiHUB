import { useRouter, useSegments } from "expo-router";
import React, { useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  splashActive?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  splashActive = false,
}) => {
  const { user, loading, hasUserData } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const lastNavigationRef = useRef<string | null>(null);

  useEffect(() => {
    if (loading || hasUserData === null) {
      console.log(
        "ProtectedRoute: Waiting - loading=",
        loading,
        "hasUserData=",
        hasUserData
      );
      return;
    }

    const inAuthGroup =
      segments[0] === "login" ||
      segments[0] === "register" ||
      (segments[0] && segments[0].startsWith("register"));
    const onWelcome = !segments[0] || segments[0] === "index"; // Root level (/) or /index is the welcome screen
    const inTabsGroup = segments[0] === "(tabs)";
    
    // Check if we're on a valid standalone screen (not in auth, tabs, or welcome)
    const validStandaloneScreens = [
      "sessions",
      "statistics", 
      "session-details",
      "session-summary",
      "subscription",
      "pro-features",
      "session-share",
      "user-profile",
      "user-horses",
      "emergency-notification",
      "add-planned-session",
      "calendar"
    ];
    const onStandaloneScreen = validStandaloneScreens.includes(segments[0] || "");

    console.log(
      "ProtectedRoute: user=",
      !!user,
      "segments=",
      segments,
      "inAuthGroup=",
      inAuthGroup,
      "inTabsGroup=",
      inTabsGroup,
      "onWelcome=",
      onWelcome,
      "onStandaloneScreen=",
      onStandaloneScreen,
      "hasUserData=",
      hasUserData,
      "loading=",
      loading
    );

    // Helper function to navigate only if we haven't already navigated to this path
    const navigateIfNeeded = (path: string, reason: string) => {
      if (lastNavigationRef.current !== path) {
        console.log(`ProtectedRoute: ${reason}`);
        lastNavigationRef.current = path;
        // Use setTimeout to avoid state updates during render
        setTimeout(() => router.replace(path as any), 0);
      }
    };

    // NEW LOGIC: If user is authenticated, redirect to tabs (skip welcome)
    if (user && (inAuthGroup || onWelcome)) {
      navigateIfNeeded("/(tabs)/map", "User authenticated - redirecting to tabs/map");
      return;
    }

    // If user is authenticated and in tabs or standalone screen, allow it
    if (user && (inTabsGroup || onStandaloneScreen)) {
      console.log(
        "ProtectedRoute: User authenticated and on valid screen - allowing access"
      );
      lastNavigationRef.current = null; // Reset navigation tracking
      return;
    }

    // If user is NOT authenticated but in protected areas, redirect to welcome
    if (!user && (inTabsGroup || onStandaloneScreen)) {
      navigateIfNeeded(
        "/index",
        "Not authenticated in protected area - redirecting to welcome"
      );
      return;
    }

    // If not authenticated and not in auth/welcome, redirect to welcome
    if (!user && !inAuthGroup && !onWelcome) {
      navigateIfNeeded("/index", "Redirecting to welcome screen");
    } else {
      console.log("ProtectedRoute: No action taken - staying on current route");
      lastNavigationRef.current = null; // Reset navigation tracking
    }
  }, [user, loading, segments, hasUserData, router]);

  // Don't show anything while splash is active OR while checking stored data
  if (splashActive || hasUserData === null) {
    return null;
  }

  return <>{children}</>;
};
