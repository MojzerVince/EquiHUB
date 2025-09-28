import { useDialog } from "@/contexts/DialogContext";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useGoogleRegistration } from "../lib/useGoogleRegistration";

const RegisterScreen = () => {
  const router = useRouter();
  const { showError } = useDialog();
  const { getGoogleUserInfo, loading: googleLoading } = useGoogleRegistration();

  const handleGoogleRegister = async () => {
    try {
      // Step 1: Get Google user info (doesn't create Supabase account yet)
      const result = await getGoogleUserInfo();

      if (result.success && result.userInfo) {
        // Store Google user info and navigate to registration form
        // We'll pass the Google user info via navigation params
        router.push({
          pathname: "/register-complex-backup",
          params: {
            googleUser: JSON.stringify(result.userInfo),
          },
        });
      } else {
        showError(result.error || "Google authentication failed");
      }
    } catch (error) {
      console.error("Google auth error:", error);
      showError("Failed to authenticate with Google");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoid}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>
              Join EquiHUB and connect with the equestrian community
            </Text>

            {/* Custom Google Sign Up Button */}
            <View style={styles.oauthContainer}>
              <TouchableOpacity
                style={[
                  styles.googleButton,
                  googleLoading && styles.disabledButton,
                ]}
                onPress={handleGoogleRegister}
                disabled={googleLoading}
                activeOpacity={0.8}
              >
                {googleLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Text style={styles.googleButtonIcon}>🔍</Text>
                    <Text style={styles.googleButtonText}>
                      Get Started with Google
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.loginPrompt}>
              <Text style={styles.loginPromptText}>
                Already have an account?
              </Text>
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.replace("/login");
                }}
                style={styles.loginLink}
              >
                <Text style={styles.loginLinkText}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    maxWidth: 400,
    alignSelf: "center",
    width: "100%",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#2c3e50",
    textAlign: "center",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: "#7f8c8d",
    textAlign: "center",
    marginBottom: 40,
    lineHeight: 22,
  },
  oauthContainer: {
    marginBottom: 30,
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4285F4",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  disabledButton: {
    backgroundColor: "#999",
  },
  googleButtonIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  googleButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  loginPrompt: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
  },
  loginPromptText: {
    fontSize: 16,
    color: "#7f8c8d",
  },
  loginLink: {
    marginLeft: 5,
  },
  loginLinkText: {
    fontSize: 16,
    color: "#3498db",
    fontWeight: "600",
  },
});

export default RegisterScreen;
