import React, { useState, useEffect } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
  Modal,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { ProfileAPI } from "../../lib/profileAPI";
import { useLoadingState } from "../../hooks/useLoadingState";

const ProfileScreen = () => {
  // For demo purposes, using a hardcoded user ID
  // In a real app, this would come from authentication
  const USER_ID = "demo-user-123";
  
  const [isEditing, setIsEditing] = useState(false);
  const [userName, setUserName] = useState("Vince Mojzer");
  const [userAge, setUserAge] = useState("18");
  const [userDescription, setUserDescription] = useState(
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore"
  );

  // Store the saved values to revert to when canceling
  const [savedUserName, setSavedUserName] = useState("Vince Mojzer");
  const [savedUserAge, setSavedUserAge] = useState("18");
  const [savedUserDescription, setSavedUserDescription] = useState(
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore"
  );

  // State for custom success modal
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // State for custom image picker modal
  const [showImagePickerModal, setShowImagePickerModal] = useState(false);

  // State for profile image
  const [profileImage, setProfileImage] = useState(
    require("../../assets/images/horses/falko.png")
  );
  const [savedProfileImage, setSavedProfileImage] = useState(
    require("../../assets/images/horses/falko.png")
  );

  // Loading state
  const { isLoading, error, setLoading, setError, clearError } = useLoadingState();

  // Load profile data on component mount
  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    clearError();
    
    try {
      const profile = await ProfileAPI.getProfile(USER_ID);
      if (profile) {
        setUserName(profile.name);
        setUserAge(profile.age.toString());
        setUserDescription(profile.description);
        setSavedUserName(profile.name);
        setSavedUserAge(profile.age.toString());
        setSavedUserDescription(profile.description);
        
        if (profile.profile_image_url) {
          setProfileImage({ uri: profile.profile_image_url });
          setSavedProfileImage({ uri: profile.profile_image_url });
        }
      }
    } catch (err) {
      setError("Failed to load profile");
      console.error("Error loading profile:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditPress = () => {
    setIsEditing(true);
  };

  const pickImage = async () => {
    // Request permission to access media library
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert(
        "Permission Required",
        "You need to grant camera roll permissions to change your profile picture."
      );
      return;
    }

    // Show custom image picker modal instead of Alert
    setShowImagePickerModal(true);
  };

  const openCamera = async () => {
    setShowImagePickerModal(false);
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert(
        "Permission Required",
        "You need to grant camera permissions to take a photo."
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setProfileImage({ uri: result.assets[0].uri });
    }
  };

  const openImageLibrary = async () => {
    setShowImagePickerModal(false);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setProfileImage({ uri: result.assets[0].uri });
    }
  };

  const handleSave = async () => {
    if (userName.trim() === "") {
      Alert.alert("Error", "Name cannot be empty");
      return;
    }
    if (userAge.trim() === "" || isNaN(Number(userAge))) {
      Alert.alert("Error", "Please enter a valid age");
      return;
    }

    setLoading(true);
    clearError();

    try {
      // Upload profile image if it's a new image (has uri)
      let profileImageUrl = null;
      if (profileImage && 'uri' in profileImage) {
        profileImageUrl = await ProfileAPI.uploadProfileImage(USER_ID, profileImage.uri);
        if (!profileImageUrl) {
          throw new Error("Failed to upload profile image");
        }
      }

      // Update profile data
      const success = await ProfileAPI.updateProfile(USER_ID, {
        name: userName,
        age: parseInt(userAge),
        description: userDescription,
        ...(profileImageUrl && { profile_image_url: profileImageUrl })
      });

      if (!success) {
        throw new Error("Failed to update profile");
      }

      // Update saved values with the current edited values
      setSavedUserName(userName);
      setSavedUserAge(userAge);
      setSavedUserDescription(userDescription);
      if (profileImageUrl) {
        setSavedProfileImage({ uri: profileImageUrl });
        setProfileImage({ uri: profileImageUrl });
      } else {
        setSavedProfileImage(profileImage);
      }

      setIsEditing(false);
      setShowSuccessModal(true);
    } catch (err) {
      setError("Failed to save profile");
      Alert.alert("Error", "Failed to save profile. Please try again.");
      console.error("Error saving profile:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    // Reset to the last saved values instead of hardcoded original values
    setUserName(savedUserName);
    setUserAge(savedUserAge);
    setUserDescription(savedUserDescription);
    setProfileImage(savedProfileImage);
    setIsEditing(false);
  };

  const SuccessModal = () => (
    <Modal
      animationType="fade"
      transparent={true}
      visible={showSuccessModal}
      onRequestClose={() => setShowSuccessModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalIcon}>
            <Text style={styles.checkIcon}>✓</Text>
          </View>
          <Text style={styles.modalTitle}>Success!</Text>
          <Text style={styles.modalMessage}>
            Your profile has been updated successfully
          </Text>
          <TouchableOpacity
            style={styles.modalButton}
            onPress={() => setShowSuccessModal(false)}
          >
            <Text style={styles.modalButtonText}>OK</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const ImagePickerModal = () => (
    <Modal
      animationType="fade"
      transparent={true}
      visible={showImagePickerModal}
      onRequestClose={() => setShowImagePickerModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.imagePickerIcon}>
            <Text style={styles.cameraIcon}>📷</Text>
          </View>
          <Text style={styles.modalTitle}>Select Image</Text>
          <Text style={styles.modalMessage}>
            Choose how you want to select your profile picture
          </Text>
          <View style={styles.imagePickerButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.imagePickerButton]}
              onPress={openCamera}
            >
              <Text style={styles.modalButtonText}>📸 Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.imagePickerButton]}
              onPress={openImageLibrary}
            >
              <Text style={styles.modalButtonText}>🖼️ Gallery</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.modalButton, styles.cancelModalButton]}
            onPress={() => setShowImagePickerModal(false)}
          >
            <Text style={styles.cancelModalButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <SafeAreaView>
        <Text style={styles.header}>My Profile</Text>
      </SafeAreaView>

      <ScrollView style={styles.viewPort}>
        <View style={styles.profileContainer}>
          {/* Profile Section */}
          <View style={styles.profileSection}>
            {!isEditing ? (
              <TouchableOpacity
                style={styles.editButton}
                onPress={handleEditPress}
                disabled={isLoading}
              >
                <Text style={styles.editButtonText}>Edit Profile</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.editButtonsContainer}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={handleCancel}
                  disabled={isLoading}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveButton, isLoading && styles.disabledButton]}
                  onPress={handleSave}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.profileImageContainer}>
              {!isEditing ? (
                <Image source={profileImage} style={styles.profileImage} />
              ) : (
                <TouchableOpacity
                  onPress={pickImage}
                  style={styles.editImageContainer}
                >
                  <Image source={profileImage} style={styles.profileImage} />
                  <View style={styles.editImageOverlay}>
                    <Text style={styles.editImageLabel}>Edit</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>

            {!isEditing ? (
              <>
                <Text style={styles.userName}>{userName}</Text>
                <Text style={styles.userAge}>{userAge}</Text>
                <Text style={styles.userDescription}>{userDescription}</Text>
              </>
            ) : (
              <>
                <TextInput
                  style={styles.editInput}
                  value={userName}
                  onChangeText={setUserName}
                  placeholder="Enter your name"
                  placeholderTextColor="#999"
                />
                <TextInput
                  style={styles.editInput}
                  value={userAge}
                  onChangeText={setUserAge}
                  placeholder="Enter your age"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                />
                <TextInput
                  style={[styles.editInput, styles.editDescriptionInput]}
                  value={userDescription}
                  onChangeText={setUserDescription}
                  placeholder="Enter your description"
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={4}
                />
              </>
            )}
          </View>

          {/* Photo Gallery Section */}
          <View style={styles.gallerySection}>
            <Text style={styles.galleryTitle}>Photo Gallery</Text>
            <View style={styles.galleryGrid}>
              <View style={styles.galleryItem}></View>
              <View style={styles.galleryItem}></View>
              <View style={styles.galleryItem}></View>
              <View style={styles.galleryItem}></View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Custom Success Modal */}
      <SuccessModal />

      {/* Custom Image Picker Modal */}
      <ImagePickerModal />

      {/* Loading Overlay */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#335C67" />
            <Text style={styles.loadingText}>Saving...</Text>
          </View>
        </View>
      )}

      {/* Error Display */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={clearError} style={styles.errorButton}>
            <Text style={styles.errorButtonText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const data = [];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#335C67",
  },
  header: {
    fontSize: 30,
    fontFamily: "Inder",
    color: "#fff",
    textAlign: "center",
    marginBottom: -30,
  },
  viewPort: {
    backgroundColor: "#FFFFFF",
    flex: 1,
    borderTopLeftRadius: 50,
    borderTopRightRadius: 50,
    paddingTop: 30,
  },
  profileContainer: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  profileSection: {
    alignItems: "center",
    marginBottom: 40,
    backgroundColor: "#E9F5F0",
    borderRadius: 30,
    padding: 30,
    position: "relative",
  },
  editButton: {
    position: "absolute",
    top: 20,
    right: 20,
    backgroundColor: "#335C67",
    borderRadius: 15,
    paddingHorizontal: 15,
    paddingVertical: 8,
    zIndex: 1,
  },
  editButtonText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inder",
  },
  editButtonsContainer: {
    position: "absolute",
    top: 20,
    right: 20,
    flexDirection: "row",
    gap: 10,
    zIndex: 1,
  },
  cancelButton: {
    backgroundColor: "#FF6B6B",
    borderRadius: 15,
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  cancelButtonText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inder",
  },
  saveButton: {
    backgroundColor: "#4CAF50",
    borderRadius: 15,
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inder",
  },
  editInput: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#335C67",
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginBottom: 15,
    fontSize: 16,
    fontFamily: "Inder",
    color: "#335C67",
    textAlign: "center",
    minWidth: 200,
  },
  editDescriptionInput: {
    textAlign: "left",
    minHeight: 80,
    textAlignVertical: "top",
  },
  profileImageContainer: {
    marginTop: 20,
    marginBottom: 20,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: "#335C67",
  },
  editImageContainer: {
    position: "relative",
  },
  editImageOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  editImageLabel: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inder",
    fontWeight: "bold",
  },
  userName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#335C67",
    marginBottom: 5,
    fontFamily: "Inder",
  },
  userAge: {
    fontSize: 20,
    color: "#335C67",
    marginBottom: 15,
    fontFamily: "Inder",
  },
  userDescription: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 10,
    fontFamily: "Inder",
  },
  gallerySection: {
    marginBottom: 30,
  },
  galleryTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#335C67",
    marginBottom: 20,
    textAlign: "center",
    fontFamily: "Inder",
  },
  galleryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
    backgroundColor: "#E9F5F0",
    borderRadius: 20,
    padding: 20,
  },
  galleryItem: {
    width: 150,
    height: 150,
    backgroundColor: "#C5D9D1",
    borderRadius: 15,
    marginBottom: 10,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    backgroundColor: "#fff",
    borderRadius: 25,
    padding: 30,
    alignItems: "center",
    marginHorizontal: 40,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#4CAF50",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  checkIcon: {
    fontSize: 40,
    color: "#fff",
    fontWeight: "bold",
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#335C67",
    marginBottom: 10,
    fontFamily: "Inder",
  },
  modalMessage: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 25,
    lineHeight: 22,
    fontFamily: "Inder",
  },
  modalButton: {
    backgroundColor: "#335C67",
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 30,
    minWidth: 100,
  },
  modalButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
    fontFamily: "Inder",
  },
  // Image Picker Modal styles
  imagePickerIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#335C67",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  cameraIcon: {
    fontSize: 40,
    color: "#fff",
  },
  imagePickerButtons: {
    flexDirection: "row",
    gap: 15,
    marginBottom: 15,
  },
  imagePickerButton: {
    backgroundColor: "#335C67",
    flex: 1,
  },
  cancelModalButton: {
    backgroundColor: "#FF6B6B",
    minWidth: 120,
  },
  cancelModalButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
    fontFamily: "Inder",
  },
  // Loading and Error styles
  disabledButton: {
    opacity: 0.6,
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  loadingContainer: {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 20,
    alignItems: "center",
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#335C67",
    fontFamily: "Inder",
  },
  errorContainer: {
    position: "absolute",
    top: 100,
    left: 20,
    right: 20,
    backgroundColor: "#FF6B6B",
    borderRadius: 10,
    padding: 15,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 999,
  },
  errorText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inder",
    flex: 1,
  },
  errorButton: {
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    borderRadius: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  errorButtonText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inder",
  },
});

export default ProfileScreen;
