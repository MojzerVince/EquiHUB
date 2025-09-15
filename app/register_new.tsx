import SimpleStableSelection from "@/components/SimpleStableSelection";
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
import { SimpleStable, SimpleStableAPI } from "../lib/simpleStableAPI";

interface ProfileData {
  name: string;
  age: number;
  description: string;
  riding_experience: number;
}

const RegisterScreen = () => {
  const router = useRouter();
  const { showError, showConfirm } = useDialog();

  // Form state
  const [formData, setFormData] = useState<ProfileData>({
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

  const handleRegister = async () => {
    if (!validateForm()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    setErrors({});

    try {
      // TODO: Update user profile with the form data
      // Since the user is already authenticated via Google OAuth from the welcome screen,
      // we just need to update their profile information

      // Handle stable creation after successful profile update
      try {
        if (newStableData) {
          // Create new stable
          const createResult = await SimpleStableAPI.createStable({
            ...newStableData,
            creator_id: "current_user_id", // Replace with actual user ID
          });

          if (createResult.error) {
            console.error("Error creating stable:", createResult.error);
          }
        }
      } catch (error) {
        console.error("Error handling stable creation:", error);
        // Don't fail registration for stable errors
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      let successMessage =
        "Your profile has been set up successfully! Welcome to EquiHUB.";

      if (newStableData) {
        successMessage += `\n\nYou have created ${newStableData.name}!`;
      } else if (selectedStable) {
        successMessage += `\n\nYou can manage your stable preference in your profile.`;
      }

      showConfirm("Profile Setup Complete!", successMessage, () =>
        router.replace("/(tabs)")
      );
    } catch (error) {
      console.error("Profile setup error:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (
    field: keyof ProfileData,
    value: string | number
  ) => {
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
        ? "Our Terms of Service outline the rules and regulations for using EquiHUB."
        : "Our Privacy Policy explains how we collect, use, and protect your personal information.";

    showConfirm(title, message, () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      showConfirm(
        "Coming Soon",
        "Full document viewer will be available in a future update."
      );
    });
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
            <Text style={styles.title}>Complete Your Profile</Text>
            <Text style={styles.subtitle}>
              You're signed in with Google! Tell us about yourself
            </Text>
          </View>

          {/* Form */}
          <View style={styles.formContainer}>
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
                placeholder="Tell us about yourself and your equestrian interests..."
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

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.registerButton,
                loading ? styles.disabledButton : null,
              ]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.loadingText}>Setting up profile...</Text>
                </View>
              ) : (
                <Text style={styles.registerButtonText}>Complete Setup</Text>
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
                Want to use a different account?{" "}
              </Text>
              <Text style={styles.loginLink}>Sign In</Text>
            </TouchableOpacity>
          </View>

          {/* Terms */}
          <View style={styles.termsContainer}>
            <Text style={styles.termsText}>
              By completing setup, you agree to our{" "}
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
    paddingTop: 20,
    paddingBottom: 10,
    alignItems: "center",
  },
  logo: {
    width: 60,
    height: 60,
    marginBottom: 15,
  },
  title: {
    fontSize: 28,
    fontFamily: "Inder",
    fontWeight: "bold",
    color: "#335C67",
    marginBottom: 10,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    fontFamily: "Inder",
    color: "#7A8B8E",
    textAlign: "center",
  },
  formContainer: {
    backgroundColor: "#F8FAFB",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 30,
    paddingTop: 40,
    flex: 1,
    marginTop: 20,
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
  textArea: {
    borderWidth: 1,
    borderColor: "#E8EAED",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    fontFamily: "Inder",
    backgroundColor: "#FFFFFF",
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
    backgroundColor: "#F8FAFB",
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
    fontSize: 16,
    fontFamily: "Inder",
    color: "#7A8B8E",
  },
  loginLink: {
    fontSize: 16,
    fontFamily: "Inder",
    fontWeight: "600",
    color: "#335C67",
  },
  termsContainer: {
    paddingHorizontal: 30,
    paddingTop: 20,
    paddingBottom: 20,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFB",
  },
  termsText: {
    fontSize: 14,
    fontFamily: "Inder",
    color: "#7A8B8E",
    lineHeight: 22,
  },
  termsLink: {
    fontSize: 14,
    fontFamily: "Inder",
    color: "#335C67",
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
    backgroundColor: "#E8F4F8",
    borderWidth: 1,
    borderColor: "#C1E4EA",
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
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8EAED",
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
});

export default RegisterScreen;
