/**
 * App Initialization with Secure Configuration
 * Initialize secure config before any components load
 */

import Constants from "expo-constants";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { configureGoogleSignIn } from "../lib/googleAuth";
import { initializeSupabase } from "../lib/supabase";

interface AppInitializerProps {
  children: React.ReactNode;
}

export const AppInitializer: React.FC<AppInitializerProps> = ({ children }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      console.log("🔧 Initializing secure configuration...");

      // Get values from environment variables or expo constants
      const serverUrl =
        process.env.EXPO_PUBLIC_API_SERVER_URL ||
        Constants.expoConfig?.extra?.expoPublicApiServerUrl;
      const apiSecret =
        process.env.EXPO_PUBLIC_API_SECRET ||
        Constants.expoConfig?.extra?.expoPublicApiSecret;
      const appVersion =
        process.env.EXPO_PUBLIC_APP_VERSION ||
        Constants.expoConfig?.extra?.expoPublicAppVersion ||
        Constants.expoConfig?.version;
      const bundleId =
        process.env.EXPO_PUBLIC_BUNDLE_ID ||
        Constants.expoConfig?.extra?.expoPublicBundleId ||
        Constants.expoConfig?.android?.package;

      // Log environment variables for debugging
      console.log("🔍 Environment check:");
      console.log("- Server URL:", serverUrl);
      console.log(
        "- API Secret:",
        apiSecret ? "***" + apiSecret.slice(-4) : "MISSING"
      );
      console.log("- App Version:", appVersion);
      console.log("- Bundle ID:", bundleId);

      // For now, let's initialize Supabase directly since the secure config
      // server setup is optional for this app
      console.log("🔄 Initializing Supabase...");
      await initializeSupabase();
      console.log("✅ Supabase initialized");

      // Initialize Google Sign In
      console.log("🔄 Configuring Google Sign In...");
      await configureGoogleSignIn();
      console.log("✅ Google Sign In configured");

      setIsInitialized(true);
      setInitError(null);
    } catch (error) {
      console.error("❌ App initialization failed:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      setInitError(errorMessage);

      // Auto-retry up to 3 times for network-related errors
      if (
        retryCount < 3 &&
        (errorMessage.includes("network") ||
          errorMessage.includes("fetch") ||
          errorMessage.includes("server"))
      ) {
        console.log(
          `🔄 Auto-retrying initialization (attempt ${retryCount + 1}/3)...`
        );
        setRetryCount((prev) => prev + 1);
        setTimeout(() => {
          initializeApp();
        }, 2000 * (retryCount + 1)); // Increasing delay: 2s, 4s, 6s
      }
    }
  };

  const handleManualRetry = () => {
    setIsRetrying(true);
    setInitError(null);
    setRetryCount(0);
    setTimeout(() => {
      setIsRetrying(false);
      initializeApp();
    }, 1000);
  };

  if (initError) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorTitle}>Configuration Error</Text>
        <Text style={styles.errorText}>{initError}</Text>
        <Text style={styles.errorHelp}>Debug Info:</Text>
        <Text style={styles.debugText}>
          • Server:{" "}
          {process.env.EXPO_PUBLIC_API_SERVER_URL ||
            Constants.expoConfig?.extra?.expoPublicApiServerUrl ||
            "NOT SET"}
          {"\n"}• Bundle:{" "}
          {process.env.EXPO_PUBLIC_BUNDLE_ID ||
            Constants.expoConfig?.extra?.expoPublicBundleId ||
            Constants.expoConfig?.android?.package ||
            "NOT SET"}
          {"\n"}• Version:{" "}
          {process.env.EXPO_PUBLIC_APP_VERSION ||
            Constants.expoConfig?.extra?.expoPublicAppVersion ||
            Constants.expoConfig?.version ||
            "NOT SET"}
          {"\n"}• Retries: {retryCount}/3
        </Text>
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={handleManualRetry}
            disabled={isRetrying}
          >
            <Text style={styles.retryButtonText}>
              {isRetrying ? "Retrying..." : "Retry Connection"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!isInitialized) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>
          Initializing secure configuration...
        </Text>
      </View>
    );
  }

  return <>{children}</>;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FF3B30",
    marginBottom: 12,
    textAlign: "center",
  },
  errorText: {
    fontSize: 16,
    color: "#FF3B30",
    marginBottom: 12,
    textAlign: "center",
  },
  errorHelp: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    fontStyle: "italic",
    marginBottom: 8,
  },
  debugText: {
    fontSize: 12,
    color: "#888",
    textAlign: "left",
    backgroundColor: "#f5f5f5",
    padding: 10,
    borderRadius: 5,
    marginBottom: 16,
    fontFamily: "monospace",
  },
  buttonContainer: {
    marginTop: 10,
  },
  retryButton: {
    padding: 12,
    backgroundColor: "#007AFF",
    borderRadius: 8,
    alignItems: "center",
  },
  retryButtonText: {
    fontSize: 16,
    color: "#ffffff",
    fontWeight: "bold",
  },
});

export default AppInitializer;
