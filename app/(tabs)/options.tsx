import { useAuth } from "@/contexts/AuthContext";
import { useDialog } from "@/contexts/DialogContext";
import { ThemeName, useTheme } from "@/contexts/ThemeContext";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Image,
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

  // Theme dropdown state
  const [themeDropdownVisible, setThemeDropdownVisible] = useState(false);

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
                onPress={() => console.log("Privacy Policy pressed")}
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
});

export default OptionsScreen;
