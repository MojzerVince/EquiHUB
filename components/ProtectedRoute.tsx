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

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();
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

  // Show force continue button after 6 seconds of loading
  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => {
        setShowForceButton(true);
      }, 6000); // Show button after 6 seconds

      return () => clearTimeout(timer);
    } else {
      setShowForceButton(false);
    }
  }, [loading]);

  const handleForceContinue = () => {
    console.log("🔄 User forced continue from loading screen");
    // Force navigation to login if loading is stuck
    router.replace("/login");
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.loadingText}>Loading EquiHub...</Text>
        {showForceButton && (
          <TouchableOpacity
            style={styles.forceButton}
            onPress={handleForceContinue}
          >
            <Text style={styles.forceButtonText}>Continue Anyway</Text>
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
