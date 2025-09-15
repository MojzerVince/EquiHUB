import { OAuthButtonGroup } from "@/components/OAuthButtons";
import { useDialog } from "@/contexts/DialogContext";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
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

  const handleOAuthSuccess = (user: any) => {
    console.log("OAuth login successful:", user);
    // The AuthContext will handle navigation automatically
  };

  const handleOAuthError = (error: string) => {
    showError(error);
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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.headerContainer}>
            <Image
              source={require("../assets/icons/512x512.png")}
              style={styles.logo}
              contentFit="contain"
            />
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to your EquiHUB account</Text>
          </View>

          {/* Form */}
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

            {/* Session Persistence Info */}
            <View style={styles.persistenceInfoContainer}>
              <Text style={styles.persistenceInfoIcon}>🔒</Text>
              <Text style={styles.persistenceInfoText}>
                You'll stay signed in until you log out
              </Text>
            </View>
          </View>

          {/* OAuth Buttons */}
          <View style={styles.oauthContainer}>
            <OAuthButtonGroup
              mode="login"
              onSuccess={handleOAuthSuccess}
              onError={handleOAuthError}
              disabled={loading}
              showDivider={false}
            />
          </View>

          {/* Traditional Login */}
          <View style={styles.buttonContainer}>
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
                <Text style={styles.loginButtonText}>Sign In with Email</Text>
              )}
            </TouchableOpacity>

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
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  safeArea: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  headerContainer: {
    paddingHorizontal: 30,
    paddingTop: 40,
    paddingBottom: 30,
    alignItems: "center",
  },
  logo: {
    width: 60,
    height: 60,
    marginBottom: 15,
  },
  title: {
    fontSize: 32,
    fontFamily: "Inder",
    fontWeight: "bold",
    color: "#335C67",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: "Inder",
    color: "#7A8B8E",
    textAlign: "center",
  },
  oauthContainer: {
    paddingHorizontal: 30,
    marginBottom: 30,
  },
  formContainer: {
    backgroundColor: "#F8FAFB",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 30,
    paddingTop: 40,
    flex: 1,
  },
  inputGroup: {
    marginBottom: 25,
  },
  inputLabel: {
    fontSize: 16,
    fontFamily: "Inder",
    fontWeight: "600",
    color: "#335C67",
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#E8EAED",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    fontFamily: "Inder",
    backgroundColor: "#FFFFFF",
    color: "#333",
    minHeight: 50,
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E8EAED",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
  },
  passwordInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    fontFamily: "Inder",
    color: "#333",
    minHeight: 50,
  },
  eyeButton: {
    padding: 16,
  },
  eyeIcon: {
    fontSize: 20,
  },
  inputError: {
    borderColor: "#FF6B6B",
    backgroundColor: "#FFF5F5",
  },
  errorText: {
    color: "#FF6B6B",
    fontSize: 14,
    fontFamily: "Inder",
    marginTop: 5,
  },
  forgotPasswordContainer: {
    alignItems: "flex-end",
    marginBottom: 20,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontFamily: "Inder",
    color: "#335C67",
    fontWeight: "600",
  },
  persistenceInfoContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#E8F4F8",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#C1E4EA",
  },
  persistenceInfoIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  persistenceInfoText: {
    fontSize: 14,
    fontFamily: "Inder",
    color: "#335C67",
    fontWeight: "500",
  },
  buttonContainer: {
    paddingHorizontal: 30,
    paddingTop: 20,
    backgroundColor: "#F8FAFB",
  },
  loginButton: {
    backgroundColor: "#335C67",
    borderRadius: 15,
    paddingVertical: 18,
    alignItems: "center",
    marginBottom: 20,
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
    fontSize: 18,
    fontFamily: "Inder",
    fontWeight: "600",
  },
  registerLinkContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  registerLinkText: {
    fontSize: 16,
    fontFamily: "Inder",
    color: "#7A8B8E",
  },
  registerLink: {
    fontSize: 16,
    fontFamily: "Inder",
    fontWeight: "600",
    color: "#335C67",
  },
});

export default LoginScreen;
