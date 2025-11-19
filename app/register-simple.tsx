import { useDialog } from "@/contexts/DialogContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import OAuthButtons from "../components/OAuthButtons";
import { ProfileAPIBase64 } from "../lib/profileAPIBase64";

const RegisterScreen = () => {
  const router = useRouter();
  const { showError } = useDialog();

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

            {/* OAuth Sign Up Buttons */}
            <View style={styles.oauthContainer}>
              <OAuthButtons
                onSuccess={async (result) => {
                  console.log("OAuth registration successful:", result);
                  console.log(
                    "OAuth result structure:",
                    JSON.stringify(result, null, 2)
                  );

                  // Check if user has a profile in the database
                  if (result.user && result.user.id) {
                    try {
                      console.log(
                        "🔍 Checking if user has an existing profile..."
                      );
                      const profile = await ProfileAPIBase64.getProfile(
                        result.user.id
                      );

                      if (profile) {
                        console.log(
                          "✅ User has existing profile - logging in"
                        );

                        // Existing user - save session and navigate to app
                        const userAuthData = {
                          id: result.user.id,
                          email: result.user.email,
                          created_at: new Date().toISOString(),
                        };

                        await AsyncStorage.setItem(
                          "oauth_user_data",
                          JSON.stringify(userAuthData)
                        );
                        await AsyncStorage.setItem(
                          "oauth_user_id",
                          result.user.id
                        );
                        await AsyncStorage.setItem(
                          "oauth_provider",
                          result.user.provider
                        );

                        if (result.session) {
                          await AsyncStorage.setItem(
                            "oauth_session",
                            JSON.stringify({
                              access_token: result.session.access_token,
                              refresh_token: result.session.refresh_token,
                              expires_at: result.session.expires_at,
                              user: userAuthData,
                            })
                          );
                        }

                        console.log(
                          "✅ Saved OAuth session - navigating to app"
                        );
                        router.replace("/(tabs)");
                      } else {
                        console.log(
                          "⚠️ New user - no profile found, redirecting to registration form"
                        );

                        // New user - redirect to complex registration form with user data
                        router.replace({
                          pathname: "/register-complex-backup",
                          params: {
                            googleUser: JSON.stringify({
                              id: result.user.id,
                              email: result.user.email,
                              name: result.user.name,
                              avatar_url: result.user.avatar_url,
                              provider: result.user.provider,
                            }),
                          },
                        });
                      }
                    } catch (error) {
                      console.error("❌ Error checking user profile:", error);
                      showError(
                        "Failed to verify account status. Please try again."
                      );
                    }
                  } else {
                    console.error("❌ No user data in OAuth result");
                    showError("Authentication failed. Please try again.");
                  }
                }}
                onError={(error) => {
                  showError(error);
                }}
                isSignUp={true}
              />
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
