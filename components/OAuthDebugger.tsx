import React, { useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { getSupabase } from "../lib/supabase";

export const OAuthDebugger: React.FC = () => {
  const { currentTheme } = useTheme();
  const theme = currentTheme;
  const [debugInfo, setDebugInfo] = useState<any>(null);

  const checkSupabaseOAuth = async () => {
    try {
      const supabase = getSupabase();

      // Try to get the current session
      const { data: session, error: sessionError } =
        await supabase.auth.getSession();
      console.log("Session check:", { session, sessionError });

      // Try to call the OAuth endpoint to see what happens
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: "equihub://auth/callback",
        },
      });

      setDebugInfo({
        success: !error,
        error: error?.message || null,
        data: data,
        sessionError: sessionError?.message || null,
        supabaseUrl: "https://grdsqxwghajehneksxik.supabase.co",
      });

      Alert.alert(
        "OAuth Debug Info",
        JSON.stringify(
          {
            success: !error,
            error: error?.message || "No error",
            hasUrl: !!data?.url,
          },
          null,
          2
        )
      );
    } catch (error: any) {
      console.error("Debug error:", error);
      setDebugInfo({
        success: false,
        error: error.message,
        crashError: true,
      });

      Alert.alert("Debug Error", error.message);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <Text style={[styles.title, { color: theme.colors.text }]}>
        OAuth Debug Panel
      </Text>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: theme.colors.primary }]}
        onPress={checkSupabaseOAuth}
      >
        <Text style={styles.buttonText}>Test Google OAuth Setup</Text>
      </TouchableOpacity>

      {debugInfo && (
        <View
          style={[
            styles.debugInfo,
            { backgroundColor: theme.colors.background },
          ]}
        >
          <Text style={[styles.debugText, { color: theme.colors.text }]}>
            {JSON.stringify(debugInfo, null, 2)}
          </Text>
        </View>
      )}

      <View style={styles.instructions}>
        <Text
          style={[
            styles.instructionText,
            { color: theme.colors.textSecondary },
          ]}
        >
          1. Make sure Google provider is enabled in Supabase
        </Text>
        <Text
          style={[
            styles.instructionText,
            { color: theme.colors.textSecondary },
          ]}
        >
          2. Check that redirect URL is configured correctly
        </Text>
        <Text
          style={[
            styles.instructionText,
            { color: theme.colors.textSecondary },
          ]}
        >
          3. Verify Google Cloud Console OAuth setup
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    margin: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
  },
  button: {
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 15,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  debugInfo: {
    padding: 10,
    borderRadius: 5,
    marginBottom: 15,
  },
  debugText: {
    fontSize: 12,
    fontFamily: "monospace",
  },
  instructions: {
    marginTop: 10,
  },
  instructionText: {
    fontSize: 14,
    marginBottom: 5,
  },
});
