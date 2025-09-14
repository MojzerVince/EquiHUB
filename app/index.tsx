import { useRouter } from "expo-router";
import React from "react";
import {
  Dimensions,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width, height } = Dimensions.get("window");

const WelcomeScreen = () => {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header Section */}
        <View style={styles.headerSection}>
          <Image
            style={styles.appIcon}
            source={require("../assets/icons/512x512.png")}
          />
          <Text style={styles.appName}>EquiHUB</Text>
          <Text style={styles.appSlogan}>Ride safer. Ride smarter.</Text>
        </View>

        {/* Spacer */}
        <View style={styles.spacer} />

        {/* Action Buttons */}
        <View style={styles.buttonSection}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push("/register")}
          >
            <Text style={styles.primaryButtonText}>Get Started</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push("/login")}
          >
            <Text style={styles.secondaryButtonText}>
              Already have an account? Sign in
            </Text>
          </TouchableOpacity>

          {/* Motivating Subtext */}
          <Text style={styles.motivatingText}>
            Join thousands of riders who trust EquiHUB to enhance their
            equestrian journey
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  content: {
    flex: 1,
    paddingHorizontal: 30,
    justifyContent: "space-between",
    paddingTop: 40,
    paddingBottom: 40,
  },
  headerSection: {
    alignItems: "center",
    marginTop: height * 0.15,
  },
  appIcon: {
    width: 120,
    height: 120,
    borderRadius: 25,
    marginBottom: 30,
  },
  appName: {
    fontSize: 52,
    fontFamily: "Inder",
    fontWeight: "bold",
    color: "#2C3E50",
    marginBottom: 10,
    textAlign: "center",
  },
  appSlogan: {
    fontSize: 20,
    fontFamily: "Inder",
    color: "#7F8C8D",
    textAlign: "center",
    fontWeight: "500",
    letterSpacing: 0.5,
  },
  spacer: {
    flex: 1,
  },
  buttonSection: {
    alignItems: "center",
  },
  primaryButton: {
    backgroundColor: "#3498DB",
    borderRadius: 25,
    paddingVertical: 18,
    paddingHorizontal: 40,
    alignItems: "center",
    marginBottom: 15,
    width: "100%",
    shadowColor: "#3498DB",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 18,
    fontFamily: "Inder",
    fontWeight: "bold",
  },
  secondaryButton: {
    backgroundColor: "transparent",
    borderRadius: 25,
    paddingVertical: 15,
    paddingHorizontal: 40,
    alignItems: "center",
    marginBottom: 25,
    width: "100%",
  },
  secondaryButtonText: {
    color: "#3498DB",
    fontSize: 16,
    fontFamily: "Inder",
    fontWeight: "600",
  },
  motivatingText: {
    fontSize: 16,
    fontFamily: "Inder",
    color: "#95A5A6",
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: 10,
    maxWidth: "90%",
  },
});

export default WelcomeScreen;
