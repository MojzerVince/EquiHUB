import { useDialog } from "@/contexts/DialogContext";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AuthAPI, LoginData } from "../lib/authAPI";

import OAuthButtons from "../components/OAuthButtons";

const LoginScreen = () => {
  const router = useRouter();
  const { showError, showConfirm } = useDialog();

  // Form state
  const [formData, setFormData] = useState<LoginData>({
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form validation
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    // Email validation
    if (!formData.email) {
      newErrors.email = "Email is required";
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = "Password is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      const { user, error } = await AuthAPI.login(formData);

      if (error) {
        showError(error);
        return;
      }

      if (user) {
        // Don't navigate immediately - let the AuthContext handle navigation
        // The ProtectedRoute will automatically redirect to tabs when user state updates
        console.log("Login successful, waiting for auth state to update...");
      }
    } catch (error) {
      console.error("Login error:", error);
      showError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!formData.email) {
      showError("Please enter your email address to reset your password.");
      return;
    }

    setLoading(true);

    try {
      const { error } = await AuthAPI.resetPassword(formData.email);

      if (error) {
        showError(error);
      } else {
        showConfirm(
          "Password Reset Email Sent",
          "Please check your email for instructions to reset your password.",
          () => {
            // User acknowledged the message
          }
        );
      }
    } catch (error) {
      console.error("Password reset error:", error);
      showError("Failed to send password reset email. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof LoginData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: "",
      }));
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
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to your EquiHUB account</Text>

            {/* Form Inputs */}
            <View style={styles.formContainer}>
              {/* Email Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email Address</Text>
                <TextInput
                  style={[
                    styles.textInput,
                    errors.email ? styles.inputError : null,
                  ]}
                  value={formData.email}
                  onChangeText={(text) =>
                    handleInputChange("email", text.toLowerCase().trim())
                  }
                  placeholder="Enter your email address"
                  placeholderTextColor="#999"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                />
                {errors.email ? (
                  <Text style={styles.errorText}>{errors.email}</Text>
                ) : null}
              </View>

              {/* Password Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Password</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={[
                      styles.passwordInput,
                      errors.password ? styles.inputError : null,
                    ]}
                    value={formData.password}
                    onChangeText={(text) => handleInputChange("password", text)}
                    placeholder="Enter your password"
                    placeholderTextColor="#999"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="current-password"
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Text style={styles.eyeIcon}>
                      {showPassword ? "🙈" : "👁️"}
                    </Text>
                  </TouchableOpacity>
                </View>
                {errors.password ? (
                  <Text style={styles.errorText}>{errors.password}</Text>
                ) : null}
              </View>

              {/* Forgot Password Link */}
              <TouchableOpacity
                style={styles.forgotPasswordContainer}
                onPress={handleForgotPassword}
                disabled={loading}
              >
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </TouchableOpacity>

              {/* Login Button */}
              <TouchableOpacity
                style={[
                  styles.loginButton,
                  loading ? styles.disabledButton : null,
                ]}
                onPress={handleLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.loginButtonText}>Sign In</Text>
                )}
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.dividerContainer}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* OAuth Sign In Buttons */}
              <OAuthButtons
                onSuccess={async (result) => {
                  console.log("OAuth login successful:", result);
                  
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
              />

              <TouchableOpacity
                style={styles.registerLinkContainer}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.replace("/register");
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.registerLinkText}>
                  Don't have an account?{" "}
                </Text>
                <Text style={styles.registerLink}>Create Account</Text>
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
  formContainer: {
    marginBottom: 30,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2c3e50",
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: "#fff",
    color: "#2c3e50",
    minHeight: 56,
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    backgroundColor: "#fff",
  },
  passwordInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    color: "#2c3e50",
    minHeight: 56,
  },
  eyeButton: {
    padding: 16,
  },
  eyeIcon: {
    fontSize: 20,
  },
  inputError: {
    borderColor: "#e74c3c",
    backgroundColor: "#fdf2f2",
  },
  errorText: {
    color: "#e74c3c",
    fontSize: 14,
    marginTop: 5,
  },
  forgotPasswordContainer: {
    alignItems: "flex-end",
    marginBottom: 20,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: "#3498db",
    fontWeight: "600",
  },
  loginButton: {
    backgroundColor: "#3498db",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  disabledButton: {
    backgroundColor: "#999",
  },
  loginButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#ddd",
  },
  dividerText: {
    marginHorizontal: 15,
    fontSize: 16,
    color: "#7f8c8d",
  },
  registerLinkContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
  },
  registerLinkText: {
    fontSize: 16,
    color: "#7f8c8d",
  },
  registerLink: {
    fontSize: 16,
    color: "#3498db",
    fontWeight: "600",
  },
});

export default LoginScreen;
