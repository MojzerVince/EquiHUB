import SimpleStableSelection from "@/components/SimpleStableSelection";
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
import { AuthAPI } from "../lib/authAPI";

import { SimpleStable, SimpleStableAPI } from "../lib/simpleStableAPI";
import OAuthButtons from '../components/OAuthButtons';

const RegisterScreen = () => {
  const router = useRouter();
  const { showError, showConfirm } = useDialog();

  // Registration flow state
  const [step, setStep] = useState(1); // 1 = OAuth Auth, 2 = Profile Form  
  const [oauthUser, setOauthUser] = useState<any | null>(null);
  
  // Form state (only profile data, no email/password)
  const [formData, setFormData] = useState({
    name: "",
    age: 18,
    description: "",
    riding_experience: 0,
  });

  const [loading, setLoading] = useState(false);
  // Stable selection state
  const [selectedStable, setSelectedStable] = useState<SimpleStable | null>(
    null
  );
  const [newStableData, setNewStableData] = useState<any>(null);
  const [showStableSelection, setShowStableSelection] = useState(false);

  // Form validation (only for step 2 - profile data)
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Google Auth Response is handled directly in handleGoogleAuth

  const validateProfileForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

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
    if (
      formData.riding_experience !== undefined &&
      (formData.riding_experience < 0 || formData.riding_experience > 80)
    ) {
      newErrors.riding_experience =
        "Riding experience must be between 0 and 80 years";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleGoogleAuth = async () => {
    setGoogleLoading(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const result = await promptAsync() as any;
      
      if (result?.type === 'success') {
        // The new OAuth flow returns user info directly from the server
        const userInfo = result.user;
        setGoogleUser(userInfo);
        
        // Pre-fill name if available
        if (userInfo.name) {
          setFormData(prev => ({ ...prev, name: userInfo.name }));
        }
        
        // Move to profile form step
        setStep(2);
      } else if (result?.type === 'cancelled') {
        console.log('Google auth cancelled');
      } else if (result?.type === 'error') {
        showError(result.error || 'Google authentication failed');
      }
    } catch (error) {
      console.error("Google auth error:", error);
      showError("Failed to authenticate with Google");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleProfileSubmit = async () => {
    if (!validateProfileForm()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (!googleUser) {
      showError("Google authentication required");
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    setErrors({});

    try {
      // Register with Google auth
      const { user, error } = await AuthAPI.registerWithGoogle(
        googleUser,
        {
          name: formData.name,
          age: formData.age,
          description: formData.description,
          riding_experience: formData.riding_experience,
          stable_id: selectedStable?.id
        }
      );

      if (error) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        showError(error);
        return;
      }

      if (user) {
        // Handle stable creation after successful registration
        try {
          if (newStableData) {
            // Create new stable
            const createResult = await SimpleStableAPI.createStable({
              ...newStableData,
              creator_id: user.id,
            });

            if (createResult.error) {
              console.error("Error creating stable:", createResult.error);
            }
          }
          // Note: Stable selection (without joining) can be handled in profile later
        } catch (error) {
          console.error("Error handling stable creation:", error);
          // Don't fail registration for stable errors
        }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        let successMessage =
          "Your account has been created successfully. Please check your email to verify your account before logging in. Once logged in, you'll stay signed in automatically on this device.";

        if (newStableData) {
          successMessage += `\n\nYou have created ${newStableData.name}!`;
        } else if (selectedStable) {
          successMessage += `\n\nYou can set your stable preference in your profile after logging in.`;
        }

        showConfirm("Registration Successful!", successMessage, () =>
          router.replace("/login")
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

  const handleInputChange = (
    field: string,
    value: string | number
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Clear error for this field when user starts typing
    if (errors[field as string]) {
      setErrors((prev: { [key: string]: string }) => ({
        ...prev,
        [field as string]: "",
      }));
    }
  };

  const handleStableSelection = (
    stable: SimpleStable | null,
    isNewStable?: boolean,
    stableData?: any
  ) => {
    setSelectedStable(stable);
    setNewStableData(isNewStable ? stableData : null);
  };

  const handleTermsPress = (type: "terms" | "privacy") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const title = type === "terms" ? "Terms of Service" : "Privacy Policy";
    const message =
      type === "terms"
        ? "Our Terms of Service outline the rules and regulations for using EquiHUB. This would typically open a detailed terms page or web view."
        : "Our Privacy Policy explains how we collect, use, and protect your personal information. This would typically open a detailed privacy page or web view.";

    showConfirm(
      title,
      message,
      () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        // TODO: In a real app, this would open a web view or navigate to a dedicated page
        showConfirm(
          "Coming Soon",
          "Full document viewer will be available in a future update."
        );
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
            <Text style={styles.title}>
              {step === 1 ? "Join EquiHUB" : "Complete Your Profile"}
            </Text>
            <Text style={styles.subtitle}>
              {step === 1 
                ? "Sign up with your Google account to get started" 
                : "Tell us about yourself"}
            </Text>
            {step === 2 && googleUser && (
              <View style={styles.googleUserInfo}>
                <Text style={styles.googleUserEmail}>{googleUser.email}</Text>
              </View>
            )}
          </View>

          {/* Step-based Form */}
          <View style={styles.formContainer}>
            {step === 1 ? (
              // Step 1: Google Authentication
              <View style={styles.googleAuthContainer}>
                <OAuthButtons 
                  onSuccess={(user) => {
                    console.log('OAuth registration successful:', user);
                    // If it's a complete registration, go to tabs
                    router.push('/(tabs)');
                  }}
                  onError={(error) => {
                    showError(error);
                  }}
                  isSignUp={true}
                />
                
                <View style={styles.loginPrompt}>
                  <Text style={styles.loginPromptText}>Already have an account?</Text>
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      router.replace("/login");
                    }}
                    style={styles.googleLoginLink}
                  >
                    <Text style={styles.googleLoginLinkText}>Sign In</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              // Step 2: Profile Form
              <View style={styles.profileFormContainer}>
            {/* Name Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput
                style={[
                  styles.textInput,
                  errors.name ? styles.inputError : null,
                ]}
                value={formData.name}
                onChangeText={(text) => handleInputChange("name", text)}
                placeholder="Enter your full name"
                placeholderTextColor="#999"
                autoCapitalize="words"
                autoCorrect={false}
                maxLength={50}
              />
              {errors.name ? (
                <Text style={styles.errorText}>{errors.name}</Text>
              ) : null}
            </View>

            {/* Age Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Age</Text>
              <TextInput
                style={[
                  styles.textInput,
                  errors.age ? styles.inputError : null,
                ]}
                value={formData.age.toString()}
                onChangeText={(text) => {
                  const age = parseInt(text) || 0;
                  handleInputChange("age", age);
                }}
                placeholder="Enter your age"
                placeholderTextColor="#999"
                keyboardType="numeric"
                maxLength={3}
              />
              {errors.age ? (
                <Text style={styles.errorText}>{errors.age}</Text>
              ) : null}
            </View>

            {/* Riding Experience Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Riding Experience (Years)</Text>
              <TextInput
                style={[
                  styles.textInput,
                  errors.riding_experience ? styles.inputError : null,
                ]}
                value={formData.riding_experience?.toString() || "0"}
                onChangeText={(text) => {
                  const experience = parseInt(text) || 0;
                  handleInputChange("riding_experience", experience);
                }}
                placeholder="Years of riding experience"
                placeholderTextColor="#999"
                keyboardType="numeric"
                maxLength={2}
              />
              {errors.riding_experience ? (
                <Text style={styles.errorText}>{errors.riding_experience}</Text>
              ) : null}
            </View>





            {/* Description Input (Optional) */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>About You (Optional)</Text>
              <TextInput
                style={[styles.textArea]}
                value={formData.description}
                onChangeText={(text) => handleInputChange("description", text)}
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

            {/* Stable Selection */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Stable/Ranch (Optional)</Text>
              <Text style={styles.inputDescription}>
                Choose a stable to associate with or skip to set this later
              </Text>

              {selectedStable ? (
                <View style={styles.selectedStableContainer}>
                  <View style={styles.selectedStableInfo}>
                    <Text style={styles.selectedStableName}>
                      {selectedStable.name}
                    </Text>
                    <Text style={styles.selectedStableLocation}>
                      {selectedStable.city && selectedStable.state_province
                        ? `${selectedStable.city}, ${selectedStable.state_province}`
                        : selectedStable.location || "Location not specified"}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.changeStableButton}
                    onPress={() => setShowStableSelection(true)}
                  >
                    <Text style={styles.changeStableButtonText}>Change</Text>
                  </TouchableOpacity>
                </View>
              ) : newStableData ? (
                <View style={styles.selectedStableContainer}>
                  <View style={styles.selectedStableInfo}>
                    <Text style={styles.selectedStableName}>
                      {newStableData.name}
                    </Text>
                    <Text style={styles.selectedStableLocation}>
                      New stable - you'll be the owner
                    </Text>
                    {newStableData.city && newStableData.state_province && (
                      <Text style={styles.selectedStableMembers}>
                        {newStableData.city}, {newStableData.state_province}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={styles.changeStableButton}
                    onPress={() => setShowStableSelection(true)}
                  >
                    <Text style={styles.changeStableButtonText}>Change</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.selectStableButton}
                  onPress={() => setShowStableSelection(true)}
                >
                  <Text style={styles.selectStableButtonText}>
                    Choose a Stable
                  </Text>
                </TouchableOpacity>
              )}
            </View>
              </View>
            )}
          </View>

          {/* Buttons - only show for step 2 */}
          {step === 2 && (
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.registerButton,
                loading ? styles.disabledButton : null,
              ]}
              onPress={handleProfileSubmit}
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
              <Text style={styles.loginLinkText}>
                Already have an account?{" "}
              </Text>
              <Text style={styles.loginLink}>Sign In</Text>
            </TouchableOpacity>
          </View>
          )}

          {/* Terms - show for both steps */}
          <View style={styles.termsContainer}>
            <Text style={styles.termsText}>
              By creating an account, you agree to our{" "}
            </Text>
            <TouchableOpacity
              onPress={() => handleTermsPress("terms")}
              activeOpacity={0.7}
            >
              <Text style={styles.termsLink}>Terms of Service</Text>
            </TouchableOpacity>
            <Text style={styles.termsText}> and </Text>
            <TouchableOpacity
              onPress={() => handleTermsPress("privacy")}
              activeOpacity={0.7}
            >
              <Text style={styles.termsLink}>Privacy Policy</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Stable Selection Modal */}
      <SimpleStableSelection
        visible={showStableSelection}
        onClose={() => setShowStableSelection(false)}
        onSelect={handleStableSelection}
        selectedStable={selectedStable}
      />
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
    paddingTop: 20,
    paddingBottom: 10,
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
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
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
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
    textDecorationLine: "underline",
  },
  // Stable selection styles
  inputDescription: {
    fontSize: 14,
    fontFamily: "Inder",
    color: "#666",
    marginBottom: 12,
    lineHeight: 18,
  },
  selectedStableContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f8ff",
    borderWidth: 1,
    borderColor: "#335C67",
    borderRadius: 12,
    padding: 16,
  },
  selectedStableInfo: {
    flex: 1,
  },
  selectedStableName: {
    fontSize: 16,
    fontFamily: "Inder",
    fontWeight: "600",
    color: "#335C67",
    marginBottom: 4,
  },
  selectedStableLocation: {
    fontSize: 14,
    fontFamily: "Inder",
    color: "#666",
    marginBottom: 2,
  },
  selectedStableMembers: {
    fontSize: 12,
    fontFamily: "Inder",
    color: "#999",
  },
  changeStableButton: {
    backgroundColor: "#335C67",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  changeStableButtonText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inder",
    fontWeight: "600",
  },
  selectStableButton: {
    backgroundColor: "#f9f9f9",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    borderStyle: "dashed",
  },
  selectStableButtonText: {
    color: "#335C67",
    fontSize: 16,
    fontFamily: "Inder",
    fontWeight: "600",
  },
  googleUserInfo: {
    marginTop: 10,
    padding: 10,
    backgroundColor: "#f0f8ff",
    borderRadius: 8,
  },
  googleUserEmail: {
    fontSize: 14,
    fontFamily: "Inder",
    color: "#666",
    textAlign: "center",
  },
  googleAuthContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minWidth: 250,
  },
  googleButtonIcon: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#4285F4",
    marginRight: 10,
    fontFamily: "Inder",
  },
  googleButtonText: {
    fontSize: 16,
    fontFamily: "Inder",
    fontWeight: "600",
    color: "#333",
  },
  loginPrompt: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  loginPromptText: {
    fontSize: 16,
    fontFamily: "Inder",
    color: "#666",
    marginRight: 5,
  },
  googleLoginLink: {
    padding: 5,
  },
  googleLoginLinkText: {
    fontSize: 16,
    fontFamily: "Inder",
    fontWeight: "600",
    color: "#335C67",
  },
  profileFormContainer: {
    paddingVertical: 20,
  },
});

export default RegisterScreen;
