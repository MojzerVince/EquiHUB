import { useDialog } from "@/contexts/DialogContext";
import { oauthService } from "@/lib/oauthService";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width, height } = Dimensions.get("window");

const WelcomeScreen = () => {
  const router = useRouter();
  const { showError } = useDialog();
  const [isLoading, setIsLoading] = useState(false);

  const handleGetStarted = async () => {
    try {
      setIsLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // First, initiate Google account selection
      const result = await oauthService.signInWithGoogle();

      if (result.error) {
        showError(result.error);
        return;
      }

      if (result.user) {
        // User authenticated with Google, now navigate to register to complete profile
        router.push("/register");
      }
    } catch (error) {
      console.error("Error during get started:", error);
      showError("Failed to authenticate with Google. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header Section */}
        <View style={styles.headerSection}>
          <Image
            source={require("../assets/icons/512x512.png")}
            style={styles.logo}
            contentFit="contain"
          />
          <Text style={styles.title}>EquiHUB</Text>
          <Text style={styles.subtitle}>Your Equestrian Community</Text>
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
            style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
            onPress={handleGetStarted}
            disabled={isLoading}
          >
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.primaryButtonText}>Connecting...</Text>
              </View>
            ) : (
              <Text style={styles.primaryButtonText}>Get Started</Text>
            )}
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
          <View style={styles.footerStats}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>10K+</Text>
              <Text style={styles.statLabel}>Riders</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>25K+</Text>
              <Text style={styles.statLabel}>Horses</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>50+</Text>
              <Text style={styles.statLabel}>Countries</Text>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  content: {
    flex: 1,
    paddingHorizontal: 30,
    justifyContent: "space-between",
  },
  headerSection: {
    alignItems: "center",
    marginTop: height * 0.1,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 20,
  },
  title: {
    fontSize: 48,
    fontFamily: "Inder",
    fontWeight: "bold",
    color: "#335C67",
    marginBottom: 0,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 20,
    fontFamily: "Inder",
    color: "#7A8B8E",
    textAlign: "center",
    marginBottom: 20,
  },
  featuresSection: {
    marginTop: 20,
    marginBottom: 40,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 25,
    backgroundColor: "#F8FAFB",
    borderRadius: 15,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E8EAED",
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
    color: "#335C67",
    fontWeight: "500",
    flex: 1,
  },
  buttonSection: {
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: "#335C67",
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
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonDisabled: {
    backgroundColor: "#A8A8A8",
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontFamily: "Inder",
    fontWeight: "bold",
  },
  secondaryButton: {
    borderWidth: 2,
    borderColor: "#335C67",
    borderRadius: 15,
    paddingVertical: 15,
    paddingHorizontal: 30,
    alignItems: "center",
    backgroundColor: "transparent",
  },
  secondaryButtonText: {
    color: "#335C67",
    fontSize: 16,
    fontFamily: "Inder",
    fontWeight: "600",
  },
  footer: {
    alignItems: "center",
    marginBottom: 30,
  },
  footerDivider: {
    width: 50,
    height: 2,
    backgroundColor: "#E8EAED",
    marginBottom: 20,
    borderRadius: 1,
  },
  footerMainText: {
    fontSize: 16,
    fontFamily: "Inder",
    color: "#335C67",
    textAlign: "center",
    fontWeight: "600",
    marginBottom: 8,
  },
  footerSubText: {
    fontSize: 14,
    fontFamily: "Inder",
    color: "#7A8B8E",
    textAlign: "center",
    marginBottom: 25,
    letterSpacing: 1,
  },
  footerStats: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFB",
    borderRadius: 20,
    paddingVertical: 15,
    paddingHorizontal: 25,
    borderWidth: 1,
    borderColor: "#E8EAED",
  },
  statItem: {
    alignItems: "center",
    paddingHorizontal: 15,
  },
  statNumber: {
    fontSize: 20,
    fontFamily: "Inder",
    fontWeight: "bold",
    color: "#335C67",
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: "Inder",
    color: "#7A8B8E",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    height: 35,
    backgroundColor: "#E8EAED",
  },
  footerText: {
    fontSize: 14,
    fontFamily: "Inder",
    color: "#7A8B8E",
    textAlign: "center",
  },
});

export default WelcomeScreen;
