import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React from "react";
import {
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const { width, height } = Dimensions.get("window");

const WelcomeScreen = () => {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#F99471", "#F60F5C"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            {/* Header Section */}
            <View style={styles.headerSection}>
              <Image
                source={require("../assets/icons/1024x 1024-02.png")}
                style={styles.logo}
                resizeMode="contain"
              />
              <Text style={styles.title}>EquiHUB</Text>
              <Text style={styles.subtitle}>Ride safer • Ride smarter</Text>
            </View>

            {/* Feature Highlights */}
            <View style={styles.featuresSection}>
              <View style={styles.featureItem}>
                <Text style={styles.featureIcon}>🐎</Text>
                <Text style={styles.featureText}>Manage Your Horses</Text>
              </View>

              <View style={styles.featureItem}>
                <Text style={styles.featureIcon}>🏆</Text>
                <Text style={styles.featureText}>Track Achievements</Text>
              </View>

              <View style={styles.featureItem}>
                <Text style={styles.featureIcon}>🌍</Text>
                <Text style={styles.featureText}>Connect with Riders</Text>
              </View>
            </View>

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
                  Already have an account? Sign In
                </Text>
              </TouchableOpacity>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <View style={styles.footerDivider} />
              <Text style={styles.footerMainText}>
                Join thousands of equestrians worldwide
              </Text>
              <Text style={styles.footerSubText}>
                Connect • Learn • Grow • Compete
              </Text>
            </View>
          </View>
        </ScrollView>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    minHeight: height,
  },
  content: {
    flex: 1,
    paddingHorizontal: 30,
    justifyContent: "space-between",
    paddingVertical: 20,
  },
  headerSection: {
    alignItems: "center",
    marginTop: height * 0.05,
  },
  logo: {
    width: 112,
    height: 112,
    marginBottom: 20,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: 48,
    fontFamily: "Inder",
    fontWeight: "bold",
    color: "#fff",
    marginTop: -10,
    marginBottom: 0,
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 20,
    fontFamily: "Inder",
    color: "#fff",
    textAlign: "center",
    marginBottom: 0,
    opacity: 0.9,
    textShadowColor: "rgba(0, 0, 0, 0.2)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  featuresSection: {
    marginTop: 10,
    marginBottom: 0,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 15,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  featureIcon: {
    fontSize: 28,
    marginRight: 20,
    width: 40,
    textAlign: "center",
  },
  featureText: {
    fontSize: 18,
    fontFamily: "Inder",
    color: "#fff",
    fontWeight: "500",
    flex: 1,
    textShadowColor: "rgba(0, 0, 0, 0.2)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  buttonSection: {
    marginTop: -10,
    marginBottom: 0,
  },
  primaryButton: {
    backgroundColor: "#fff",
    borderRadius: 15,
    paddingVertical: 18,
    paddingHorizontal: 30,
    alignItems: "center",
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  primaryButtonText: {
    color: "#F60F5C",
    fontSize: 20,
    fontFamily: "Inder",
    fontWeight: "bold",
  },
  secondaryButton: {
    borderWidth: 2,
    borderColor: "#fff",
    borderRadius: 15,
    paddingVertical: 15,
    paddingHorizontal: 30,
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  secondaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inder",
    fontWeight: "600",
    textShadowColor: "rgba(0, 0, 0, 0.2)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  footer: {
    alignItems: "center",
    marginBottom: 50,
  },
  footerDivider: {
    width: 50,
    height: 2,
    backgroundColor: "rgba(255, 255, 255, 0.4)",
    marginBottom: 15,
    borderRadius: 1,
  },
  footerMainText: {
    fontSize: 16,
    fontFamily: "Inder",
    color: "#fff",
    textAlign: "center",
    fontWeight: "600",
    marginBottom: 8,
    textShadowColor: "rgba(0, 0, 0, 0.2)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  footerSubText: {
    fontSize: 14,
    fontFamily: "Inder",
    color: "#fff",
    textAlign: "center",
    letterSpacing: 1,
    opacity: 0.9,
    textShadowColor: "rgba(0, 0, 0, 0.2)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});

export default WelcomeScreen;
