import { useDialog } from "@/contexts/DialogContext";
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
                  
                  // Save Google OAuth user data to AsyncStorage for session persistence
                  if (result.user && result.user.provider === 'google') {
                    try {
                      const AsyncStorage = require('@react-native-async-storage/async-storage');
                      const userAuthData = {
                        id: result.user.id,
                        email: result.user.email,
                        created_at: new Date().toISOString(),
                      };
                      await AsyncStorage.setItem('google_oauth_user_data', JSON.stringify(userAuthData));
                      await AsyncStorage.setItem('google_oauth_user_id', result.user.id);
                      console.log("✅ Saved Google OAuth session to AsyncStorage");
                    } catch (storageError) {
                      console.error("Error saving OAuth session to AsyncStorage:", storageError);
                    }
                  }
                  
                  // Navigate to tabs - AuthContext will pick up the session
                  router.push("/(tabs)");
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
