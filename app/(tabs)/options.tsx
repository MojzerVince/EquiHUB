import { useAuth } from "@/contexts/AuthContext";
import { useDialog } from "@/contexts/DialogContext";
import { ThemeName, useTheme } from "@/contexts/ThemeContext";
import { HiddenPost, HiddenPostsManager } from "@/lib/hiddenPostsManager";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const OptionsScreen = () => {
  const router = useRouter();
  const { signOut, user } = useAuth();
  const { currentTheme, setTheme, availableThemes } = useTheme();
  const { showLogout, showConfirm, showError } = useDialog();

  // Settings state
  const [notifications, setNotifications] = useState(true);
  const [locationSharing, setLocationSharing] = useState(false);
  const [privateProfile, setPrivateProfile] = useState(false);
  const [autoSync, setAutoSync] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  // Load hidden posts when component mounts
  useEffect(() => {
    loadHiddenPosts();
  }, [user?.id]);

  // Reload hidden posts when screen is focused
  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        loadHiddenPosts();
      }
    }, [user?.id])
  );

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

  // Hidden posts state
  const [hiddenPosts, setHiddenPosts] = useState<HiddenPost[]>([]);
  const [showHiddenPosts, setShowHiddenPosts] = useState(false);
  const [loadingHiddenPosts, setLoadingHiddenPosts] = useState(false);

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
    showConfirm(
      "Delete Account",
      "This action cannot be undone. Are you sure you want to delete your account?",
      () => {
        // Handle account deletion logic here
        console.log("Account deletion requested");
      }
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
  }: {
    title: string;
    onPress: () => void;
    style?: any;
    textStyle?: any;
  }) => (
    <TouchableOpacity
      style={[
        styles.actionButton,
        { borderBottomColor: currentTheme.colors.accent },
        style,
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.actionButtonText,
          { color: currentTheme.colors.text },
          textStyle,
        ]}
      >
        {title}
      </Text>
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
              <SettingItem
                title="Private Profile"
                subtitle="Only friends can see your profile"
                value={privateProfile}
                onValueChange={setPrivateProfile}
              />
              <SettingItem
                title="Auto Sync"
                subtitle="Automatically sync your data"
                value={autoSync}
                onValueChange={setAutoSync}
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
                title="Location Sharing"
                subtitle="Share your location with friends"
                value={locationSharing}
                onValueChange={setLocationSharing}
              />
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
                title="Dark Mode"
                subtitle="Use dark theme"
                value={darkMode}
                onValueChange={setDarkMode}
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
                title="Delete Account"
                onPress={handleDeleteAccount}
                style={[
                  styles.deleteButton,
                  { backgroundColor: currentTheme.colors.error },
                ]}
                textStyle={styles.deleteButtonText}
              />
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Theme Dropdown Modal */}
      <ThemeDropdownModal />

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
    paddingBottom: 5,
  },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    marginBottom: -45,
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
    marginTop: 5,
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
});

export default OptionsScreen;
