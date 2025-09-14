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
import { OAuthButtonGroup } from "../components/OAuthButtons";
import { AuthUser, RegisterData } from "../lib/authAPI";
import { SimpleStable, SimpleStableAPI } from "../lib/simpleStableAPI";

const RegisterScreen = () => {
  const router = useRouter();
  const { showError, showConfirm } = useDialog();

  // OAuth and form state
  const [oauthUser, setOauthUser] = useState<AuthUser | null>(null);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [step, setStep] = useState<"oauth" | "profile">("oauth");

  // Form state (without email and password)
  const [formData, setFormData] = useState<Partial<RegisterData>>({
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

  // Form validation
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const validateForm = (): boolean => {
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

  const handleCompleteProfile = async () => {
    if (!oauthUser) {
      showError("Please authenticate with Google first");
      return;
    }

    if (!validateForm()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    setErrors({});

    try {
      // Complete the profile with additional information
      // The user is already authenticated via OAuth, so we just need to update their profile

      // Handle stable creation after successful authentication
      try {
        if (newStableData) {
          // Create new stable
          const createResult = await SimpleStableAPI.createStable({
            ...newStableData,
            creator_id: oauthUser.id,
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
        "Welcome to EquiHUB! Your profile has been completed successfully.";

      if (newStableData) {
        successMessage += `\n\nYou have created ${newStableData.name}!`;
      } else if (selectedStable) {
        successMessage += `\n\nYou can set your stable preference in your profile later.`;
      }

      showConfirm("Profile Complete!", successMessage, () => {
        // Let the AuthContext handle navigation automatically
        console.log(
          "Profile completion successful, auth state should handle navigation"
        );
      });
    } catch (error) {
      console.error("Profile completion error:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthSuccess = (user: AuthUser) => {
    console.log("OAuth authentication successful:", user.email);
    setOauthUser(user);
    setStep("profile");
    // Pre-fill the name if available from OAuth
    if (user.email) {
      setFormData((prev) => ({
        ...prev,
        name: prev.name || user.email.split("@")[0], // Use email prefix as default name
      }));
    }
  };

  const handleOAuthError = (error: string) => {
    setOauthLoading(false);
    showError(error);
  };

  const handleBackToOAuth = () => {
    setStep("oauth");
    setOauthUser(null);
    setFormData({
      name: "",
      age: 18,
      description: "",
      riding_experience: 0,
    });
  };

  const handleProfileCompletion = async () => {
    if (!isFormValid()) return;
    await handleCompleteProfile();
  };

  const isFormValid = (): boolean => {
    return !!(
      formData.name &&
      formData.name.length >= 2 &&
      formData.age &&
      formData.age >= 13
    );
  };

  const handleInputChange = (
    field: keyof Partial<RegisterData>,
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
            {step === "oauth" ? (
              <>
                <Text style={styles.title}>Join EquiHUB</Text>
                <Text style={styles.subtitle}>
                  Sign in with your Google account to get started
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.title}>Complete Your Profile</Text>
                <Text style={styles.subtitle}>Tell us more about yourself</Text>
                {oauthUser && (
                  <Text style={styles.welcomeText}>
                    Welcome, {oauthUser.email}!
                  </Text>
                )}
              </>
            )}
          </View>

          {/* OAuth Step */}
          {step === "oauth" && (
            <View style={styles.oauthContainer}>
              <Text style={styles.oauthDescription}>
                Please sign in with Google to create your EquiHUB account. Your
                email will be used to create your profile.
              </Text>

              <OAuthButtonGroup
                mode="register"
                onSuccess={handleOAuthSuccess}
                onError={handleOAuthError}
                disabled={oauthLoading}
                showDivider={false}
              />

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

          {/* Profile Completion Step */}
          {step === "profile" && (
            <View style={styles.formContainer}>
              {/* Back Button */}
              <TouchableOpacity
                style={styles.backButton}
                onPress={handleBackToOAuth}
              >
                <Text style={styles.backButtonText}>
                  ← Back to Authentication
                </Text>
              </TouchableOpacity>

              {/* Name Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Full Name</Text>
                <TextInput
                  style={[
                    styles.textInput,
                    errors.name ? styles.inputError : null,
                  ]}
                  value={formData.name || ""}
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
                  value={formData.age?.toString() || "18"}
                  onChangeText={(text) => {
                    const age = parseInt(text) || 18;
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
                  value={formData.description || ""}
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

          {/* Buttons - Only show for profile step */}
          {step === "profile" && (
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[
                  styles.registerButton,
                  loading ? styles.disabledButton : null,
                ]}
                onPress={handleProfileCompletion}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.loadingText}>Creating Account...</Text>
                  </View>
                ) : (
                  <Text style={styles.registerButtonText}>
                    Complete Registration
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Terms */}
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
    backgroundColor: "#ffffff",
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
    paddingBottom: 30,
    alignItems: "center",
  },
  title: {
    fontSize: 32,
    fontFamily: "Inder",
    fontWeight: "bold",
    color: "#2C3E50",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: "Inder",
    color: "#7F8C8D",
    textAlign: "center",
  },
  formContainer: {
    paddingHorizontal: 30,
    flex: 1,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontFamily: "Inder",
    fontWeight: "600",
    color: "#2C3E50",
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#E8E8E8",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    fontFamily: "Inder",
    backgroundColor: "#ffffff",
    color: "#2C3E50",
    minHeight: 50,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  textArea: {
    borderWidth: 1,
    borderColor: "#E8E8E8",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    fontFamily: "Inder",
    backgroundColor: "#ffffff",
    color: "#2C3E50",
    minHeight: 100,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E8E8E8",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  passwordInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    fontFamily: "Inder",
    color: "#2C3E50",
    minHeight: 50,
  },
  eyeButton: {
    padding: 16,
  },
  eyeIcon: {
    fontSize: 20,
  },
  inputError: {
    borderColor: "#E74C3C",
    backgroundColor: "#FDF2F2",
  },
  errorText: {
    color: "#E74C3C",
    fontSize: 14,
    fontFamily: "Inder",
    marginTop: 5,
  },
  characterCount: {
    fontSize: 12,
    color: "#95A5A6",
    textAlign: "right",
    marginTop: 5,
    fontFamily: "Inder",
  },
  buttonContainer: {
    paddingHorizontal: 30,
    paddingTop: 30,
  },
  registerButton: {
    backgroundColor: "#3498DB",
    borderRadius: 25,
    paddingVertical: 18,
    alignItems: "center",
    marginBottom: 20,
    shadowColor: "#3498DB",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  disabledButton: {
    backgroundColor: "#BDC3C7",
    shadowOpacity: 0.1,
  },
  registerButtonText: {
    color: "#ffffff",
    fontSize: 18,
    fontFamily: "Inder",
    fontWeight: "bold",
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: "#ffffff",
    fontSize: 16,
    fontFamily: "Inder",
    marginLeft: 10,
  },
  loginLinkContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  loginLinkText: {
    fontSize: 16,
    fontFamily: "Inder",
    color: "#7F8C8D",
  },
  loginLink: {
    fontSize: 16,
    fontFamily: "Inder",
    fontWeight: "600",
    color: "#3498DB",
  },
  termsContainer: {
    paddingHorizontal: 30,
    paddingTop: 20,
    paddingBottom: 20,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
  },
  termsText: {
    fontSize: 14,
    fontFamily: "Inder",
    color: "#95A5A6",
    lineHeight: 20,
  },
  termsLink: {
    fontSize: 14,
    fontFamily: "Inder",
    color: "#3498DB",
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  // Stable selection styles
  inputDescription: {
    fontSize: 14,
    fontFamily: "Inder",
    color: "#7F8C8D",
    marginBottom: 12,
    lineHeight: 18,
  },
  selectedStableContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EBF3FD",
    borderWidth: 1,
    borderColor: "#3498DB",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  selectedStableInfo: {
    flex: 1,
  },
  selectedStableName: {
    fontSize: 16,
    fontFamily: "Inder",
    fontWeight: "600",
    color: "#2C3E50",
    marginBottom: 4,
  },
  selectedStableLocation: {
    fontSize: 14,
    fontFamily: "Inder",
    color: "#7F8C8D",
    marginBottom: 2,
  },
  selectedStableMembers: {
    fontSize: 12,
    fontFamily: "Inder",
    color: "#95A5A6",
  },
  changeStableButton: {
    backgroundColor: "#3498DB",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  changeStableButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontFamily: "Inder",
    fontWeight: "600",
  },
  selectStableButton: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#E8E8E8",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    borderStyle: "dashed",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  selectStableButtonText: {
    color: "#3498DB",
    fontSize: 16,
    fontFamily: "Inder",
    fontWeight: "600",
  },
  oauthContainer: {
    paddingVertical: 20,
  },
  oauthDescription: {
    fontSize: 16,
    fontFamily: "Inder",
    color: "#555",
    textAlign: "center",
    marginBottom: 30,
    lineHeight: 22,
  },
  backButton: {
    alignSelf: "flex-start",
    marginBottom: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
  },
  backButtonText: {
    fontSize: 14,
    fontFamily: "Inder",
    color: "#3498DB",
    fontWeight: "600",
  },
  welcomeText: {
    fontSize: 18,
    fontFamily: "Inder",
    color: "#2c3e50",
    textAlign: "center",
    marginBottom: 10,
    fontWeight: "600",
  },
});

export default RegisterScreen;
