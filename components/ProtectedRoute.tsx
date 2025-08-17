import { useRouter, useSegments } from "expo-router";
import React, { useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useSplash } from "../contexts/SplashContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();
  const { splashActive } = useSplash();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === "login" || segments[0] === "register";
    const onWelcome = !segments[0]; // Root level (welcome page)

    console.log(
      "ProtectedRoute: user=",
      !!user,
      "segments=",
      segments,
      "inAuthGroup=",
      inAuthGroup
    );

    if (!user && !inAuthGroup && !onWelcome) {
      // User is not authenticated and not in auth group or welcome, redirect to login
      console.log("ProtectedRoute: Redirecting to login");
      router.replace("/login");
    } else if (user && (inAuthGroup || onWelcome)) {
      // User is authenticated and in auth group or welcome, redirect to main app
      console.log("ProtectedRoute: Redirecting to tabs");
      router.replace("/(tabs)");
    }
  }, [user, loading, segments]);

  // Don't show anything while splash is active
  if (splashActive) {
    return null;
  }

  return <>{children}</>;
};
