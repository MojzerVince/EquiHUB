import SimpleStableSelection from "@/components/SimpleStableSelection";
import { useDialog } from "@/contexts/DialogContext";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
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
import { useGoogleRegistration } from "../lib/useGoogleRegistration";

import { SimpleStable, SimpleStableAPI } from "../lib/simpleStableAPI";

const RegisterScreen = () => {
  const router = useRouter();
  const { showError, showConfirm } = useDialog();
  const params = useLocalSearchParams();
  const {
    getGoogleUserInfo,
    completeRegistration,
    loading: googleLoading,
  } = useGoogleRegistration();

  // Registration flow state - start at step 2 if Google user data is provided
  const [step, setStep] = useState(params.googleUser ? 2 : 1);
  const [oauthUser, setOauthUser] = useState<any | null>(null);

  // Form state (only profile data, no email/password)
  const [formData, setFormData] = useState({
    name: "",
    age: 18,
    description: "",
    riding_experience: 0,
  });

  const [loading, setLoading] = useState(false);

  // Initialize with Google user data if provided via navigation params
  useEffect(() => {
    if (params.googleUser && typeof params.googleUser === "string") {
      try {
        const googleUserData = JSON.parse(params.googleUser);
        setOauthUser(googleUserData);

        // Pre-fill name if available
        if (googleUserData.name) {
          setFormData((prev) => ({ ...prev, name: googleUserData.name }));
        }

        // Ensure we're on step 2
        setStep(2);
      } catch (error) {
        console.error("Error parsing Google user data:", error);
        showError("Invalid Google user data received");
      }
    }
  }, [params.googleUser]);
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
    try {
      const result = await getGoogleUserInfo();

      if (result.success && result.userInfo) {
        setOauthUser(result.userInfo);

        // Pre-fill name if available
        if (result.userInfo.name) {
          setFormData((prev) => ({ ...prev, name: result.userInfo.name }));
        }

        // Move to profile form step
        setStep(2);
      } else {
        showError(result.error || "Google authentication failed");
      }
    } catch (error) {
      console.error("Google auth error:", error);
      showError("Failed to authenticate with Google");
    }
  };

  const handleProfileSubmit = async () => {
    if (!validateProfileForm()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (!oauthUser) {
      showError("Google authentication required");
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      // Complete Google registration using the new hook
      const result = await completeRegistration(oauthUser, {
        name: formData.name,
        age: formData.age,
        description: formData.description,
        riding_experience: formData.riding_experience,
        stable_id: selectedStable?.id,
      });

      if (!result.success) {
        showError(result.error || "Registration failed");
        return;
      }

      if (result.user) {
        // Handle stable creation after successful registration
        try {
          if (newStableData) {
            // Create new stable
            const createResult = await SimpleStableAPI.createStable({
              ...newStableData,
              creator_id: result.user.id,
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

  const handleInputChange = (field: string, value: string | number) => {
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
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoid}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            {/* Header */}
            <View style={styles.headerContainer}>
              <Text style={styles.title}>
                {step === 1 ? "Join EquiHUB" : "Complete Your Profile"}
              </Text>
              <Text style={styles.subtitle}>
                {step === 1
                  ? "Sign up with your Google account to get started"
                  : "Tell us about yourself to personalize your experience"}
              </Text>
              {step === 2 && oauthUser && (
                <View style={styles.googleUserInfo}>
                  <Text style={styles.googleUserEmail}>
                    📧 {oauthUser.email}
                  </Text>
                </View>
              )}
            </View>

            {/* Step-based Form */}
            <View style={styles.formContainer}>
              {step === 1 ? (
                // Step 1: Google Authentication
                <View style={styles.googleAuthContainer}>
                  {/* Custom Google Sign-in Button */}
                  <TouchableOpacity
                    style={[
                      styles.googleButton,
                      googleLoading && styles.disabledButton,
                    ]}
                    onPress={handleGoogleAuth}
                    disabled={googleLoading}
                    activeOpacity={0.8}
                  >
                    {googleLoading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Text style={styles.googleButtonIcon}>🔍</Text>
                        <Text style={styles.googleButtonText}>
                          Sign up with Google
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>

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
                    <Text style={styles.inputLabel}>
                      Riding Experience (Years)
                    </Text>
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
                      <Text style={styles.errorText}>
                        {errors.riding_experience}
                      </Text>
                    ) : null}
                  </View>

                  {/* Description Input (Optional) */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>About You (Optional)</Text>
                    <TextInput
                      style={[styles.textArea]}
                      value={formData.description}
                      onChangeText={(text) =>
                        handleInputChange("description", text)
                      }
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
                    <Text style={styles.inputLabel}>
                      Stable/Ranch (Optional)
                    </Text>
                    <Text style={styles.inputDescription}>
                      Choose a stable to associate with or skip to set this
                      later
                    </Text>

                    {selectedStable ? (
                      <View style={styles.selectedStableContainer}>
                        <View style={styles.selectedStableInfo}>
                          <Text style={styles.selectedStableName}>
                            {selectedStable.name}
                          </Text>
                          <Text style={styles.selectedStableLocation}>
                            {selectedStable.city &&
                            selectedStable.state_province
                              ? `${selectedStable.city}, ${selectedStable.state_province}`
                              : selectedStable.location ||
                                "Location not specified"}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.changeStableButton}
                          onPress={() => setShowStableSelection(true)}
                        >
                          <Text style={styles.changeStableButtonText}>
                            Change
                          </Text>
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
                          {newStableData.city &&
                            newStableData.state_province && (
                              <Text style={styles.selectedStableMembers}>
                                {newStableData.city},{" "}
                                {newStableData.state_province}
                              </Text>
                            )}
                        </View>
                        <TouchableOpacity
                          style={styles.changeStableButton}
                          onPress={() => setShowStableSelection(true)}
                        >
                          <Text style={styles.changeStableButtonText}>
                            Change
                          </Text>
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
                      <Text style={styles.loadingText}>
                        Creating Account...
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.registerButtonText}>
                      Create Account
                    </Text>
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
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Stable Selection Modal */}
      <SimpleStableSelection
        visible={showStableSelection}
        onClose={() => setShowStableSelection(false)}
        onSelect={handleStableSelection}
        selectedStable={selectedStable}
      />
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
    paddingHorizontal: 20,
  },
  content: {
    flex: 1,
    maxWidth: 400,
    alignSelf: "center",
    width: "100%",
  },
  headerContainer: {
    paddingVertical: 40,
    alignItems: "center",
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
    lineHeight: 22,
    marginBottom: 20,
  },
  googleUserInfo: {
    marginTop: 15,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: "#e8f4fd",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#bee5eb",
  },
  googleUserEmail: {
    fontSize: 14,
    color: "#495057",
    textAlign: "center",
    fontWeight: "500",
  },
  formContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  googleAuthContainer: {
    alignItems: "center",
    paddingVertical: 20,
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
    marginBottom: 30,
    minWidth: 280,
  },
  googleButtonIcon: {
    fontSize: 20,
    marginRight: 12,
    color: "#ffffff",
  },
  googleButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  disabledButton: {
    backgroundColor: "#999",
  },
  loginPrompt: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
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
  profileFormContainer: {
    flex: 1,
  },
  inputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2c3e50",
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 2,
    borderColor: "#e9ecef",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    backgroundColor: "#f8f9fa",
    color: "#2c3e50",
    fontWeight: "500",
  },
  textArea: {
    borderWidth: 2,
    borderColor: "#e9ecef",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    backgroundColor: "#f8f9fa",
    color: "#2c3e50",
    fontWeight: "500",
    minHeight: 100,
    textAlignVertical: "top",
  },
  inputError: {
    borderColor: "#e74c3c",
    backgroundColor: "#fdf2f2",
  },
  errorText: {
    color: "#e74c3c",
    fontSize: 14,
    marginTop: 6,
    fontWeight: "500",
  },
  characterCount: {
    fontSize: 12,
    color: "#6c757d",
    textAlign: "right",
    marginTop: 6,
  },
  buttonContainer: {
    paddingVertical: 20,
  },
  registerButton: {
    backgroundColor: "#2c3e50",
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  registerButtonText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 10,
  },
  loginLinkContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 12,
  },
  termsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
  },
  termsText: {
    fontSize: 14,
    color: "#6c757d",
    lineHeight: 20,
  },
  termsLink: {
    fontSize: 14,
    color: "#3498db",
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  // Stable selection styles
  inputDescription: {
    fontSize: 14,
    color: "#6c757d",
    marginBottom: 12,
    lineHeight: 18,
  },
  selectedStableContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e8f4fd",
    borderWidth: 2,
    borderColor: "#3498db",
    borderRadius: 12,
    padding: 16,
  },
  selectedStableInfo: {
    flex: 1,
  },
  selectedStableName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2c3e50",
    marginBottom: 4,
  },
  selectedStableLocation: {
    fontSize: 14,
    color: "#6c757d",
    marginBottom: 2,
  },
  selectedStableMembers: {
    fontSize: 12,
    color: "#6c757d",
  },
  changeStableButton: {
    backgroundColor: "#3498db",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  changeStableButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  selectStableButton: {
    backgroundColor: "#f8f9fa",
    borderWidth: 2,
    borderColor: "#e9ecef",
    borderRadius: 12,
    paddingVertical: 20,
    alignItems: "center",
    borderStyle: "dashed",
  },
  selectStableButtonText: {
    color: "#3498db",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default RegisterScreen;
