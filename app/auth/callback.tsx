import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../../contexts/AuthContext";
import { getSupabase } from "../../lib/supabase";

/**
 * OAuth Callback Handler
 * This screen is shown when the browser redirects back after OAuth.
 * It waits for the AuthContext to process the SIGNED_IN event and set the user state.
 */
export default function AuthCallback() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [hasNavigated, setHasNavigated] = useState(false);
  const [waitTime, setWaitTime] = useState(0);
  const [foundSession, setFoundSession] = useState(false);

  // Periodically check for session updates
  useEffect(() => {
    const checkSession = async () => {
      if (hasNavigated || foundSession) return;

      console.log(`🔍 Checking session... (${waitTime.toFixed(1)}s)`);

      // First, check AsyncStorage for saved OAuth session
      try {
        const oauthSession = await AsyncStorage.getItem("oauth_session");
        const oauthUserId = await AsyncStorage.getItem("oauth_user_id");

        console.log(
          `📦 AsyncStorage - session: ${
            oauthSession ? "found" : "null"
          }, userId: ${oauthUserId ? "found" : "null"}`
        );

        if (oauthSession && oauthUserId) {
          console.log("✅ Found session in AsyncStorage!");
          const sessionData = JSON.parse(oauthSession);

          // Try to restore the session to Supabase
          const supabase = getSupabase();
          const { data: currentSession } = await supabase.auth.getSession();

          if (!currentSession.session && sessionData.access_token) {
            console.log("🔄 Restoring session to Supabase...");
            const { error } = await supabase.auth.setSession({
              access_token: sessionData.access_token,
              refresh_token: sessionData.refresh_token || "",
            });

            if (error) {
              console.log(`❌ Error restoring: ${error.message}`);
            } else {
              console.log("✅ Session restored!");
              setFoundSession(true);
            }
          } else if (currentSession.session) {
            console.log("✅ Session already in Supabase!");
            setFoundSession(true);
          }
        }
      } catch (error: any) {
        console.log(`⚠️ AsyncStorage check error: ${error.message}`);
      }

      // Also check Supabase directly
      const supabase = getSupabase();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        console.log("✅ Found Supabase session!");
        console.log("⏳ Waiting for AuthContext to set user...");
        setFoundSession(true);
        // Don't navigate yet - wait for the user state to be set by AuthContext
      }
    };

    // Check session every 500ms for the first 10 seconds
    if (waitTime < 10) {
      const timer = setTimeout(() => {
        setWaitTime((prev) => prev + 0.5);
        checkSession();
      }, 500);
      return () => clearTimeout(timer);
    }

    // After 10 seconds, check every 1 second up to 40 seconds (give more time)
    if (waitTime < 40) {
      const timer = setTimeout(() => {
        setWaitTime((prev) => prev + 1);
        checkSession();
      }, 1000);
      return () => clearTimeout(timer);
    }

    // After 40 seconds, give up and go back to login
    if (waitTime >= 40 && !user && !hasNavigated) {
      console.log("❌ Timeout - no user after 40s");
      console.log("🔄 Redirecting to login");
      setHasNavigated(true);
      router.replace("/login");
    }
  }, [waitTime, user, hasNavigated, foundSession]);

  // Navigate when user is authenticated
  useEffect(() => {
    if (hasNavigated) return;

    console.log(
      `🔄 Status [${waitTime.toFixed(
        1
      )}s] - User: ${!!user}, Loading: ${loading}`
    );

    // If user is authenticated, navigate to main app
    if (user && !loading) {
      console.log("✅ Authenticated! Navigating...");
      setHasNavigated(true);
      // Use a small delay to ensure everything is settled
      setTimeout(() => {
        router.replace("/(tabs)/map");
      }, 500);
    }
  }, [user, loading, hasNavigated, waitTime]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#335C67" />
      <Text style={styles.text}>
        Completing sign in... ({waitTime.toFixed(0)}s)
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 20,
  },
  text: {
    marginTop: 16,
    fontSize: 16,
    color: "#335C67",
    fontFamily: "Inder",
  },
});
