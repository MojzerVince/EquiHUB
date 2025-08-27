import { useRouter, useSegments } from "expo-router";
import React, { useEffect } from "react";
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

    // If user is authenticated and trying to access protected content, allow it
    if (user && inTabsGroup) {
      console.log(
        "ProtectedRoute: User authenticated and in tabs - allowing access"
      );
      return;
    }

    if (!user && !inAuthGroup && !onWelcome && !inTabsGroup) {
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
      console.log(
        "ProtectedRoute: Redirecting to login (returning user on welcome)"
      );
      router.replace("/login");
    } else {
      console.log("ProtectedRoute: No action taken - staying on current route");
    }
  }, [user, loading, segments, hasUserData]);

  // Don't show anything while splash is active OR while checking stored data
  if (splashActive || hasUserData === null) {
    return null;
  }

  return <>{children}</>;
};
