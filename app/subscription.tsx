import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import PaymentService from "../lib/paymentService";

const SubscriptionScreen = () => {
  const { currentTheme } = useTheme();
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const [hasUsedTrial, setHasUsedTrial] = useState(false);
  const [loading, setLoading] = useState(true);
  const [subscriptionStatus, setSubscriptionStatus] = useState<any>(null);

  useEffect(() => {
    loadSubscriptionInfo();
  }, []);

  const loadSubscriptionInfo = async () => {
    try {
      const [trialUsed, status] = await Promise.all([
        PaymentService.hasUsedTrial(),
        PaymentService.getSubscriptionStatus()
      ]);
      
      setHasUsedTrial(trialUsed);
      setSubscriptionStatus(status);
      
      // If user already has active subscription, redirect to pro features
      if (status.isActive) {
        router.replace('/pro-features');
        return;
      }
    } catch (error) {
      console.error('Error loading subscription info:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartTrial = async () => {
    if (hasUsedTrial) {
      Alert.alert(
        "Trial Already Used",
        "You have already used your 7-day free trial. Please subscribe to continue enjoying Pro features.",
        [{ text: "OK" }]
      );
      return;
    }

    setLoading(true);
    try {
      const result = await PaymentService.startTrial('equihub_pro_monthly');
      
      if (result.success) {
        // Force a complete subscription status refresh
        console.log('🔄 Starting comprehensive refresh after trial activation...');
        
        // Use the new force refresh method
        await PaymentService.forceRefreshSubscriptionStatus();
        
        // Refresh user context
        await refreshUser();
        
        // Refresh local subscription info
        await loadSubscriptionInfo();
        
        Alert.alert(
          "Trial Started!",
          "Your 7-day free trial has started! Enjoy all Pro features. You can cancel anytime before the trial ends.",
          [
            {
              text: "Continue",
              onPress: async () => {
                // Final refresh before navigation
                await refreshUser();
                
                // Navigate to pro features
                router.replace('/pro-features');
              }
            }
          ]
        );
      } else {
        Alert.alert(
          "Trial Failed",
          result.error || "Unable to start trial. Please try again.",
          [{ text: "OK" }]
        );
      }
    } catch (error) {
      console.error('Error in handleStartTrial:', error);
      Alert.alert(
        "Error",
        "Failed to start trial. Please try again later.",
        [{ text: "OK" }]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        const result = await PaymentService.purchaseSubscription('equihub_pro_monthly');
        
        if (result.success) {
          // Force a complete subscription status refresh
          console.log('🔄 Starting comprehensive refresh after subscription activation...');
          
          // Use the new force refresh method
          await PaymentService.forceRefreshSubscriptionStatus();
          
          // Refresh user context
          await refreshUser();
          
          // Refresh local subscription info
          await loadSubscriptionInfo();
          
          Alert.alert(
            "Subscription Successful!",
            "Welcome to EquiHUB Pro! You now have access to all premium features.",
            [
              {
                text: "Continue",
                onPress: async () => {
                  // Final refresh before navigation
                  await refreshUser();
                  
                  // Navigate to pro features
                  router.replace('/pro-features');
                }
              }
            ]
          );
        } else {
          Alert.alert(
            "Subscription Failed",
            result.error || "Unable to complete subscription. Please try again.",
            [{ text: "OK" }]
          );
        }
      } else {
        Alert.alert(
          "Platform Not Supported",
          "Subscriptions are currently only available on iOS and Android devices through their respective app stores.",
          [{ text: "OK" }]
        );
      }
    } catch (error) {
      Alert.alert(
        "Error",
        "Failed to process subscription. Please try again later.",
        [{ text: "OK" }]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRestorePurchases = async () => {
    setLoading(true);
    try {
      const result = await PaymentService.restorePurchases();
      
      if (result.success) {
        await loadSubscriptionInfo();
        Alert.alert(
          "Purchases Restored",
          "Your previous purchases have been restored successfully!",
          [{ text: "OK" }]
        );
      } else {
        Alert.alert(
          "Restore Failed",
          result.error || "No previous purchases found to restore.",
          [{ text: "OK" }]
        );
      }
    } catch (error) {
      Alert.alert(
        "Error",
        "Failed to restore purchases. Please try again later.",
        [{ text: "OK" }]
      );
    } finally {
      setLoading(false);
    }
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

        {/* Pricing Section */}
        <View style={styles.pricingSection}>
          <View style={[styles.pricingCard, { backgroundColor: currentTheme.colors.background }]}>
            <Text style={[styles.planTitle, { color: currentTheme.colors.text }]}>
              EquiHUB Pro
            </Text>
            <View style={styles.priceContainer}>
              <Text style={[styles.priceText, { color: currentTheme.colors.accent }]}>
                $9.99
              </Text>
              <Text style={[styles.priceSubtext, { color: currentTheme.colors.textSecondary }]}>
                / month
              </Text>
            </View>
            <Text style={[styles.platformText, { color: currentTheme.colors.textSecondary }]}>
              Billed through {Platform.OS === 'ios' ? 'App Store' : Platform.OS === 'android' ? 'Google Play' : 'Platform Store'}
            </Text>
          </View>
        </View>

        <View style={styles.ctaSection}>
          {!hasUsedTrial && !loading && (
            <>
              <TouchableOpacity
                style={[
                  styles.trialButton,
                  { backgroundColor: currentTheme.colors.accent },
                ]}
                onPress={handleStartTrial}
                disabled={loading}
              >
                <Text style={styles.trialButtonText}>
                  {loading ? 'Starting Trial...' : 'Start 7-Day Free Trial'}
                </Text>
              </TouchableOpacity>
              <Text
                style={[
                  styles.trialText,
                  { color: currentTheme.colors.textSecondary },
                ]}
              >
                7-day free trial • Then $9.99/month • Cancel anytime
              </Text>
              
              <View style={styles.orDivider}>
                <View style={[styles.dividerLine, { backgroundColor: currentTheme.colors.textSecondary }]} />
                <Text style={[styles.orText, { color: currentTheme.colors.textSecondary }]}>OR</Text>
                <View style={[styles.dividerLine, { backgroundColor: currentTheme.colors.textSecondary }]} />
              </View>
            </>
          )}

          <TouchableOpacity
            style={[
              styles.subscribeButton,
              { 
                backgroundColor: hasUsedTrial ? currentTheme.colors.accent : currentTheme.colors.background,
                borderWidth: hasUsedTrial ? 0 : 2,
                borderColor: hasUsedTrial ? 'transparent' : currentTheme.colors.accent
              },
            ]}
            onPress={handleSubscribe}
            disabled={loading}
          >
            <Text style={[
              styles.subscribeButtonText, 
              { color: hasUsedTrial ? '#FFFFFF' : currentTheme.colors.accent }
            ]}>
              {loading ? 'Processing...' : hasUsedTrial ? 'Subscribe Now' : 'Subscribe Without Trial'}
            </Text>
          </TouchableOpacity>

          {(Platform.OS === 'ios' || Platform.OS === 'android') && (
            <TouchableOpacity
              style={styles.restoreButton}
              onPress={handleRestorePurchases}
              disabled={loading}
            >
              <Text style={[styles.restoreText, { color: currentTheme.colors.textSecondary }]}>
                Restore Previous Purchases
              </Text>
            </TouchableOpacity>
          )}
          
          <Text
            style={[
              styles.disclaimerText,
              { color: currentTheme.colors.textSecondary },
            ]}
          >
            {Platform.OS === 'ios' 
              ? 'Subscription will be charged to your iTunes account. Auto-renewal may be turned off in Account Settings.'
              : Platform.OS === 'android'
              ? 'Subscription will be charged to your Google Play account. Manage your subscription in Google Play.'
              : 'Subscription functionality is available on mobile devices.'
            }
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
  planTitle: {
    fontSize: 22,
    fontFamily: "Inder",
    fontWeight: "bold",
    marginBottom: 15,
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 10,
  },
  priceText: {
    fontSize: 42,
    fontFamily: "Inder",
    fontWeight: "bold",
  },
  priceSubtext: {
    fontSize: 18,
    fontFamily: "Inder",
    marginLeft: 5,
  },
  platformText: {
    fontSize: 14,
    fontFamily: "Inder",
    textAlign: "center",
  },
  planName: {
    fontSize: 18,
    fontFamily: "Inder",
    fontWeight: "600",
    marginBottom: 10,
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
  trialButton: {
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
  trialButtonText: {
    fontSize: 18,
    fontFamily: "Inder",
    fontWeight: "600",
    color: "#FFFFFF",
  },
  orDivider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
    width: "100%",
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E0E0E0",
  },
  orText: {
    marginHorizontal: 20,
    fontSize: 14,
    fontFamily: "Inder",
    fontWeight: "500",
  },
  restoreButton: {
    marginTop: 15,
    paddingVertical: 10,
  },
  restoreText: {
    fontSize: 14,
    fontFamily: "Inder",
    textDecorationLine: "underline",
  },
  disclaimerText: {
    fontSize: 12,
    fontFamily: "Inder",
    textAlign: "center",
    marginTop: 15,
    paddingHorizontal: 20,
    lineHeight: 16,
  },
});

export default SubscriptionScreen;
