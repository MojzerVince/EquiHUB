/**
 * App Initialization with Secure Configuration
 * Initialize secure config silently in the background without UI
 */

import Constants from "expo-constants";
import React, { useEffect } from "react";
import { configureGoogleSignIn } from "../lib/googleAuth";
import { initializeSupabase } from "../lib/supabase";

interface AppInitializerProps {
  children: React.ReactNode;
}

export const AppInitializer: React.FC<AppInitializerProps> = ({ children }) => {
  const [initialized, setInitialized] = React.useState(false);

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
      console.log("- App Version:", appVersion);
      console.log("- Bundle ID:", bundleId);

      // Initialize Supabase directly
      console.log("�� Initializing Supabase...");
      await initializeSupabase();
      console.log("✅ Supabase initialized");

      // Initialize Google Sign In (optional - don't fail if not available)
      console.log("🔄 Configuring Google Sign In...");
      try {
        const googleConfigured = await configureGoogleSignIn();
        if (googleConfigured) {
          console.log("✅ Google Sign In configured");
        } else {
          console.log("ℹ️ Google Sign In will use web OAuth fallback");
        }
      } catch (error) {
        console.log("⚠️ Google Sign In configuration failed, will use web fallback:", error);
      }

      console.log("✅ App initialization complete");
      setInitialized(true);
    } catch (error) {
      console.error("❌ App initialization failed:", error);
      // Continue anyway - the app should still work with fallback config
      console.log("⚠️ Continuing with fallback configuration");
      setInitialized(true);
    }
  };

  // Wait for Supabase to initialize before rendering children
  // This prevents "Supabase not initialized" errors
  if (!initialized) {
    return null;
  }

  return <>{children}</>;
};

export default AppInitializer;
