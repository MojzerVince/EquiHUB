import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
    Alert,
    Image,
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
  
  // Settings state
  const [notifications, setNotifications] = useState(true);
  const [locationSharing, setLocationSharing] = useState(false);
  const [privateProfile, setPrivateProfile] = useState(false);
  const [autoSync, setAutoSync] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  const handleLogout = () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            try {
              console.log("Starting logout process for user:", user?.email);
              await signOut();
              console.log("User logged out successfully");
              // Force navigation after a brief delay to ensure state is updated
              setTimeout(() => {
                router.replace("/login");
              }, 100);
            } catch (error) {
              console.error("Logout error:", error);
              Alert.alert("Error", "Failed to sign out. Please try again.");
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "This action cannot be undone. Are you sure you want to delete your account?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            // Handle account deletion logic here
            console.log("Account deletion requested");
          },
        },
      ]
    );
  };

  const SettingItem = ({ 
    title, 
    subtitle, 
    value, 
    onValueChange, 
    type = "switch" 
  }: {
    title: string;
    subtitle?: string;
    value?: boolean;
    onValueChange?: (value: boolean) => void;
    type?: "switch" | "button";
  }) => (
    <View style={styles.settingItem}>
      <View style={styles.settingInfo}>
        <Text style={styles.settingTitle}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      {type === "switch" && (
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: "#C5D9D1", true: "#335C67" }}
          thumbColor={value ? "#fff" : "#f4f3f4"}
        />
      )}
    </View>
  );

  const ActionButton = ({ 
    title, 
    onPress, 
    style, 
    textStyle 
  }: {
    title: string;
    onPress: () => void;
    style?: any;
    textStyle?: any;
  }) => (
    <TouchableOpacity style={[styles.actionButton, style]} onPress={onPress}>
      <Text style={[styles.actionButtonText, textStyle]}>{title}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
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

      <ScrollView style={styles.viewPort}>
        <View style={styles.optionsContainer}>
          
          {/* Account Settings Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            <View style={styles.sectionContent}>
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
            <Text style={styles.sectionTitle}>Privacy</Text>
            <View style={styles.sectionContent}>
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
            <Text style={styles.sectionTitle}>App Settings</Text>
            <View style={styles.sectionContent}>
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
            <Text style={styles.sectionTitle}>General</Text>
            <View style={styles.sectionContent}>
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
            <Text style={styles.sectionTitle}>Account Actions</Text>
            <View style={styles.sectionContent}>
              <ActionButton
                title="Logout"
                onPress={handleLogout}
                style={styles.logoutButton}
                textStyle={styles.logoutButtonText}
              />
              <ActionButton
                title="Delete Account"
                onPress={handleDeleteAccount}
                style={styles.deleteButton}
                textStyle={styles.deleteButtonText}
              />
            </View>
          </View>
        </View>
      </ScrollView>
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
    paddingTop: 30,
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
