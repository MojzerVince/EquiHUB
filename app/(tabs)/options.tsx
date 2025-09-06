import { useAuth } from "@/contexts/AuthContext";
import { useDialog } from "@/contexts/DialogContext";
import { MetricSystem, useMetric } from "@/contexts/MetricContext";
import { ThemeName, useTheme } from "@/contexts/ThemeContext";
import { AuthAPI } from "@/lib/authAPI";
import { EmergencyContact, EmergencyContactsAPI } from "@/lib/emergencyContactsAPI";
import { HiddenPost, HiddenPostsManager } from "@/lib/hiddenPostsManager";
import { SMSTestUtility } from "@/lib/smsTestUtility";
import * as Contacts from "expo-contacts";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const OptionsScreen = () => {
  const router = useRouter();
  const { signOut, user } = useAuth();
  const { currentTheme, setTheme, availableThemes } = useTheme();
  const { metricSystem, setMetricSystem } = useMetric();
  const { showLogout, showConfirm, showError } = useDialog();

  // Settings state
  const [notifications, setNotifications] = useState(true);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // Load hidden posts when component mounts
  useEffect(() => {
    loadHiddenPosts();
    loadEmergencyContacts();
    checkContactsPermission();
  }, [user?.id]);

  // Reload hidden posts when screen is focused
  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        loadHiddenPosts();
        loadEmergencyContacts();
      }
    }, [user?.id])
  );

  // Load emergency contacts from storage
  const loadEmergencyContacts = useCallback(async () => {
    if (!user?.id) {
      setEmergencyContacts([]);
      return;
    }

    setLoadingEmergencyContacts(true);
    try {
      const contacts = await EmergencyContactsAPI.getEmergencyContacts(user.id);
      setEmergencyContacts(contacts);
    } catch (error) {
      console.error("Error loading emergency contacts:", error);
      setEmergencyContacts([]);
    } finally {
      setLoadingEmergencyContacts(false);
    }
  }, [user?.id]);

  // Check contacts permission status
  const checkContactsPermission = useCallback(async () => {
    try {
      const status = await EmergencyContactsAPI.getContactsPermissionStatus();
      setContactsPermissionStatus(status);
    } catch (error) {
      console.error("Error checking contacts permission:", error);
      setContactsPermissionStatus({ granted: false, canAskAgain: true });
    }
  }, []);

  // Request contacts permission
  const requestContactsPermission = async () => {
    try {
      const status = await EmergencyContactsAPI.requestContactsPermission();
      setContactsPermissionStatus(status);
      
      if (status.granted) {
        await loadDeviceContacts();
        Alert.alert("Permission Granted", "You can now access your contacts to add emergency contacts.");
      } else {
        Alert.alert(
          "Permission Denied",
          "To add emergency contacts from your phone, please grant contacts permission in your device settings."
        );
      }
    } catch (error) {
      console.error("Error requesting contacts permission:", error);
      Alert.alert("Error", "Failed to request contacts permission. Please try again.");
    }
  };

  // Load device contacts
  const loadDeviceContacts = async () => {
    try {
      const contacts = await EmergencyContactsAPI.getDeviceContacts();
      setDeviceContacts(contacts);
    } catch (error) {
      console.error("Error loading device contacts:", error);
      Alert.alert("Error", "Failed to load contacts. Please check your permissions.");
    }
  };

  // Add emergency contact
  const handleAddEmergencyContact = async (contact: Omit<EmergencyContact, "id" | "addedAt">) => {
    if (!user?.id) return;

    try {
      const result = await EmergencyContactsAPI.addEmergencyContact(user.id, contact);
      
      if (result.success) {
        await loadEmergencyContacts();
        setShowAddContact(false);
        setSearchQuery("");
        Alert.alert("Success", "Emergency contact added successfully.");
      } else {
        Alert.alert("Error", result.error || "Failed to add emergency contact.");
      }
    } catch (error) {
      console.error("Error adding emergency contact:", error);
      Alert.alert("Error", "Failed to add emergency contact. Please try again.");
    }
  };

  // Remove emergency contact
  const handleRemoveEmergencyContact = async (contactId: string) => {
    if (!user?.id) return;

    Alert.alert(
      "Remove Emergency Contact",
      "Are you sure you want to remove this emergency contact?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              const success = await EmergencyContactsAPI.removeEmergencyContact(user.id, contactId);
              if (success) {
                await loadEmergencyContacts();
                Alert.alert("Success", "Emergency contact removed successfully.");
              } else {
                Alert.alert("Error", "Failed to remove emergency contact. Please try again.");
              }
            } catch (error) {
              console.error("Error removing emergency contact:", error);
              Alert.alert("Error", "Failed to remove emergency contact. Please try again.");
            }
          },
        },
      ]
    );
  };

  // Toggle emergency contact enabled status
  const handleToggleEmergencyContact = async (contactId: string, isEnabled: boolean) => {
    if (!user?.id) return;

    try {
      const success = await EmergencyContactsAPI.toggleEmergencyContact(user.id, contactId, isEnabled);
      if (success) {
        await loadEmergencyContacts();
      } else {
        Alert.alert("Error", "Failed to update emergency contact. Please try again.");
      }
    } catch (error) {
      console.error("Error toggling emergency contact:", error);
      Alert.alert("Error", "Failed to update emergency contact. Please try again.");
    }
  };

  // Sync emergency contacts to database
  const syncContactsToDatabase = async () => {
    if (!user?.id) return;

    Alert.alert(
      "Sync Contacts to Database",
      "This will sync your emergency contacts to the database for server SMS functionality. This is required for reliable emergency alerts.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sync Now",
          onPress: async () => {
            try {
              await SMSTestUtility.syncContactsToDatabase(user.id);
              Alert.alert("✅ Sync Complete", "Emergency contacts have been synced to the database. Server SMS alerts are now fully configured.");
            } catch (error) {
              console.error("Error syncing contacts:", error);
              Alert.alert("Error", "Failed to sync contacts. Please try again.");
            }
          }
        }
      ]
    );
  };

  // Load hidden posts from storage
  const loadHiddenPosts = useCallback(async () => {
    if (!user?.id) {
      setHiddenPosts([]);
      return;
    }

    setLoadingHiddenPosts(true);
    try {
      const hidden = await HiddenPostsManager.getHiddenPosts(user.id);
      setHiddenPosts(hidden);
    } catch (error) {
      console.error("Error loading hidden posts:", error);
      setHiddenPosts([]);
    } finally {
      setLoadingHiddenPosts(false);
    }
  }, [user?.id]);

  // Unhide a specific post
  const handleUnhidePost = async (postId: string) => {
    if (!user?.id) return;

    try {
      const success = await HiddenPostsManager.unhidePost(user.id, postId);
      if (success) {
        setHiddenPosts((prev) => prev.filter((post) => post.id !== postId));
        Alert.alert("Success", "Post has been restored to your feed.");
      } else {
        Alert.alert("Error", "Failed to restore post. Please try again.");
      }
    } catch (error) {
      console.error("Error unhiding post:", error);
      Alert.alert("Error", "Failed to restore post. Please try again.");
    }
  };

  // Clear all hidden posts
  const handleClearAllHiddenPosts = async () => {
    if (!user?.id) return;

    Alert.alert(
      "Clear All Hidden Posts",
      "Are you sure you want to restore all hidden posts to your feed?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Restore All",
          style: "destructive",
          onPress: async () => {
            try {
              const success = await HiddenPostsManager.clearAllHiddenPosts(
                user.id
              );
              if (success) {
                setHiddenPosts([]);
                Alert.alert(
                  "Success",
                  "All hidden posts have been restored to your feed."
                );
              } else {
                Alert.alert(
                  "Error",
                  "Failed to restore posts. Please try again."
                );
              }
            } catch (error) {
              console.error("Error clearing hidden posts:", error);
              Alert.alert(
                "Error",
                "Failed to restore posts. Please try again."
              );
            }
          },
        },
      ]
    );
  };

  // Theme dropdown state
  const [themeDropdownVisible, setThemeDropdownVisible] = useState(false);

  // Metric system dropdown state
  const [metricDropdownVisible, setMetricDropdownVisible] = useState(false);

  // Hidden posts state
  const [hiddenPosts, setHiddenPosts] = useState<HiddenPost[]>([]);
  const [showHiddenPosts, setShowHiddenPosts] = useState(false);
  const [loadingHiddenPosts, setLoadingHiddenPosts] = useState(false);

  // Emergency contacts state
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [showEmergencyContacts, setShowEmergencyContacts] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [loadingEmergencyContacts, setLoadingEmergencyContacts] = useState(false);
  const [deviceContacts, setDeviceContacts] = useState<Contacts.Contact[]>([]);
  const [contactsPermissionStatus, setContactsPermissionStatus] = useState({ granted: false, canAskAgain: true });
  const [searchQuery, setSearchQuery] = useState("");

  const handleLogout = () => {
    showLogout(async () => {
      try {
        console.log("Starting logout process for user:", user?.email);
        await signOut();
        console.log("User logged out successfully");
        // ProtectedRoute will handle navigation automatically
      } catch (error) {
        console.error("Logout error:", error);
        showError("Failed to sign out. Please try again.");
      }
    });
  };

  const handleDeleteAccount = () => {
    if (isDeletingAccount) {
      return; // Prevent multiple deletion attempts
    }

    Alert.alert(
      "Delete Account",
      "⚠️ This action cannot be undone!\n\nDeleting your account will permanently remove:\n• Your profile and settings\n• All your horses and training data\n• Community posts and interactions\n• Photos and media uploads\n• Friend connections\n\nAre you absolutely sure you want to continue?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete Forever",
          style: "destructive",
          onPress: () => {
            // Second confirmation
            Alert.alert(
              "Final Confirmation",
              "This is your last chance to cancel.\n\nOnce deleted, your account cannot be recovered.",
              [
                {
                  text: "Cancel",
                  style: "cancel",
                },
                {
                  text: "DELETE ACCOUNT",
                  style: "destructive",
                  onPress: async () => {
                    setIsDeletingAccount(true);

                    try {
                      console.log("Starting account deletion process...");

                      const { success, error } = await AuthAPI.deleteAccount();

                      if (success) {
                        Alert.alert(
                          "Account Deleted",
                          "Your account has been permanently deleted. Thank you for using EquiHUB.",
                          [
                            {
                              text: "OK",
                              onPress: () => {
                                // The AuthContext will handle navigation automatically when user state clears
                                console.log(
                                  "Account deletion completed successfully"
                                );
                              },
                            },
                          ],
                          { cancelable: false }
                        );
                      } else {
                        showError(
                          error ||
                            "Failed to delete account. Please try again or contact support."
                        );
                      }
                    } catch (error) {
                      console.error("Account deletion error:", error);
                      showError(
                        "An unexpected error occurred. Please try again or contact support."
                      );
                    } finally {
                      setIsDeletingAccount(false);
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const handlePrivacyPolicy = async () => {
    const url = "https://sites.google.com/view/equihub-privacy/f%C5%91oldal";
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        showError("Unable to open the privacy policy page.");
      }
    } catch (error) {
      console.error("Error opening privacy policy:", error);
      showError("Failed to open the privacy policy page.");
    }
  };

  const handleRequestAllPermissions = async () => {
    try {
      let permissionsGranted = 0;
      let totalPermissions = 5; // Updated to include contacts
      let permissionResults = [];

      // Request Camera permission
      try {
        const cameraResult = await ImagePicker.requestCameraPermissionsAsync();
        if (cameraResult.granted) {
          permissionsGranted++;
          permissionResults.push("✅ Camera access granted");
        } else {
          permissionResults.push("❌ Camera access denied");
        }
      } catch (error) {
        permissionResults.push("❌ Camera permission failed");
      }

      // Request Media Library permission
      try {
        const mediaResult =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (mediaResult.granted) {
          permissionsGranted++;
          permissionResults.push("✅ Photo library access granted");
        } else {
          permissionResults.push("❌ Photo library access denied");
        }
      } catch (error) {
        permissionResults.push("❌ Photo library permission failed");
      }

      // Request Location permission
      try {
        const locationResult =
          await Location.requestForegroundPermissionsAsync();
        if (locationResult.granted) {
          permissionsGranted++;
          permissionResults.push("✅ Location access granted");
        } else {
          permissionResults.push("❌ Location access denied");
        }
      } catch (error) {
        permissionResults.push("❌ Location permission failed");
      }

      // Request Contacts permission
      try {
        const contactsResult = await EmergencyContactsAPI.requestContactsPermission();
        if (contactsResult.granted) {
          permissionsGranted++;
          permissionResults.push("✅ Contacts access granted");
          // Update local state
          setContactsPermissionStatus(contactsResult);
        } else {
          permissionResults.push("❌ Contacts access denied");
        }
      } catch (error) {
        permissionResults.push("❌ Contacts permission failed");
      }

      // Request Notification permission
      try {
        const notificationResult =
          await Notifications.requestPermissionsAsync();
        if (notificationResult.granted) {
          permissionsGranted++;
          permissionResults.push("✅ Notification access granted");
        } else {
          permissionResults.push("❌ Notification access denied");
        }
      } catch (error) {
        permissionResults.push("❌ Notification permission failed");
      }

      // Show results
      const resultMessage = permissionResults.join("\n\n");
      const title =
        permissionsGranted === totalPermissions
          ? "All Permissions Granted!"
          : `${permissionsGranted}/${totalPermissions} Permissions Granted`;

      showConfirm(
        title,
        resultMessage +
          "\n\nNote: Some permissions may require you to go to your device settings if they were previously denied.",
        () => {}
      );
    } catch (error) {
      console.error("Error requesting permissions:", error);
      showError("Failed to request permissions. Please try again.");
    }
  };

  const SettingItem = ({
    title,
    subtitle,
    value,
    onValueChange,
    type = "switch",
    dropdownValue,
    dropdownOptions,
    onDropdownSelect,
    dropdownVisible,
    setDropdownVisible,
  }: {
    title: string;
    subtitle?: string;
    value?: boolean;
    onValueChange?: (value: boolean) => void;
    type?: "switch" | "button" | "dropdown";
    dropdownValue?: string;
    dropdownOptions?: string[];
    onDropdownSelect?: (value: string) => void;
    dropdownVisible?: boolean;
    setDropdownVisible?: (visible: boolean) => void;
  }) => (
    <View
      style={[
        styles.settingItem,
        { borderBottomColor: currentTheme.colors.accent },
      ]}
    >
      <View style={styles.settingInfo}>
        <Text
          style={[styles.settingTitle, { color: currentTheme.colors.text }]}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[
              styles.settingSubtitle,
              { color: currentTheme.colors.textSecondary },
            ]}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {type === "switch" ? (
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{
            false: currentTheme.colors.accent,
            true: currentTheme.colors.primary,
          }}
          thumbColor={value ? "#fff" : "#f4f3f4"}
        />
      ) : null}
      {type === "dropdown" ? (
        <TouchableOpacity
          style={[
            styles.dropdownButton,
            { borderColor: currentTheme.colors.border },
          ]}
          onPress={() =>
            setDropdownVisible && setDropdownVisible(!dropdownVisible)
          }
        >
          <Text
            style={[
              styles.dropdownButtonText,
              { color: currentTheme.colors.text },
            ]}
          >
            {dropdownValue}
          </Text>
          <Text
            style={[styles.dropdownArrow, { color: currentTheme.colors.text }]}
          >
            {dropdownVisible ? "▲" : "▼"}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  const ActionButton = ({
    title,
    onPress,
    style,
    textStyle,
    disabled = false,
    showLoading = false,
  }: {
    title: string;
    onPress: () => void;
    style?: any;
    textStyle?: any;
    disabled?: boolean;
    showLoading?: boolean;
  }) => (
    <TouchableOpacity
      style={[
        styles.actionButton,
        { borderBottomColor: currentTheme.colors.accent },
        style,
        disabled && styles.disabledButton,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <View style={styles.actionButtonContent}>
        {showLoading && (
          <ActivityIndicator
            size="small"
            color="#fff"
            style={styles.actionButtonLoader}
          />
        )}
        <Text
          style={[
            styles.actionButtonText,
            { color: currentTheme.colors.text },
            textStyle,
          ]}
        >
          {title}
        </Text>
      </View>
    </TouchableOpacity>
  );

  // Theme Dropdown Modal
  const ThemeDropdownModal = () => (
    <Modal
      transparent={true}
      visible={themeDropdownVisible}
      animationType="fade"
      onRequestClose={() => setThemeDropdownVisible(false)}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        onPress={() => setThemeDropdownVisible(false)}
      >
        <View
          style={[
            styles.dropdownModal,
            { backgroundColor: currentTheme.colors.card },
          ]}
        >
          <Text style={[styles.dropdownModalTitle, { color: "#fff" }]}>
            Select Theme
          </Text>
          <ScrollView style={styles.dropdownModalContent}>
            {availableThemes.map((theme, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.dropdownOption,
                  {
                    borderBottomColor: "rgba(255, 255, 255, 0.1)",
                    backgroundColor:
                      currentTheme.name === theme
                        ? "rgba(255, 255, 255, 0.1)"
                        : "transparent",
                  },
                ]}
                onPress={() => {
                  setTheme(theme as ThemeName);
                  setThemeDropdownVisible(false);
                }}
              >
                <Text
                  style={[
                    styles.dropdownOptionText,
                    {
                      color: "#fff",
                      fontWeight:
                        currentTheme.name === theme ? "bold" : "normal",
                    },
                  ]}
                >
                  {theme}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  // Metric System Dropdown Modal
  const MetricDropdownModal = () => {
    const metricOptions = ["Metric", "Imperial"];
    const currentMetricDisplay =
      metricSystem === "metric" ? "Metric" : "Imperial";

    return (
      <Modal
        transparent={true}
        visible={metricDropdownVisible}
        animationType="fade"
        onRequestClose={() => setMetricDropdownVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={() => setMetricDropdownVisible(false)}
        >
          <View
            style={[
              styles.dropdownModal,
              { backgroundColor: currentTheme.colors.card },
            ]}
          >
            <Text style={[styles.dropdownModalTitle, { color: "#fff" }]}>
              Select Measurement System
            </Text>
            <ScrollView style={styles.dropdownModalContent}>
              {metricOptions.map((option, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.dropdownOption,
                    {
                      borderBottomColor: "rgba(255, 255, 255, 0.1)",
                      backgroundColor:
                        currentMetricDisplay === option
                          ? "rgba(255, 255, 255, 0.1)"
                          : "transparent",
                    },
                  ]}
                  onPress={() => {
                    setMetricSystem(option.toLowerCase() as MetricSystem);
                    setMetricDropdownVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.dropdownOptionText,
                      {
                        color: "#fff",
                        fontWeight:
                          currentMetricDisplay === option ? "bold" : "normal",
                      },
                    ]}
                  >
                    {option}
                    {option === "Metric" && (
                      <Text
                        style={[
                          styles.dropdownOptionDescription,
                          { color: "rgba(255, 255, 255, 0.7)" },
                        ]}
                      >
                        {"\n"}km, m/s, °C, kg
                      </Text>
                    )}
                    {option === "Imperial" && (
                      <Text
                        style={[
                          styles.dropdownOptionDescription,
                          { color: "rgba(255, 255, 255, 0.7)" },
                        ]}
                      >
                        {"\n"}mi, mph, °F, lbs
                      </Text>
                    )}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: currentTheme.colors.primary },
      ]}
    >
      <SafeAreaView
        style={[
          styles.safeArea,
          { backgroundColor: currentTheme.colors.primary },
        ]}
      >
        <View style={styles.headerContainer}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.push("/(tabs)/profile")}
            activeOpacity={0.7}
          >
            <Image
              source={require("../../assets/UI_resources/UI_white/arrow_white.png")}
              style={styles.backIcon}
            />
          </TouchableOpacity>
          <Text style={styles.header}>Options</Text>
        </View>
      </SafeAreaView>

      <ScrollView
        style={[
          styles.viewPort,
          { backgroundColor: currentTheme.colors.background },
        ]}
      >
        <View style={styles.optionsContainer}>
          {/* Account Settings Section */}
          <View style={styles.section}>
            <Text
              style={[styles.sectionTitle, { color: currentTheme.colors.text }]}
            >
              Account
            </Text>
            <View
              style={[
                styles.sectionContent,
                { backgroundColor: currentTheme.colors.surface },
              ]}
            >
              <ActionButton
                title={`Emergency Contacts (${emergencyContacts.length}/5)`}
                onPress={() => setShowEmergencyContacts(true)}
              />
            </View>
          </View>

          {/* Privacy Settings Section */}
          <View style={styles.section}>
            <Text
              style={[styles.sectionTitle, { color: currentTheme.colors.text }]}
            >
              Privacy
            </Text>
            <View
              style={[
                styles.sectionContent,
                { backgroundColor: currentTheme.colors.surface },
              ]}
            >
              <SettingItem
                title="Push Notifications"
                subtitle="Receive notifications about activities"
                value={notifications}
                onValueChange={setNotifications}
              />
            </View>
          </View>

          {/* Hidden Posts Section */}
          <View style={styles.section}>
            <Text
              style={[styles.sectionTitle, { color: currentTheme.colors.text }]}
            >
              Hidden Content
            </Text>
            <View
              style={[
                styles.sectionContent,
                { backgroundColor: currentTheme.colors.surface },
              ]}
            >
              <ActionButton
                title={`Hidden Posts (${hiddenPosts.length})`}
                onPress={() => setShowHiddenPosts(true)}
              />
              {hiddenPosts.length > 0 && (
                <ActionButton
                  title="Clear All Hidden Posts"
                  onPress={handleClearAllHiddenPosts}
                  textStyle={{ color: currentTheme.colors.warning }}
                />
              )}
            </View>
          </View>

          {/* App Settings Section */}
          <View style={styles.section}>
            <Text
              style={[styles.sectionTitle, { color: currentTheme.colors.text }]}
            >
              App Settings
            </Text>
            <View
              style={[
                styles.sectionContent,
                { backgroundColor: currentTheme.colors.surface },
              ]}
            >
              <SettingItem
                title="Theme"
                subtitle="Choose your preferred color theme"
                type="dropdown"
                dropdownValue={currentTheme.name}
                dropdownOptions={availableThemes}
                onDropdownSelect={(theme) => setTheme(theme as ThemeName)}
                dropdownVisible={themeDropdownVisible}
                setDropdownVisible={setThemeDropdownVisible}
              />
              <SettingItem
                title="Measurement System"
                subtitle="Choose between metric and imperial units"
                type="dropdown"
                dropdownValue={
                  metricSystem === "metric" ? "Metric" : "Imperial"
                }
                dropdownOptions={["Metric", "Imperial"]}
                onDropdownSelect={(system) =>
                  setMetricSystem(system.toLowerCase() as MetricSystem)
                }
                dropdownVisible={metricDropdownVisible}
                setDropdownVisible={setMetricDropdownVisible}
              />
              <ActionButton
                title="Request All Permissions"
                onPress={handleRequestAllPermissions}
              />
            </View>
          </View>

          {/* General Actions Section */}
          <View style={styles.section}>
            <Text
              style={[styles.sectionTitle, { color: currentTheme.colors.text }]}
            >
              General
            </Text>
            <View
              style={[
                styles.sectionContent,
                { backgroundColor: currentTheme.colors.surface },
              ]}
            >
              <ActionButton
                title="About"
                onPress={() => console.log("About pressed")}
              />
              <ActionButton
                title="Help & Support"
                onPress={() => console.log("Help pressed")}
              />
              <ActionButton
                title="Terms of Service"
                onPress={() => console.log("Terms pressed")}
              />
              <ActionButton
                title="Privacy Policy"
                onPress={handlePrivacyPolicy}
              />
            </View>
          </View>

          {/* Account Actions Section */}
          <View style={styles.section}>
            <Text
              style={[styles.sectionTitle, { color: currentTheme.colors.text }]}
            >
              Account Actions
            </Text>
            <View
              style={[
                styles.sectionContent,
                { backgroundColor: currentTheme.colors.surface },
              ]}
            >
              <ActionButton
                title="Logout"
                onPress={handleLogout}
                style={[
                  styles.logoutButton,
                  { backgroundColor: currentTheme.colors.warning },
                ]}
                textStyle={styles.logoutButtonText}
              />
              <ActionButton
                title={
                  isDeletingAccount ? "Deleting Account..." : "Delete Account"
                }
                onPress={handleDeleteAccount}
                disabled={isDeletingAccount}
                showLoading={isDeletingAccount}
                style={[
                  styles.deleteButton,
                  {
                    backgroundColor: isDeletingAccount
                      ? currentTheme.colors.textSecondary
                      : currentTheme.colors.error,
                  },
                ]}
                textStyle={styles.deleteButtonText}
              />
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Theme Dropdown Modal */}
      <ThemeDropdownModal />

      {/* Metric System Dropdown Modal */}
      <MetricDropdownModal />

      {/* Emergency Contacts Modal */}
      <Modal
        visible={showEmergencyContacts}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowEmergencyContacts(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.emergencyContactsModal,
              { backgroundColor: currentTheme.colors.background },
            ]}
          >
            <View
              style={[
                styles.emergencyContactsHeader,
                { borderBottomColor: currentTheme.colors.accent },
              ]}
            >
              <Text
                style={[
                  styles.emergencyContactsTitle,
                  { color: currentTheme.colors.text },
                ]}
              >
                Emergency Contacts
              </Text>
              <TouchableOpacity
                style={styles.emergencyContactsCloseButton}
                onPress={() => setShowEmergencyContacts(false)}
              >
                <Text
                  style={[
                    styles.emergencyContactsCloseText,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  ✕
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.emergencyContactsContent}>
              {/* Permission Status */}
              {!contactsPermissionStatus.granted && (
                <View style={styles.permissionBanner}>
                  <Text
                    style={[
                      styles.permissionBannerText,
                      { color: currentTheme.colors.text },
                    ]}
                  >
                    📞 Grant contacts access to easily add emergency contacts from your phone
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.permissionBannerButton,
                      { backgroundColor: currentTheme.colors.primary },
                    ]}
                    onPress={requestContactsPermission}
                  >
                    <Text style={styles.permissionBannerButtonText}>
                      Grant Access
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Add Contact Button */}
              <TouchableOpacity
                style={[
                  styles.addContactButton,
                  { backgroundColor: currentTheme.colors.primary },
                ]}
                onPress={() => {
                  if (contactsPermissionStatus.granted) {
                    loadDeviceContacts();
                  }
                  setShowAddContact(true);
                }}
              >
                <Text style={styles.addContactButtonText}>+ Add Emergency Contact</Text>
              </TouchableOpacity>

              {/* Sync Contacts Button */}
              <TouchableOpacity
                style={[
                  styles.addContactButton,
                  { 
                    backgroundColor: currentTheme.colors.secondary,
                    marginTop: 10,
                  },
                ]}
                onPress={syncContactsToDatabase}
              >
                <Text style={styles.addContactButtonText}>🔄 Sync Contacts to Server</Text>
              </TouchableOpacity>

              {/* Emergency Contacts List */}
              {loadingEmergencyContacts ? (
                <View style={styles.emergencyContactsLoading}>
                  <ActivityIndicator
                    color={currentTheme.colors.primary}
                    size="small"
                  />
                  <Text
                    style={[
                      styles.emergencyContactsLoadingText,
                      { color: currentTheme.colors.textSecondary },
                    ]}
                  >
                    Loading emergency contacts...
                  </Text>
                </View>
              ) : emergencyContacts.length > 0 ? (
                emergencyContacts.map((contact) => (
                  <View
                    key={contact.id}
                    style={[
                      styles.emergencyContactItem,
                      { backgroundColor: currentTheme.colors.surface },
                    ]}
                  >
                    <View style={styles.emergencyContactInfo}>
                      <Text
                        style={[
                          styles.emergencyContactName,
                          { color: currentTheme.colors.text },
                        ]}
                      >
                        {contact.name}
                      </Text>
                      <Text
                        style={[
                          styles.emergencyContactPhone,
                          { color: currentTheme.colors.textSecondary },
                        ]}
                      >
                        {EmergencyContactsAPI.formatPhoneNumber(contact.phoneNumber)}
                      </Text>
                    </View>
                    <View style={styles.emergencyContactControls}>
                      <Switch
                        value={contact.isEnabled}
                        onValueChange={(value) => handleToggleEmergencyContact(contact.id, value)}
                        trackColor={{
                          false: currentTheme.colors.accent,
                          true: currentTheme.colors.primary,
                        }}
                        thumbColor={contact.isEnabled ? "#fff" : "#f4f3f4"}
                      />
                      <TouchableOpacity
                        style={[
                          styles.removeContactButton,
                          { backgroundColor: currentTheme.colors.error },
                        ]}
                        onPress={() => handleRemoveEmergencyContact(contact.id)}
                      >
                        <Text style={styles.removeContactButtonText}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.emergencyContactsEmpty}>
                  <Text
                    style={[
                      styles.emergencyContactsEmptyTitle,
                      { color: currentTheme.colors.text },
                    ]}
                  >
                    No Emergency Contacts
                  </Text>
                  <Text
                    style={[
                      styles.emergencyContactsEmptyText,
                      { color: currentTheme.colors.textSecondary },
                    ]}
                  >
                    Add emergency contacts who will receive alerts with your location in case of emergency during rides.
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Add Contact Modal */}
      <Modal
        visible={showAddContact}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAddContact(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.addContactModal,
              { backgroundColor: currentTheme.colors.background },
            ]}
          >
            <View
              style={[
                styles.addContactHeader,
                { borderBottomColor: currentTheme.colors.accent },
              ]}
            >
              <Text
                style={[
                  styles.addContactTitle,
                  { color: currentTheme.colors.text },
                ]}
              >
                Add Emergency Contact
              </Text>
              <TouchableOpacity
                style={styles.addContactCloseButton}
                onPress={() => {
                  setShowAddContact(false);
                  setSearchQuery("");
                }}
              >
                <Text
                  style={[
                    styles.addContactCloseText,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  ✕
                </Text>
              </TouchableOpacity>
            </View>

            {contactsPermissionStatus.granted ? (
              <View style={styles.addContactContent}>
                {/* Search Bar */}
                <TextInput
                  style={[
                    styles.searchInput,
                    {
                      backgroundColor: currentTheme.colors.surface,
                      color: currentTheme.colors.text,
                      borderColor: currentTheme.colors.accent,
                    },
                  ]}
                  placeholder="Search contacts..."
                  placeholderTextColor={currentTheme.colors.textSecondary}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />

                {/* Contacts List */}
                <FlatList
                  data={deviceContacts.filter(
                    (contact) =>
                      contact.name &&
                      contact.name.toLowerCase().includes(searchQuery.toLowerCase())
                  )}
                  keyExtractor={(item) => item.id || Math.random().toString()}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[
                        styles.deviceContactItem,
                        { backgroundColor: currentTheme.colors.surface },
                      ]}
                      onPress={() => {
                        if (item.phoneNumbers && item.phoneNumbers[0]) {
                          handleAddEmergencyContact({
                            name: item.name || "Unknown",
                            phoneNumber: item.phoneNumbers[0].number || "",
                            isEnabled: true,
                          });
                        }
                      }}
                    >
                      <View style={styles.deviceContactInfo}>
                        <Text
                          style={[
                            styles.deviceContactName,
                            { color: currentTheme.colors.text },
                          ]}
                        >
                          {item.name}
                        </Text>
                        <Text
                          style={[
                            styles.deviceContactPhone,
                            { color: currentTheme.colors.textSecondary },
                          ]}
                        >
                          {item.phoneNumbers?.[0]?.number
                            ? EmergencyContactsAPI.formatPhoneNumber(item.phoneNumbers[0].number)
                            : "No phone number"}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}
                  style={styles.contactsList}
                  showsVerticalScrollIndicator={false}
                />
              </View>
            ) : (
              <View style={styles.addContactNoPermission}>
                <Text
                  style={[
                    styles.addContactNoPermissionTitle,
                    { color: currentTheme.colors.text },
                  ]}
                >
                  Contacts Access Required
                </Text>
                <Text
                  style={[
                    styles.addContactNoPermissionText,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  To add contacts from your phone, please grant contacts permission first.
                </Text>
                <TouchableOpacity
                  style={[
                    styles.addContactPermissionButton,
                    { backgroundColor: currentTheme.colors.primary },
                  ]}
                  onPress={requestContactsPermission}
                >
                  <Text style={styles.addContactPermissionButtonText}>
                    Grant Contacts Access
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Hidden Posts Modal */}
      <Modal
        visible={showHiddenPosts}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowHiddenPosts(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.hiddenPostsModal,
              { backgroundColor: currentTheme.colors.background },
            ]}
          >
            <View
              style={[
                styles.hiddenPostsHeader,
                { borderBottomColor: currentTheme.colors.accent },
              ]}
            >
              <Text
                style={[
                  styles.hiddenPostsTitle,
                  { color: currentTheme.colors.text },
                ]}
              >
                Hidden Posts
              </Text>
              <TouchableOpacity
                style={styles.hiddenPostsCloseButton}
                onPress={() => setShowHiddenPosts(false)}
              >
                <Text
                  style={[
                    styles.hiddenPostsCloseText,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  ✕
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.hiddenPostsContent}>
              {loadingHiddenPosts ? (
                <View style={styles.hiddenPostsLoading}>
                  <ActivityIndicator
                    color={currentTheme.colors.primary}
                    size="small"
                  />
                  <Text
                    style={[
                      styles.hiddenPostsLoadingText,
                      { color: currentTheme.colors.textSecondary },
                    ]}
                  >
                    Loading hidden posts...
                  </Text>
                </View>
              ) : hiddenPosts.length > 0 ? (
                hiddenPosts.map((post) => (
                  <View
                    key={post.id}
                    style={[
                      styles.hiddenPostItem,
                      { backgroundColor: currentTheme.colors.surface },
                    ]}
                  >
                    <View style={styles.hiddenPostInfo}>
                      <Text
                        style={[
                          styles.hiddenPostAuthor,
                          { color: currentTheme.colors.text },
                        ]}
                      >
                        {post.authorName}
                      </Text>
                      <Text
                        style={[
                          styles.hiddenPostContent,
                          { color: currentTheme.colors.textSecondary },
                        ]}
                      >
                        {post.content}
                      </Text>
                      <Text
                        style={[
                          styles.hiddenPostDate,
                          { color: currentTheme.colors.textSecondary },
                        ]}
                      >
                        Hidden on {new Date(post.hiddenAt).toLocaleDateString()}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.unhideButton,
                        { backgroundColor: currentTheme.colors.primary },
                      ]}
                      onPress={() => handleUnhidePost(post.id)}
                    >
                      <Text style={styles.unhideButtonText}>Restore</Text>
                    </TouchableOpacity>
                  </View>
                ))
              ) : (
                <View style={styles.hiddenPostsEmpty}>
                  <Text
                    style={[
                      styles.hiddenPostsEmptyTitle,
                      { color: currentTheme.colors.text },
                    ]}
                  >
                    No Hidden Posts
                  </Text>
                  <Text
                    style={[
                      styles.hiddenPostsEmptyText,
                      { color: currentTheme.colors.textSecondary },
                    ]}
                  >
                    You haven't hidden any posts yet. When you hide posts from
                    your feed, they'll appear here.
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#335C67",
  },
  safeArea: {
    backgroundColor: "#335C67",
  },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    marginBottom: -45,
    marginTop: -5,
  },
  header: {
    fontSize: 30,
    fontFamily: "Inder",
    color: "#fff",
    textAlign: "center",
    flex: 1,
    fontWeight: "600",
  },
  backButton: {
    position: "absolute",
    left: 20,
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
  backIcon: {
    width: 24,
    height: 24,
    tintColor: "#fff",
  },
  viewPort: {
    backgroundColor: "#FFFFFF",
    flex: 1,
    borderTopLeftRadius: 50,
    borderTopRightRadius: 50,
    marginTop: -4,
    paddingTop: 15,
    paddingBottom: 150, // Add bottom padding to account for tab bar
  },
  optionsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 120,
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
  dropdownButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 8,
    minWidth: 100,
    justifyContent: "space-between",
  },
  dropdownButtonText: {
    fontSize: 14,
    fontFamily: "Inder",
    marginRight: 5,
  },
  dropdownArrow: {
    fontSize: 12,
    fontFamily: "Inder",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  dropdownModal: {
    borderRadius: 12,
    padding: 20,
    width: "80%",
    maxWidth: 300,
    maxHeight: 400,
  },
  dropdownModalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 15,
    fontFamily: "Inder",
  },
  dropdownModalContent: {
    maxHeight: 250,
  },
  dropdownOption: {
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  dropdownOptionText: {
    fontSize: 16,
    textAlign: "center",
    fontFamily: "Inder",
  },
  dropdownOptionDescription: {
    fontSize: 12,
    textAlign: "center",
    fontFamily: "Inder",
    fontStyle: "italic",
  },
  actionButton: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#C5D9D1",
  },
  actionButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonLoader: {
    marginRight: 8,
  },
  actionButtonText: {
    fontSize: 16,
    color: "#335C67",
    fontFamily: "Inder",
    fontWeight: "500",
  },
  disabledButton: {
    opacity: 0.6,
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
  deleteButton: {
    backgroundColor: "#FF6B6B",
    borderRadius: 15,
    marginVertical: 5,
    borderBottomWidth: 0,
  },
  deleteButtonText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "bold",
  },
  // Hidden Posts Modal Styles
  hiddenPostsModal: {
    maxHeight: "80%",
    minHeight: "50%",
    borderRadius: 20,
    padding: 0,
    margin: 0,
    width: "95%",
  },
  hiddenPostsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
  },
  hiddenPostsTitle: {
    fontSize: 20,
    fontWeight: "bold",
    fontFamily: "Inder",
  },
  hiddenPostsCloseButton: {
    padding: 8,
    borderRadius: 20,
  },
  hiddenPostsCloseText: {
    fontSize: 18,
    fontWeight: "bold",
  },
  hiddenPostsContent: {
    padding: 20,
    maxHeight: 400,
  },
  hiddenPostsLoading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  hiddenPostsLoadingText: {
    marginLeft: 8,
    fontSize: 14,
    fontFamily: "Inder",
  },
  hiddenPostItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  hiddenPostInfo: {
    flex: 1,
    marginRight: 12,
  },
  hiddenPostAuthor: {
    fontSize: 16,
    fontWeight: "bold",
    fontFamily: "Inder",
    marginBottom: 4,
  },
  hiddenPostContent: {
    fontSize: 14,
    fontFamily: "Inder",
    marginBottom: 4,
    lineHeight: 18,
  },
  hiddenPostDate: {
    fontSize: 12,
    fontFamily: "Inder",
  },
  unhideButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    minWidth: 80,
  },
  unhideButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    fontFamily: "Inder",
  },
  hiddenPostsEmpty: {
    alignItems: "center",
    padding: 40,
  },
  hiddenPostsEmptyTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
    fontFamily: "Inder",
  },
  hiddenPostsEmptyText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    fontFamily: "Inder",
  },

  // Emergency Contacts Modal Styles
  emergencyContactsModal: {
    maxHeight: "85%",
    minHeight: "60%",
    borderRadius: 20,
    padding: 0,
    margin: 0,
    width: "95%",
  },
  emergencyContactsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
  },
  emergencyContactsTitle: {
    fontSize: 20,
    fontWeight: "bold",
    fontFamily: "Inder",
  },
  emergencyContactsCloseButton: {
    padding: 8,
    borderRadius: 20,
  },
  emergencyContactsCloseText: {
    fontSize: 18,
    fontWeight: "bold",
  },
  emergencyContactsContent: {
    padding: 20,
    maxHeight: 500,
  },
  emergencyContactsLoading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  emergencyContactsLoadingText: {
    marginLeft: 8,
    fontSize: 14,
    fontFamily: "Inder",
  },
  permissionBanner: {
    backgroundColor: "rgba(74, 144, 226, 0.1)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(74, 144, 226, 0.3)",
  },
  permissionBannerText: {
    fontSize: 14,
    fontFamily: "Inder",
    lineHeight: 20,
    marginBottom: 12,
  },
  permissionBannerButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  permissionBannerButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inder",
  },
  addContactButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  addContactButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inder",
  },
  emergencyContactItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 12,
    marginTop: 10,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  emergencyContactInfo: {
    flex: 1,
    marginRight: 12,
  },
  emergencyContactName: {
    fontSize: 16,
    fontWeight: "bold",
    fontFamily: "Inder",
    marginBottom: 4,
  },
  emergencyContactPhone: {
    fontSize: 14,
    fontFamily: "Inder",
  },
  emergencyContactControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  removeContactButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  removeContactButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Inder",
  },
  emergencyContactsEmpty: {
    alignItems: "center",
    padding: 40,
  },
  emergencyContactsEmptyTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
    fontFamily: "Inder",
  },
  emergencyContactsEmptyText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    fontFamily: "Inder",
  },

  // Add Contact Modal Styles
  addContactModal: {
    maxHeight: "85%",
    minHeight: "60%",
    borderRadius: 20,
    padding: 0,
    margin: 0,
    width: "95%",
  },
  addContactHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
  },
  addContactTitle: {
    fontSize: 20,
    fontWeight: "bold",
    fontFamily: "Inder",
  },
  addContactCloseButton: {
    padding: 8,
    borderRadius: 20,
  },
  addContactCloseText: {
    fontSize: 18,
    fontWeight: "bold",
  },
  addContactContent: {
    flex: 1,
    padding: 20,
  },
  searchInput: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
    fontSize: 16,
    fontFamily: "Inder",
  },
  contactsList: {
    flex: 1,
  },
  deviceContactItem: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  deviceContactInfo: {
    flex: 1,
  },
  deviceContactName: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inder",
    marginBottom: 4,
  },
  deviceContactPhone: {
    fontSize: 14,
    fontFamily: "Inder",
  },
  addContactNoPermission: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  addContactNoPermissionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
    fontFamily: "Inder",
    textAlign: "center",
  },
  addContactNoPermissionText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
    fontFamily: "Inder",
  },
  addContactPermissionButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  addContactPermissionButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inder",
  },
});

export default OptionsScreen;
