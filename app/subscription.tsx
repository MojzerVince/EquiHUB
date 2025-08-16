import { useRouter } from "expo-router";
import React from "react";
import {
    Alert,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";

const SubscriptionScreen = () => {
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const router = useRouter();

  const handleSubscribe = () => {
    Alert.alert(
      "Pro Subscription",
      "Subscription functionality will be implemented soon! For now, you can access basic features.",
      [{ text: "OK" }]
    );
  };

  const features = [
    {
      icon: "📊",
      title: "Unlimited History",
      description: "Access all your training sessions from any week",
      isPro: true,
    },
    {
      icon: "📈",
      title: "Advanced Analytics",
      description: "Detailed performance insights and progress tracking",
      isPro: true,
    },
    {
      icon: "🏆",
      title: "Goals & Achievements",
      description: "Set training goals and track your achievements",
      isPro: true,
    },
    {
      icon: "📱",
      title: "Priority Support",
      description: "Get priority customer support and faster responses",
      isPro: true,
    },
    {
      icon: "🐴",
      title: "Basic Tracking",
      description: "Track your current week's training sessions",
      isPro: false,
    },
    {
      icon: "🗺️",
      title: "GPS Mapping",
      description: "Record your training routes with GPS",
      isPro: false,
    },
  ];

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: currentTheme.colors.primary },
      ]}
    >
      <StatusBar 
        barStyle="light-content" 
        backgroundColor={currentTheme.colors.primary}
        translucent={false}
        hidden={true}
      />
      <View style={styles.headerContainer}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.header}>Upgrade to Pro</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={[
          styles.content,
          { backgroundColor: currentTheme.colors.background },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroSection}>
          <Text style={[styles.heroTitle, { color: currentTheme.colors.text }]}>
            Unlock Your Full Potential
          </Text>
          <Text
            style={[
              styles.heroSubtitle,
              { color: currentTheme.colors.textSecondary },
            ]}
          >
            Get access to unlimited training history and advanced features
          </Text>
        </View>

        <View style={styles.pricingSection}>
          <View
            style={[
              styles.pricingCard,
              { backgroundColor: currentTheme.colors.surface },
            ]}
          >
            <Text style={[styles.planName, { color: currentTheme.colors.text }]}>
              Pro Rider
            </Text>
            <View style={styles.priceContainer}>
              <Text
                style={[styles.currency, { color: currentTheme.colors.text }]}
              >
                $
              </Text>
              <Text
                style={[styles.price, { color: currentTheme.colors.text }]}
              >
                9.99
              </Text>
              <Text
                style={[
                  styles.period,
                  { color: currentTheme.colors.textSecondary },
                ]}
              >
                /month
              </Text>
            </View>
            <Text
              style={[
                styles.saveText,
                { color: currentTheme.colors.accent },
              ]}
            >
              Save 50% with annual plan
            </Text>
          </View>
        </View>

        <View style={styles.featuresSection}>
          <Text
            style={[
              styles.featuresTitle,
              { color: currentTheme.colors.text },
            ]}
          >
            What You Get
          </Text>

          {features.map((feature, index) => (
            <View
              key={index}
              style={[
                styles.featureItem,
                {
                  backgroundColor: feature.isPro
                    ? currentTheme.colors.surface
                    : "transparent",
                  borderColor: feature.isPro
                    ? currentTheme.colors.accent
                    : currentTheme.colors.border,
                },
              ]}
            >
              <Text style={styles.featureIcon}>{feature.icon}</Text>
              <View style={styles.featureContent}>
                <View style={styles.featureTitleContainer}>
                  <Text
                    style={[
                      styles.featureTitle,
                      { color: currentTheme.colors.text },
                    ]}
                  >
                    {feature.title}
                  </Text>
                  {feature.isPro && (
                    <View
                      style={[
                        styles.proBadge,
                        { backgroundColor: currentTheme.colors.accent },
                      ]}
                    >
                      <Text style={styles.proText}>PRO</Text>
                    </View>
                  )}
                </View>
                <Text
                  style={[
                    styles.featureDescription,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  {feature.description}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.ctaSection}>
          <TouchableOpacity
            style={[
              styles.subscribeButton,
              { backgroundColor: currentTheme.colors.accent },
            ]}
            onPress={handleSubscribe}
          >
            <Text style={styles.subscribeButtonText}>Start Free Trial</Text>
          </TouchableOpacity>
          <Text
            style={[
              styles.trialText,
              { color: currentTheme.colors.textSecondary },
            ]}
          >
            7-day free trial • Cancel anytime
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  backButtonText: {
    fontSize: 20,
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  header: {
    fontSize: 24,
    fontFamily: "Inder",
    color: "#fff",
    textAlign: "center",
    fontWeight: "600",
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    marginTop: 10,
  },
  heroSection: {
    padding: 30,
    alignItems: "center",
  },
  heroTitle: {
    fontSize: 28,
    fontFamily: "Inder",
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
  },
  heroSubtitle: {
    fontSize: 16,
    fontFamily: "Inder",
    textAlign: "center",
    lineHeight: 22,
  },
  pricingSection: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  pricingCard: {
    borderRadius: 20,
    padding: 25,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
  },
  planName: {
    fontSize: 18,
    fontFamily: "Inder",
    fontWeight: "600",
    marginBottom: 10,
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 5,
  },
  currency: {
    fontSize: 24,
    fontFamily: "Inder",
    fontWeight: "600",
  },
  price: {
    fontSize: 48,
    fontFamily: "Inder",
    fontWeight: "bold",
  },
  period: {
    fontSize: 18,
    fontFamily: "Inder",
    marginLeft: 5,
  },
  saveText: {
    fontSize: 14,
    fontFamily: "Inder",
    fontWeight: "500",
  },
  featuresSection: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  featuresTitle: {
    fontSize: 22,
    fontFamily: "Inder",
    fontWeight: "600",
    marginBottom: 20,
    textAlign: "center",
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 20,
    borderRadius: 15,
    marginBottom: 12,
    borderWidth: 1,
  },
  featureIcon: {
    fontSize: 24,
    marginRight: 15,
    marginTop: 2,
  },
  featureContent: {
    flex: 1,
  },
  featureTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
  },
  featureTitle: {
    fontSize: 16,
    fontFamily: "Inder",
    fontWeight: "600",
    marginRight: 10,
  },
  proBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  proText: {
    fontSize: 10,
    fontFamily: "Inder",
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  featureDescription: {
    fontSize: 14,
    fontFamily: "Inder",
    lineHeight: 20,
  },
  ctaSection: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    alignItems: "center",
  },
  subscribeButton: {
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 25,
    marginBottom: 10,
    minWidth: 200,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  subscribeButtonText: {
    fontSize: 18,
    fontFamily: "Inder",
    fontWeight: "600",
    color: "#FFFFFF",
  },
  trialText: {
    fontSize: 14,
    fontFamily: "Inder",
    textAlign: "center",
  },
});

export default SubscriptionScreen;
