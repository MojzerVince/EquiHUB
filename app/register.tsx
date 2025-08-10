import * as Haptics from 'expo-haptics';
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
import { useDialog } from "@/contexts/DialogContext";
import { AuthAPI, RegisterData } from "../lib/authAPI";

const RegisterScreen = () => {
  const router = useRouter();
  const { showError, showConfirm } = useDialog();
  
  // Form state
  const [formData, setFormData] = useState<RegisterData>({
    email: "",
    password: "",
    name: "",
    age: 18,
    description: "",
    riding_experience: 0,
  });
  
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Form validation
  const [errors, setErrors] = useState<{[key: string]: string}>({});

  const validateForm = (): boolean => {
    const newErrors: {[key: string]: string} = {};

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email) {
      newErrors.email = "Email is required";
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters long";
    }

    // Confirm password validation
    if (!confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (formData.password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    // Name validation
    const namePattern = /^[\p{L}\p{M}\s\-'\.]+$/u;
    if (!formData.name) {
      newErrors.name = "Name is required";
    } else if (formData.name.length < 2) {
      newErrors.name = "Name must be at least 2 characters long";
    } else if (formData.name.length > 50) {
      newErrors.name = "Name must be less than 50 characters";
    } else if (!namePattern.test(formData.name)) {
      newErrors.name = "Name contains invalid characters";
    }

    // Age validation
    if (!formData.age || formData.age < 13 || formData.age > 120) {
      newErrors.age = "Age must be between 13 and 120";
    }

    // Riding experience validation
    if (formData.riding_experience !== undefined && 
        (formData.riding_experience < 0 || formData.riding_experience > 80)) {
      newErrors.riding_experience = "Riding experience must be between 0 and 80 years";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validateForm()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    setErrors({});

    try {
      const { user, error } = await AuthAPI.register(formData);

      if (error) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        showError(error);
        return;
      }

      if (user) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showConfirm(
          "Registration Successful!",
          "Your account has been created successfully. Please check your email to verify your account before logging in. Once logged in, you'll stay signed in automatically on this device.",
          () => router.replace("/login")
        );
      }
    } catch (error) {
      console.error("Registration error:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof RegisterData, value: string | number) => {
    setFormData((prev: RegisterData) => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error for this field when user starts typing
    if (errors[field as string]) {
      setErrors((prev: {[key: string]: string}) => ({
        ...prev,
        [field as string]: ""
      }));
    }
  };

  const handleTermsPress = (type: 'terms' | 'privacy') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    const title = type === 'terms' ? 'Terms of Service' : 'Privacy Policy';
    const message = type === 'terms' 
      ? 'Our Terms of Service outline the rules and regulations for using EquiHUB. This would typically open a detailed terms page or web view.'
      : 'Our Privacy Policy explains how we collect, use, and protect your personal information. This would typically open a detailed privacy page or web view.';
    
    showConfirm(
      title,
      message,
      () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        // TODO: In a real app, this would open a web view or navigate to a dedicated page
        showConfirm('Coming Soon', 'Full document viewer will be available in a future update.');
      },
      () => {
        // User closed the dialog
      }
    );
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
            <Text style={styles.title}>Join EquiHUB</Text>
            <Text style={styles.subtitle}>Create your equestrian profile</Text>
          </View>

          {/* Form */}
          <View style={styles.formContainer}>
            {/* Name Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput
                style={[styles.textInput, errors.name ? styles.inputError : null]}
                value={formData.name}
                onChangeText={(text) => handleInputChange('name', text)}
                placeholder="Enter your full name"
                placeholderTextColor="#999"
                autoCapitalize="words"
                autoCorrect={false}
                maxLength={50}
              />
              {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}
            </View>

            {/* Age Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Age</Text>
              <TextInput
                style={[styles.textInput, errors.age ? styles.inputError : null]}
                value={formData.age.toString()}
                onChangeText={(text) => {
                  const age = parseInt(text) || 0;
                  handleInputChange('age', age);
                }}
                placeholder="Enter your age"
                placeholderTextColor="#999"
                keyboardType="numeric"
                maxLength={3}
              />
              {errors.age ? <Text style={styles.errorText}>{errors.age}</Text> : null}
            </View>

            {/* Riding Experience Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Riding Experience (Years)</Text>
              <TextInput
                style={[styles.textInput, errors.riding_experience ? styles.inputError : null]}
                value={formData.riding_experience?.toString() || "0"}
                onChangeText={(text) => {
                  const experience = parseInt(text) || 0;
                  handleInputChange('riding_experience', experience);
                }}
                placeholder="Years of riding experience"
                placeholderTextColor="#999"
                keyboardType="numeric"
                maxLength={2}
              />
              {errors.riding_experience ? <Text style={styles.errorText}>{errors.riding_experience}</Text> : null}
            </View>

            {/* Email Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email Address</Text>
              <TextInput
                style={[styles.textInput, errors.email ? styles.inputError : null]}
                value={formData.email}
                onChangeText={(text) => handleInputChange('email', text.toLowerCase().trim())}
                placeholder="Enter your email address"
                placeholderTextColor="#999"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
              />
              {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
            </View>

            {/* Password Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[styles.passwordInput, errors.password ? styles.inputError : null]}
                  value={formData.password}
                  onChangeText={(text) => handleInputChange('password', text)}
                  placeholder="Create a password"
                  placeholderTextColor="#999"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="new-password"
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowPassword(!showPassword);
                  }}
                  activeOpacity={0.6}
                >
                  <Text style={styles.eyeIcon}>{showPassword ? "🙈" : "👁️"}</Text>
                </TouchableOpacity>
              </View>
              {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
            </View>

            {/* Confirm Password Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Confirm Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[styles.passwordInput, errors.confirmPassword ? styles.inputError : null]}
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    if (errors.confirmPassword) {
                      setErrors(prev => ({
                        ...prev,
                        confirmPassword: ""
                      }));
                    }
                  }}
                  placeholder="Confirm your password"
                  placeholderTextColor="#999"
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="new-password"
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowConfirmPassword(!showConfirmPassword);
                  }}
                  activeOpacity={0.6}
                >
                  <Text style={styles.eyeIcon}>{showConfirmPassword ? "🙈" : "👁️"}</Text>
                </TouchableOpacity>
              </View>
              {errors.confirmPassword ? <Text style={styles.errorText}>{errors.confirmPassword}</Text> : null}
            </View>

            {/* Description Input (Optional) */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>About You (Optional)</Text>
              <TextInput
                style={[styles.textArea]}
                value={formData.description}
                onChangeText={(text) => handleInputChange('description', text)}
                placeholder="Tell us a bit about yourself and your equestrian interests..."
                placeholderTextColor="#999"
                multiline={true}
                numberOfLines={4}
                maxLength={500}
                textAlignVertical="top"
              />
              <Text style={styles.characterCount}>
                {formData.description?.length || 0}/500
              </Text>
            </View>
          </View>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.registerButton, loading ? styles.disabledButton : null]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.loadingText}>Creating Account...</Text>
                </View>
              ) : (
                <Text style={styles.registerButtonText}>Create Account</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.loginLinkContainer}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.replace("/login");
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.loginLinkText}>Already have an account? </Text>
              <Text style={styles.loginLink}>Sign In</Text>
            </TouchableOpacity>
          </View>

          {/* Terms */}
          <View style={styles.termsContainer}>
            <Text style={styles.termsText}>
              By creating an account, you agree to our{" "}
            </Text>
            <TouchableOpacity 
              onPress={() => handleTermsPress('terms')}
              activeOpacity={0.7}
            >
              <Text style={styles.termsLink}>Terms of Service</Text>
            </TouchableOpacity>
            <Text style={styles.termsText}> and </Text>
            <TouchableOpacity 
              onPress={() => handleTermsPress('privacy')}
              activeOpacity={0.7}
            >
              <Text style={styles.termsLink}>Privacy Policy</Text>
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
    backgroundColor: "#335C67",
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
  title: {
    fontSize: 36,
    fontFamily: "Inder",
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    fontFamily: "Inder",
    color: "#B8D4DA",
    textAlign: "center",
  },
  formContainer: {
    backgroundColor: "#fff",
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
    borderColor: "#ddd",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    fontFamily: "Inder",
    backgroundColor: "#f9f9f9",
    color: "#333",
    minHeight: 50,
  },
  textArea: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    fontFamily: "Inder",
    backgroundColor: "#f9f9f9",
    color: "#333",
    minHeight: 100,
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    backgroundColor: "#f9f9f9",
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
  characterCount: {
    fontSize: 12,
    color: "#999",
    textAlign: "right",
    marginTop: 5,
    fontFamily: "Inder",
  },
  buttonContainer: {
    paddingHorizontal: 30,
    paddingTop: 20,
  },
  registerButton: {
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
  registerButtonText: {
    color: "#fff",
    fontSize: 18,
    fontFamily: "Inder",
    fontWeight: "600",
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inder",
    marginLeft: 10,
  },
  loginLinkContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  loginLinkText: {
    fontSize: 18,
    fontFamily: "Inder",
    color: "#fff",
  },
  loginLink: {
    fontSize: 18,
    fontFamily: "Inder",
    fontWeight: "600",
    color: "#fff",
  },
  termsContainer: {
    paddingHorizontal: 30,
    paddingTop: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
  },
  termsText: {
    fontSize: 16,
    fontFamily: "Inder",
    color: "#fff",
    lineHeight: 22,
  },
  termsLink: {
    fontSize: 16,
    fontFamily: "Inder",
    color: "#fff",
    fontWeight: "600",
    textDecorationLine: 'underline',
  },
});

export default RegisterScreen;
