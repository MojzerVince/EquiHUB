import { useRouter } from "expo-router";
import React from "react";
import {
    Dimensions,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width, height } = Dimensions.get('window');

const WelcomeScreen = () => {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header Section */}
        <View style={styles.headerSection}>
          <Text style={styles.logo}>🐴</Text>
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
          
          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>🛒</Text>
            <Text style={styles.featureText}>Equestrian Marketplace</Text>
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
            <Text style={styles.secondaryButtonText}>Already have an account? Sign In</Text>
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
    backgroundColor: "#335C67",
  },
  content: {
    flex: 1,
    paddingHorizontal: 30,
    marginTop: -90,
    justifyContent: "space-between",
  },
  headerSection: {
    alignItems: "center",
    marginTop: height * 0.1,
  },
  logo: {
    fontSize: 80,
    marginBottom: 10,
  },
  title: {
    fontSize: 48,
    fontFamily: "Inder",
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 0,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 20,
    fontFamily: "Inder",
    color: "#B8D4DA",
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
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 15,
    padding: 20,
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
  },
  buttonSection: {
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: "#fff",
    borderRadius: 15,
    paddingVertical: 18,
    paddingHorizontal: 30,
    alignItems: "center",
    marginTop: -30,
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
    color: "#335C67",
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
    backgroundColor: "transparent",
  },
  secondaryButtonText: {
    color: "#fff",
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
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    marginBottom: 20,
    borderRadius: 1,
  },
  footerMainText: {
    fontSize: 16,
    fontFamily: "Inder",
    color: "#fff",
    textAlign: "center",
    fontWeight: "600",
    marginBottom: 8,
  },
  footerSubText: {
    fontSize: 14,
    fontFamily: "Inder",
    color: "#B8D4DA",
    textAlign: "center",
    marginBottom: 25,
    letterSpacing: 1,
  },
  footerStats: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 20,
    paddingVertical: 15,
    paddingHorizontal: 25,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  statItem: {
    alignItems: "center",
    paddingHorizontal: 15,
  },
  statNumber: {
    fontSize: 20,
    fontFamily: "Inder",
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: "Inder",
    color: "#B8D4DA",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    height: 35,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
  },
  footerText: {
    fontSize: 14,
    fontFamily: "Inder",
    color: "#B8D4DA",
    textAlign: "center",
  },
});

export default WelcomeScreen;
