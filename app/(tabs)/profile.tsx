import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLoadingState } from "../../hooks/useLoadingState";
import { ProfileAPIBase64 } from "../../lib/profileAPIBase64";
import { UserBadgeWithDetails } from "../../lib/supabase";

const ProfileScreen = () => {
  const router = useRouter();
  
  // Generate a consistent UUID for demo purposes
  // In a real app, this would come from authentication
  const USER_ID = "550e8400-e29b-41d4-a716-446655440000"; // Valid UUID format

  const [isEditing, setIsEditing] = useState(false);
  const [userName, setUserName] = useState("Vince Mojzer");
  const [userAge, setUserAge] = useState("18");
  const [userDescription, setUserDescription] = useState(
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore"
  );
  const [userExperience, setUserExperience] = useState("3");
  const [isProMember, setIsProMember] = useState(true);

  // Store the saved values to revert to when canceling
  const [savedUserName, setSavedUserName] = useState("Vince Mojzer");
  const [savedUserAge, setSavedUserAge] = useState("18");
  const [savedUserDescription, setSavedUserDescription] = useState(
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore"
  );
  const [savedUserExperience, setSavedUserExperience] = useState("3");
  const [savedIsProMember, setSavedIsProMember] = useState(true);

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
  const { isLoading, error, setLoading, setError, clearError } =
    useLoadingState();

  // Refresh state
  const [refreshing, setRefreshing] = useState(false);

  // Badges state
  const [userBadges, setUserBadges] = useState<UserBadgeWithDetails[]>([]);
  const [badgesLoading, setBadgesLoading] = useState(false);
  const [badgeStats, setBadgeStats] = useState({
    totalBadges: 0,
    legendaryBadges: 0,
    epicBadges: 0,
    rareBadges: 0,
    commonBadges: 0,
    categories: {} as { [key: string]: number }
  });

  // Function to determine membership status based on database value only
  const determineMembershipStatus = (databaseProStatus: boolean) => {
    // Logic: Pro member only if database explicitly says true
    return databaseProStatus === true;
  };

  // Function to get membership display text
  const getMembershipDisplayText = (isProMember: boolean) => {
    return isProMember ? "PRO MEMBER" : "RIDER";
  };

  // Load profile data on component mount
  useEffect(() => {
    initializeProfile();
  }, []);

  const initializeProfile = async () => {
    // First verify database connection
    const isConnected = await ProfileAPIBase64.verifyDatabaseConnection();
    if (!isConnected) {
      setError("Database connection failed. Please check your internet connection.");
      return;
    }
    
    // Then load profile data
    await loadProfile();
    
    // Load user badges and check eligibility
    await loadUserBadges();
  };

  const loadUserBadges = async () => {
    setBadgesLoading(true);
    try {
      console.log('Loading badges for user:', USER_ID);
      
      // Load user badges
      const badges = await ProfileAPIBase64.getUserBadges(USER_ID);
      console.log('Loaded badges:', badges);
      setUserBadges(badges);

      // Load badge statistics
      const stats = await ProfileAPIBase64.getUserBadgeStats(USER_ID);
      console.log('Loaded badge stats:', stats);
      setBadgeStats(stats);

      // Check for new badge eligibility
      const newBadges = await ProfileAPIBase64.checkBadgeEligibility(USER_ID);
      if (newBadges.length > 0) {
        console.log('New badges awarded:', newBadges);
        
        // Reload badges if new ones were awarded
        const updatedBadges = await ProfileAPIBase64.getUserBadges(USER_ID);
        setUserBadges(updatedBadges);
        
        const updatedStats = await ProfileAPIBase64.getUserBadgeStats(USER_ID);
        setBadgeStats(updatedStats);

        // Show alert for new badges
        Alert.alert(
          "New Badge Earned! 🎉",
          `Congratulations! You earned: ${newBadges.join(', ')}`,
          [{ text: "Awesome!", style: "default" }]
        );
      }
    } catch (error) {
      console.error('Error loading user badges:', error);
      setError('Failed to load badges. Please try again.');
    } finally {
      setBadgesLoading(false);
    }
  };

  const loadProfile = async () => {
    setLoading(true);
    clearError();

    try {
      let profile = await ProfileAPIBase64.getProfile(USER_ID);

      // If profile doesn't exist, create it with default values
      if (!profile) {
        console.log("Profile not found, creating new profile...");
        const experienceValue = parseInt(userExperience);
        const calculatedProStatus = ProfileAPIBase64.determineMembershipStatus(experienceValue, isProMember);
        
        profile = await ProfileAPIBase64.createProfile(USER_ID, {
          name: userName,
          age: parseInt(userAge),
          description: userDescription,
          experience: experienceValue,
          is_pro_member: calculatedProStatus,
        });

        if (!profile) {
          throw new Error("Failed to create profile");
        }
      }

      // Update state with loaded/created profile data
      const loadedExperience = profile.experience || 0;
      const loadedProStatus = profile.is_pro_member || false;
      
      // Determine final membership status based on database value
      const finalProStatus = determineMembershipStatus(loadedProStatus);
      
      setUserName(profile.name);
      setUserAge(profile.age.toString());
      setUserDescription(profile.description);
      setUserExperience(loadedExperience.toString());
      setIsProMember(finalProStatus);
      setSavedUserName(profile.name);
      setSavedUserAge(profile.age.toString());
      setSavedUserDescription(profile.description);
      setSavedUserExperience(loadedExperience.toString());
      setSavedIsProMember(finalProStatus);

      if (profile.profile_image_url) {
        setProfileImage({ uri: profile.profile_image_url });
        setSavedProfileImage({ uri: profile.profile_image_url });
      } else {
        // Reset to default image if no profile image URL
        setProfileImage(require("../../assets/images/horses/falko.png"));
        setSavedProfileImage(require("../../assets/images/horses/falko.png"));
      }
    } catch (err) {
      setError("Failed to load profile");
      console.error("Error loading profile:", err);
    } finally {
      setLoading(false);
    }
  };

  // Refresh function for pull-to-refresh
  const onRefresh = async () => {
    setRefreshing(true);
    clearError();

    try {
      console.log("Refreshing profile data...");
      let profile = await ProfileAPIBase64.getProfile(USER_ID);

      if (profile) {
        // Update state with refreshed profile data
        const loadedExperience = profile.experience || 0;
        const loadedProStatus = profile.is_pro_member || false;
        
        // Determine final membership status based on database value
        const finalProStatus = determineMembershipStatus(loadedProStatus);
        
        setUserName(profile.name);
        setUserAge(profile.age.toString());
        setUserDescription(profile.description);
        setUserExperience(loadedExperience.toString());
        setIsProMember(finalProStatus);
        setSavedUserName(profile.name);
        setSavedUserAge(profile.age.toString());
        setSavedUserDescription(profile.description);
        setSavedUserExperience(loadedExperience.toString());
        setSavedIsProMember(finalProStatus);

        if (profile.profile_image_url) {
          setProfileImage({ uri: profile.profile_image_url });
          setSavedProfileImage({ uri: profile.profile_image_url });
        } else {
          // Reset to default image if no profile image URL
          setProfileImage(require("../../assets/images/horses/falko.png"));
          setSavedProfileImage(require("../../assets/images/horses/falko.png"));
        }
        
        // Reload badges after refreshing profile
        await loadUserBadges();
      }
    } catch (err) {
      setError("Failed to refresh profile");
      console.error("Error refreshing profile:", err);
    } finally {
      setRefreshing(false);
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
      mediaTypes: ["images"],
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
      mediaTypes: ["images"],
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
    if (userExperience.trim() === "" || isNaN(Number(userExperience))) {
      Alert.alert("Error", "Please enter a valid experience number");
      return;
    }

    setLoading(true);
    clearError();

    try {
      // Upload profile image if it's a new image (different from saved)
      let profileImageUrl = null;

      // Check if profileImage is a URI object (not a require() number)
      const isCurrentImageUri =
        profileImage && typeof profileImage === "object" && profileImage.uri;
      const isSavedImageUri =
        savedProfileImage &&
        typeof savedProfileImage === "object" &&
        savedProfileImage.uri;

      // Determine if we have a new image to upload
      const hasNewImage =
        isCurrentImageUri &&
        (!isSavedImageUri || profileImage.uri !== savedProfileImage.uri);

      if (hasNewImage) {
        profileImageUrl = await ProfileAPIBase64.uploadProfileImageBase64(
          USER_ID,
          profileImage.uri
        );
        if (!profileImageUrl) {
          throw new Error("Failed to upload profile image");
        }
      }

      // Prepare profile data - preserve existing image URL if no new image uploaded
      const experienceValue = parseInt(userExperience);
      // Keep the current pro status from state (which came from database)
      const finalProStatus = isProMember;
      
      const updateData: any = {
        name: userName,
        age: parseInt(userAge),
        description: userDescription,
        experience: experienceValue,
        is_pro_member: finalProStatus,
      };

      // Include image URL: new uploaded URL or existing URL
      if (profileImageUrl) {
        // New image was uploaded
        updateData.profile_image_url = profileImageUrl;
      } else if (isSavedImageUri) {
        // Keep existing image URL if user hasn't changed the image
        updateData.profile_image_url = savedProfileImage.uri;
      }

      // First, let's test a simple experience update
      const simpleUpdateSuccess = await ProfileAPIBase64.updateExperienceOnly(USER_ID, experienceValue);

      // Update profile data using the enhanced function with membership logic
      const success = await ProfileAPIBase64.updateProfileWithMembershipLogic(USER_ID, updateData);

      if (!success) {
        throw new Error("Failed to update profile");
      }

      // Update saved values with the current edited values
      setSavedUserName(userName);
      setSavedUserAge(userAge);
      setSavedUserDescription(userDescription);
      setSavedUserExperience(userExperience);
      setSavedIsProMember(finalProStatus);
      
      // Also update current state to reflect the calculated pro status
      setIsProMember(finalProStatus);

      // Update saved image: use new uploaded URL or keep current image
      if (profileImageUrl) {
        setSavedProfileImage({ uri: profileImageUrl });
        setProfileImage({ uri: profileImageUrl });
      } else {
        setSavedProfileImage(profileImage);
      }

      setIsEditing(false);
      setShowSuccessModal(true);
      
      // Check for new badges after successful save
      await loadUserBadges();
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
    setUserExperience(savedUserExperience);
    setIsProMember(savedIsProMember);
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
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.headerContainer}>
          <Text style={styles.header}>My Profile</Text>
          <TouchableOpacity 
            style={styles.optionsButton}
            onPress={() => router.push("/(tabs)/options")}
          >
            <Image 
              source={require("../../assets/UI_resources/UI_white/settings_white.png")}
              style={styles.optionsIcon}
            />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.viewPort}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
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
              <>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={handleCancel}
                  disabled={isLoading}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleSave}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save</Text>
                  )}
                </TouchableOpacity>
              </>
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
                <View style={styles.experienceContainer}>
                  <Text style={styles.experienceLabel}>Experience</Text>
                  <Text style={styles.experienceValue}>{userExperience} years</Text>
                </View>
                <View style={styles.badgeContainer}>
                  <View style={[styles.badge, isProMember ? styles.proBadge : styles.regularBadge]}>
                    <Text style={[styles.badgeText, isProMember ? styles.proBadgeText : styles.regularBadgeText]}>
                      {getMembershipDisplayText(isProMember)}
                    </Text>
                  </View>
                </View>
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
                <TextInput
                  style={styles.editInput}
                  value={userExperience}
                  onChangeText={setUserExperience}
                  placeholder="Years of experience"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                />
              </>
            )}
          </View>

          {/* Badges Section */}
          <View style={styles.badgesSection}>
            <View style={styles.badgesHeader}>
              <Text style={styles.badgesTitle}>Achievements & Badges</Text>
              <View style={styles.badgeStatsContainer}>
                <Text style={styles.badgeStatsText}>
                  {badgeStats.totalBadges} badges earned
                </Text>
              </View>
            </View>
            
            {badgesLoading ? (
              <View style={styles.badgesLoadingContainer}>
                <ActivityIndicator size="large" color="#335C67" />
                <Text style={styles.badgesLoadingText}>Loading badges...</Text>
              </View>
            ) : userBadges.length > 0 ? (
              <View style={styles.badgesGrid}>
                {userBadges.map((userBadge, index) => (
                  <View key={userBadge.id} style={styles.badgeItem}>
                    <View style={[
                      styles.badgeIcon, 
                      userBadge.badge.rarity === 'legendary' && styles.legendaryBadge,
                      userBadge.badge.rarity === 'epic' && styles.epicBadge,
                      userBadge.badge.rarity === 'rare' && styles.rareBadge,
                      userBadge.badge.rarity === 'common' && styles.commonBadge
                    ]}>
                      <Text style={styles.badgeEmoji}>{userBadge.badge.icon_emoji}</Text>
                    </View>
                    <Text style={styles.badgeLabel} numberOfLines={2}>
                      {userBadge.badge.name}
                    </Text>
                    <Text style={styles.badgeRarity}>
                      {userBadge.badge.rarity.toUpperCase()}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.noBadgesContainer}>
                <Text style={styles.noBadgesEmoji}>🏆</Text>
                <Text style={styles.noBadgesText}>No badges yet!</Text>
                <Text style={styles.noBadgesSubtext}>
                  Complete your profile and participate in activities to earn badges.
                </Text>
              </View>
            )}
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
  safeArea: {
    backgroundColor: "#335C67",
    paddingBottom: 5,
  },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    marginBottom: -20,
  },
  header: {
    fontSize: 30,
    fontFamily: "Inder",
    color: "#fff",
    textAlign: "center",
    flex: 1,
    fontWeight: "600",
  },
  optionsButton: {
    position: "absolute",
    right: 20,
    padding: 10,
    borderRadius: 20,
    minWidth: 40,
    minHeight: 40,
    marginTop: 10,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    zIndex: 10,
  },
  optionsIcon: {
    width: 24,
    height: 24,
    tintColor: "#fff",
  },
  backButton: {
    position: "absolute",
    left: 20,
    padding: 5,
  },
  backIcon: {
    fontSize: 24,
    color: "#fff",
  },
  optionsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#335C67",
    marginBottom: 15,
    fontFamily: "Inder",
  },
  sectionContent: {
    backgroundColor: "#E9F5F0",
    borderRadius: 20,
    padding: 5,
  },
  settingItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#C5D9D1",
  },
  settingInfo: {
    flex: 1,
    marginRight: 15,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#335C67",
    fontFamily: "Inder",
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 14,
    color: "#666",
    fontFamily: "Inder",
  },
  actionButton: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#C5D9D1",
  },
  actionButtonText: {
    fontSize: 16,
    color: "#335C67",
    fontFamily: "Inder",
    fontWeight: "500",
  },
  logoutButton: {
    backgroundColor: "#FF9800",
    borderRadius: 15,
    marginVertical: 5,
    borderBottomWidth: 0,
  },
  logoutButtonText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "bold",
  },
  viewPort: {
    backgroundColor: "#FFFFFF",
    flex: 1,
    borderTopLeftRadius: 50,
    borderTopRightRadius: 50,
    marginTop: 5,
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
    position: "absolute",
    left: 20,
    top: 20,
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
    position: "absolute",
    right: 20,
    top: 20,
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
    marginBottom: 15,
  },
  experienceContainer: {
    alignItems: "center",
    marginBottom: 15,
  },
  experienceLabel: {
    fontSize: 12,
    color: "#666",
    fontFamily: "Inder",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  experienceValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#335C67",
    fontFamily: "Inder",
    marginTop: 2,
  },
  badgeContainer: {
    alignItems: "center",
    marginTop: 5,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    borderWidth: 1,
  },
  proBadge: {
    backgroundColor: "#FFD700",
    borderColor: "#FFA500",
  },
  regularBadge: {
    backgroundColor: "#E3F2FD",
    borderColor: "#2196F3",
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "bold",
    fontFamily: "Inder",
    letterSpacing: 0.5,
  },
  proBadgeText: {
    color: "#B8860B",
  },
  regularBadgeText: {
    color: "#1976D2",
  },
  badgesSection: {
    marginBottom: 30,
  },
  badgesHeader: {
    marginBottom: 20,
  },
  badgesTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#335C67",
    textAlign: "center",
    fontFamily: "Inder",
    marginBottom: 8,
  },
  badgeStatsContainer: {
    alignItems: "center",
  },
  badgeStatsText: {
    fontSize: 14,
    color: "#666",
    fontFamily: "Inder",
    textAlign: "center",
  },
  badgesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
    backgroundColor: "#E9F5F0",
    borderRadius: 20,
    padding: 20,
    gap: 15,
  },
  badgeItem: {
    alignItems: "center",
    width: 90,
    marginBottom: 15,
  },
  badgeIcon: {
    width: 60,
    height: 60,
    backgroundColor: "#335C67",
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3,
  },
  legendaryBadge: {
    backgroundColor: "#FFD700",
    borderWidth: 2,
    borderColor: "#FFA500",
  },
  epicBadge: {
    backgroundColor: "#9C27B0",
    borderWidth: 2,
    borderColor: "#7B1FA2",
  },
  rareBadge: {
    backgroundColor: "#2196F3",
    borderWidth: 2,
    borderColor: "#1976D2",
  },
  commonBadge: {
    backgroundColor: "#4CAF50",
    borderWidth: 2,
    borderColor: "#388E3C",
  },
  badgeEmoji: {
    fontSize: 24,
    color: "#fff",
  },
  badgeLabel: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#335C67",
    fontFamily: "Inder",
    textAlign: "center",
    lineHeight: 14,
    marginBottom: 2,
  },
  badgeRarity: {
    fontSize: 8,
    color: "#666",
    fontFamily: "Inder",
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  noBadgesContainer: {
    backgroundColor: "#E9F5F0",
    borderRadius: 20,
    padding: 40,
    alignItems: "center",
  },
  noBadgesEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  noBadgesText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#335C67",
    fontFamily: "Inder",
    marginBottom: 8,
  },
  noBadgesSubtext: {
    fontSize: 14,
    color: "#666",
    fontFamily: "Inder",
    textAlign: "center",
    lineHeight: 20,
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
  badgesLoadingContainer: {
    paddingVertical: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  badgesLoadingText: {
    marginTop: 15,
    fontSize: 16,
    color: "#666",
    fontFamily: "Inder",
  },
});

export default ProfileScreen;
