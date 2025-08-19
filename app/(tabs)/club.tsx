import * as Notifications from "expo-notifications";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { SessionManager } from "../../lib/sessionManager";

const ClubScreen = () => {
  const { currentTheme } = useTheme();
  const { signOut } = useAuth();

  const sendTestNotification = async () => {
    try {
      // Request notification permissions
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        alert('Notification permissions are required to send test notifications');
        return;
      }

      // Send immediate test notification
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "🐴 EquiHub Test Notification",
          body: "This is a test notification from the Club screen! Your notifications are working correctly.",
          data: {
            type: 'test_notification',
            source: 'club_screen'
          }
        },
        trigger: null, // Send immediately
      });

      alert('Test notification sent successfully!');
    } catch (error) {
      console.error('Error sending test notification:', error);
      alert('Failed to send test notification');
    }
  };

  const resetAppForWelcomeTest = async () => {
    try {
      // Reset all app data and sign out
      await SessionManager.resetAppState();
      await signOut();
      alert('App reset! You should now see the welcome screen on next app launch.');
    } catch (error) {
      console.error('Error resetting app:', error);
      alert('Failed to reset app');
    }
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
          <Text style={styles.header}>Club</Text>
        </View>
      </SafeAreaView>
      <View
        style={[
          styles.viewPort,
          { backgroundColor: currentTheme.colors.background },
        ]}
      >
        <View style={styles.contentContainer}>
          <Text
            style={[styles.comingSoonText, { color: currentTheme.colors.text }]}
          >
            Coming Soon!
          </Text>
          <Text
            style={[
              styles.comingSoonSubtext,
              { color: currentTheme.colors.textSecondary },
            ]}
          >
            This feature is under development.
          </Text>
          
          <TouchableOpacity
            style={[
              styles.testNotificationButton,
              { backgroundColor: currentTheme.colors.primary }
            ]}
            onPress={sendTestNotification}
            activeOpacity={0.8}
          >
            <Text style={styles.testNotificationButtonText}>
              🔔 Send Test Notification
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.resetButton,
              { backgroundColor: "#FF6B6B" }
            ]}
            onPress={resetAppForWelcomeTest}
            activeOpacity={0.8}
          >
            <Text style={styles.resetButtonText}>
              🔄 Reset App (Test Welcome Screen)
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    paddingBottom: 0,
  },
  headerContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: "center",
    marginBottom: -45,
  },
  header: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFFFFF",
    fontFamily: "Inder",
    textAlign: "center",
  },
  viewPort: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 130, // Add bottom padding to account for tab bar
  },
  comingSoonText: {
    fontSize: 24,
    fontWeight: "bold",
    fontFamily: "Inder",
    marginBottom: 10,
  },
  comingSoonSubtext: {
    fontSize: 16,
    fontFamily: "Inder",
    textAlign: "center",
  },
  testNotificationButton: {
    backgroundColor: "#335C67",
    borderRadius: 15,
    paddingVertical: 15,
    paddingHorizontal: 25,
    marginTop: 30,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  testNotificationButtonText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inder",
    fontWeight: "600",
    textAlign: "center",
  },
  resetButton: {
    backgroundColor: "#FF6B6B",
    borderRadius: 15,
    paddingVertical: 15,
    paddingHorizontal: 25,
    marginTop: 15,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  resetButtonText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inder",
    fontWeight: "600",
    textAlign: "center",
  },
});

export default ClubScreen;
