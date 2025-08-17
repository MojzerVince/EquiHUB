import { useRouter, useSegments } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
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
  const [showForceButton, setShowForceButton] = useState(false);

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

  // Show force continue button after 3 seconds of loading (reduced for testing)
  useEffect(() => {
    if (loading) {
      console.log("⏱️ Starting force button timer (3 seconds)");
      const timer = setTimeout(() => {
        console.log("⏱️ Force button timer fired - showing button");
        setShowForceButton(true);
      }, 3000); // Show button after 3 seconds for testing

      return () => {
        console.log("⏱️ Clearing force button timer");
        clearTimeout(timer);
      };
    } else {
      console.log("⏱️ Not loading - hiding force button");
      setShowForceButton(false);
    }
  }, [loading]);

  const handleForceContinue = () => {
    console.log("🔄 User forced continue from loading screen");
    console.log("Current segments:", segments);
    console.log("User state:", !!user);
    console.log("Loading state:", loading);
    
    // Force navigation to login if loading is stuck
    try {
      setShowForceButton(false); // Hide button immediately
      router.replace("/login");
      console.log("Navigation to /login initiated");
    } catch (error) {
      console.error("Error during force continue navigation:", error);
    }
  };

  // Don't show loading screens while splash is active
  if (splashActive) {
    return null;
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.loadingText}>Loading EquiHub...</Text>
        
        {/* Test button - always visible for debugging */}
        <TouchableOpacity
          style={[styles.forceButton, { backgroundColor: 'red', marginTop: 10 }]}
          onPress={() => {
            console.log("🔴 TEST BUTTON PRESSED!");
            alert("Test button works!");
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.forceButtonText}>TEST BUTTON</Text>
        </TouchableOpacity>
        
        {showForceButton && (
          <TouchableOpacity
            style={styles.forceButton}
            onPress={handleForceContinue}
            activeOpacity={0.7}
          >
            <Text style={styles.forceButtonText}>Continue Anyway ({showForceButton ? 'visible' : 'hidden'})</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return <>{children}</>;
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#335C67",
  },
  loadingText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontFamily: "Inder",
    marginTop: 20,
    textAlign: "center",
  },
  forceButton: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 30,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  forceButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Inder",
    textAlign: "center",
    fontWeight: "600",
  },
});
