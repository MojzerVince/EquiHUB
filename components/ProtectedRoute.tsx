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

    const inAuthGroup = segments[0] === "login" || segments[0] === "register";
    const onWelcome = !segments[0]; // Root level (welcome page)
    const inTabsGroup = segments[0] === "(tabs)";

    console.log(
      "ProtectedRoute: user=",
      !!user,
      "segments=",
      segments,
      "inAuthGroup=",
      inAuthGroup,
      "inTabsGroup=",
      inTabsGroup,
      "hasUserData=",
      hasUserData,
      "loading=",
      loading
    );

    // Show welcome screen only if no user AND no stored user data
    const shouldShowWelcome = !user && !hasUserData;

    // Helper function to navigate only if we haven't already navigated to this path
    const navigateIfNeeded = (path: string, reason: string) => {
      if (lastNavigationRef.current !== path) {
        console.log(`ProtectedRoute: ${reason}`);
        lastNavigationRef.current = path;
        // Use setTimeout to avoid state updates during render
        setTimeout(() => router.replace(path as any), 0);
      }
    };

    // If user is authenticated and trying to access protected content, allow it
    if (user && inTabsGroup) {
      console.log(
        "ProtectedRoute: User authenticated and in tabs - allowing access"
      );
      lastNavigationRef.current = null; // Reset navigation tracking
      return;
    }

    // If user is NOT authenticated but still in tabs group, redirect to appropriate auth page
    if (!user && inTabsGroup) {
      if (shouldShowWelcome) {
        navigateIfNeeded("/", "Not authenticated in tabs - redirecting to welcome");
      } else {
        navigateIfNeeded("/login", "Not authenticated in tabs - redirecting to login");
      }
      return;
    }

    if (!user && !inAuthGroup && !onWelcome && !inTabsGroup) {
      // User is not authenticated and not in auth group or welcome
      if (shouldShowWelcome) {
        // First time user - redirect to welcome
        navigateIfNeeded("/", "Redirecting to welcome (first time user)");
      } else {
        // Returning user - redirect to login
        navigateIfNeeded("/login", "Redirecting to login (returning user)");
      }
    } else if (user && (inAuthGroup || onWelcome)) {
      // User is authenticated and in auth group or welcome, redirect to main app
      navigateIfNeeded("/(tabs)", "Redirecting to tabs");
    } else if (!user && onWelcome && !shouldShowWelcome) {
      // User is on welcome but has stored data - redirect to login
      navigateIfNeeded("/login", "Redirecting to login (returning user on welcome)");
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
