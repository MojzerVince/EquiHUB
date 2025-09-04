import { useDialog } from "@/contexts/DialogContext";
import { useTheme } from "@/contexts/ThemeContext";
import PaymentService from "@/lib/paymentService";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const ProFeaturesPage = () => {
  const router = useRouter();
  const { currentTheme } = useTheme();
  const { showConfirm } = useDialog();
  const [subscriptionStatus, setSubscriptionStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSubscriptionStatus();
  }, []);

  const loadSubscriptionStatus = async () => {
    try {
      // Simply check if user is pro member from database
      const isProMember = await PaymentService.isProMember();
      
      // Create status object for compatibility with existing UI
      const status = {
        hasSubscription: isProMember,
        isActive: isProMember,
        status: isProMember ? 'active' : 'none'
      };
      
      setSubscriptionStatus(status);
      
      console.log('📱 Pro features page - subscription status loaded:', status);
    } catch (error) {
      console.error('Error loading subscription status:', error);
    } finally {
      setLoading(false);
    }
  };

  const proFeatures = [
    {
      icon: "📊",
      title: "Advanced Session History",
      description:
        "View unlimited weeks of training history with detailed analytics",
      status: "Active",
    },
    {
      icon: "📱",
      title: "Premium Tracking Features",
      description:
        "Enhanced GPS tracking with route analysis and performance metrics",
      status: "Active",
    },
    {
      icon: "🏆",
      title: "Exclusive Badges & Achievements",
      description: "Unlock premium badges and track advanced achievements",
      status: "Active",
    },
    {
      icon: "☁️",
      title: "Cloud Backup",
      description: "Automatic backup of all your training data and sessions",
      status: "Active",
    },
    {
      icon: "📈",
      title: "Detailed Analytics",
      description: "Advanced performance analytics and training insights",
      status: "Active",
    },
    {
      icon: "👥",
      title: "Priority Support",
      description: "Get premium support and faster response times",
      status: "Active",
    },
    {
      icon: "🎯",
      title: "Training Goals",
      description: "Set and track personalized training goals and milestones",
      status: "Active",
    },
    {
      icon: "📋",
      title: "Custom Training Plans",
      description: "Access to customizable training plans and schedules",
      status: "Active",
    },
  ];

  const subscriptionInfo = {
    plan: subscriptionStatus?.plan?.id === 'equihub_pro_monthly' ? "EquiHUB Pro" : "EquiHUB Pro",
    status: subscriptionStatus?.status === 'trial' ? 'Free Trial' : 
            subscriptionStatus?.isActive ? 'Active' : 'Inactive',
    renewalDate: subscriptionStatus?.status === 'trial' 
      ? `Trial ends in ${subscriptionStatus.daysRemaining || 0} days`
      : "September 17, 2025",
    price: "$9.99/month",
    platform: Platform.OS === 'ios' ? 'App Store' : Platform.OS === 'android' ? 'Google Play' : 'Web'
  };

  const handleManageSubscription = async () => {
    const managementURL = PaymentService.getSubscriptionManagementURL();
    
    if (managementURL) {
      showConfirm(
        "Manage Subscription",
        `This will open your ${subscriptionInfo.platform} subscription settings where you can change plans, update payment methods, or cancel your subscription.`,
        async () => {
          try {
            const supported = await Linking.canOpenURL(managementURL);
            if (supported) {
              await Linking.openURL(managementURL);
            } else {
              showConfirm(
                "Subscription Management",
                `Please open your ${subscriptionInfo.platform} app and go to your subscription settings to manage your EquiHUB Pro subscription.`
              );
            }
          } catch (error) {
            showConfirm(
              "Error",
              "Unable to open subscription management. Please check your platform's subscription settings manually."
            );
          }
        }
      );
    } else {
      showConfirm(
        "Subscription Management",
        "Subscription management will be available once payment integration is complete."
      );
    }
  };

  const handleContactSupport = () => {
    showConfirm(
      "Priority Support",
      "As a Pro member, you have access to priority support. Would you like to contact our support team?",
      () => {
        showConfirm(
          "Support Contact",
          "Support contact functionality will be available soon. For now, you can reach us at support@equihub.com"
        );
      }
    );
  };

  const handleRefreshStatus = async () => {
    setLoading(true);
    try {
      console.log('🔄 Manually refreshing subscription status...');
      
      // Force a complete refresh
      await PaymentService.forceRefreshSubscriptionStatus();
      
      // Reload status
      await loadSubscriptionStatus();
      
      showConfirm(
        "Status Refreshed",
        "Your subscription status has been refreshed successfully."
      );
    } catch (error) {
      console.error('Error refreshing status:', error);
      showConfirm(
        "Refresh Failed",
        "Failed to refresh subscription status. Please try again."
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
        await loadSubscriptionStatus();
        showConfirm("Success", "Your purchases have been restored!");
      } else {
        showConfirm("Restore Purchases", result.error || "Unable to restore purchases at this time.");
      }
    } catch (error) {
      showConfirm("Error", "Failed to restore purchases. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: currentTheme.colors.primary, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={[{ color: currentTheme.colors.surface, fontSize: 18, fontFamily: 'Inder' }]}>Loading subscription info...</Text>
      </View>
    );
  }

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
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Image
              source={require("../assets/UI_resources/UI_white/arrow_white.png")}
              style={styles.backIcon}
            />
          </TouchableOpacity>
          <Text style={styles.header}>Pro Membership</Text>
        </View>
      </SafeAreaView>

      <ScrollView
        style={[
          styles.viewPort,
          { backgroundColor: currentTheme.colors.surface },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileContainer}>
          {/* Status Section */}
          <View
            style={[
              styles.statusSection,
              { backgroundColor: currentTheme.colors.background },
            ]}
          >
            <View style={styles.statusHeader}>
              <Text style={styles.statusEmoji}>✨</Text>
              <View style={styles.statusInfo}>
                <Text
                  style={[
                    styles.statusTitle,
                    { color: currentTheme.colors.text },
                  ]}
                >
                  {subscriptionInfo.plan}
                </Text>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusBadgeText}>
                    {subscriptionInfo.status}
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.subscriptionDetails}>
              <View style={styles.detailRow}>
                <Text
                  style={[
                    styles.detailLabel,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  Plan
                </Text>
                <Text
                  style={[
                    styles.detailValue,
                    { color: currentTheme.colors.text },
                  ]}
                >
                  {subscriptionInfo.price}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text
                  style={[
                    styles.detailLabel,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  Next Renewal
                </Text>
                <Text
                  style={[
                    styles.detailValue,
                    { color: currentTheme.colors.text },
                  ]}
                >
                  {subscriptionInfo.renewalDate}
                </Text>
              </View>
            </View>
          </View>

          {/* Features Section */}
          <View style={styles.featuresSection}>
            <Text
              style={[styles.sectionTitle, { color: currentTheme.colors.text }]}
            >
              Your Pro Features
            </Text>
            <Text
              style={[
                styles.sectionSubtitle,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              Enjoy these premium features as a Pro member
            </Text>

            {proFeatures.map((feature, index) => (
              <View
                key={index}
                style={[
                  styles.featureItem,
                  { backgroundColor: currentTheme.colors.background },
                ]}
              >
                <Text style={styles.featureIcon}>{feature.icon}</Text>
                <View style={styles.featureContent}>
                  <View style={styles.featureHeader}>
                    <Text
                      style={[
                        styles.featureTitle,
                        { color: currentTheme.colors.text },
                      ]}
                    >
                      {feature.title}
                    </Text>
                    <View style={styles.featureStatusBadge}>
                      <Text style={styles.featureStatusText}>
                        {feature.status}
                      </Text>
                    </View>
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

          {/* Benefits Summary */}
          <View
            style={[
              styles.benefitsSection,
              { backgroundColor: currentTheme.colors.background },
            ]}
          >
            <Text
              style={[
                styles.benefitsTitle,
                { color: currentTheme.colors.text },
              ]}
            >
              Pro Member Benefits
            </Text>
            <View style={styles.benefitsList}>
              <View style={styles.benefitItem}>
                <Text style={styles.benefitIcon}>✅</Text>
                <Text
                  style={[
                    styles.benefitText,
                    { color: currentTheme.colors.text },
                  ]}
                >
                  Unlimited training session history
                </Text>
              </View>
              <View style={styles.benefitItem}>
                <Text style={styles.benefitIcon}>✅</Text>
                <Text
                  style={[
                    styles.benefitText,
                    { color: currentTheme.colors.text },
                  ]}
                >
                  Advanced performance analytics
                </Text>
              </View>
              <View style={styles.benefitItem}>
                <Text style={styles.benefitIcon}>✅</Text>
                <Text
                  style={[
                    styles.benefitText,
                    { color: currentTheme.colors.text },
                  ]}
                >
                  Priority customer support
                </Text>
              </View>
              <View style={styles.benefitItem}>
                <Text style={styles.benefitIcon}>✅</Text>
                <Text
                  style={[
                    styles.benefitText,
                    { color: currentTheme.colors.text },
                  ]}
                >
                  Exclusive features and early access
                </Text>
              </View>
            </View>
          </View>

          {/* Platform Info Section */}
          <View
            style={[
              styles.platformSection,
              { backgroundColor: currentTheme.colors.background },
            ]}
          >
            <Text
              style={[
                styles.platformTitle,
                { color: currentTheme.colors.text },
              ]}
            >
              Subscription Platform
            </Text>
            <View style={styles.platformInfo}>
              <Text style={styles.platformIcon}>
                {Platform.OS === 'ios' ? '🍎' : Platform.OS === 'android' ? '🤖' : '🌐'}
              </Text>
              <View style={styles.platformDetails}>
                <Text
                  style={[
                    styles.platformText,
                    { color: currentTheme.colors.text },
                  ]}
                >
                  {subscriptionInfo.platform}
                </Text>
                <Text
                  style={[
                    styles.platformSubtext,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  Manage your subscription through {subscriptionInfo.platform}
                </Text>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsSection}>
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.supportButton,
                { backgroundColor: currentTheme.colors.primary },
              ]}
              onPress={handleContactSupport}
            >
              <Text style={styles.actionButtonText}>Priority Support</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.supportButton,
                { backgroundColor: currentTheme.colors.primary },
              ]}
              onPress={handleManageSubscription}
            >
              <Text style={styles.actionButtonText}>Manage Subscription</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.restoreButton,
                { backgroundColor: currentTheme.colors.background, borderWidth: 2, borderColor: currentTheme.colors.accent },
              ]}
              onPress={handleRefreshStatus}
              disabled={loading}
            >
              <Text style={[styles.restoreButtonText, { color: currentTheme.colors.accent }]}>
                {loading ? 'Refreshing...' : 'Refresh Status'}
              </Text>
            </TouchableOpacity>

            {(Platform.OS === 'ios' || Platform.OS === 'android') && (
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  styles.restoreButton,
                  { backgroundColor: currentTheme.colors.background, borderWidth: 2, borderColor: currentTheme.colors.primary },
                ]}
                onPress={handleRestorePurchases}
                disabled={loading}
              >
                <Text style={[styles.restoreButtonText, { color: currentTheme.colors.primary }]}>
                  Restore Purchases
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text
              style={[
                styles.footerText,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              Thank you for being a Pro member! Your support helps us continue
              improving EquiHUB.
            </Text>
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
  },
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
    marginBottom: -45,
    marginTop: -5,
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
  header: {
    fontSize: 30,
    fontFamily: "Inder",
    color: "#fff",
    textAlign: "center",
    flex: 1,
    fontWeight: "600",
  },
  viewPort: {
    backgroundColor: "#FFFFFF",
    flex: 1,
    borderTopLeftRadius: 50,
    borderTopRightRadius: 50,
    marginTop: 5,
    paddingTop: 15,
  },
  profileContainer: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  statusSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 30,
    padding: 30,
    marginBottom: 30,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  statusHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  statusEmoji: {
    fontSize: 40,
    marginRight: 15,
  },
  statusInfo: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 24,
    fontWeight: "bold",
    fontFamily: "Inder",
    marginBottom: 5,
  },
  statusBadge: {
    backgroundColor: "#4CAF50",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  statusBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "bold",
    fontFamily: "Inder",
  },
  subscriptionDetails: {
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
    paddingTop: 15,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  detailLabel: {
    fontSize: 14,
    fontFamily: "Inder",
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "bold",
    fontFamily: "Inder",
  },
  featuresSection: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "bold",
    fontFamily: "Inder",
    textAlign: "center",
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    fontFamily: "Inder",
    textAlign: "center",
    marginBottom: 20,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 20,
    borderRadius: 20,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  featureIcon: {
    fontSize: 24,
    marginRight: 15,
    width: 30,
    textAlign: "center",
    marginTop: 2,
  },
  featureContent: {
    flex: 1,
  },
  featureHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: "bold",
    fontFamily: "Inder",
    flex: 1,
    marginRight: 10,
  },
  featureStatusBadge: {
    backgroundColor: "#4CAF50",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  featureStatusText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "bold",
    fontFamily: "Inder",
  },
  featureDescription: {
    fontSize: 14,
    fontFamily: "Inder",
    lineHeight: 20,
  },
  benefitsSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 30,
    padding: 30,
    marginBottom: 30,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  benefitsTitle: {
    fontSize: 20,
    fontWeight: "bold",
    fontFamily: "Inder",
    textAlign: "center",
    marginBottom: 15,
  },
  benefitsList: {
    gap: 10,
  },
  benefitItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  benefitIcon: {
    fontSize: 16,
    marginRight: 10,
    width: 20,
  },
  benefitText: {
    fontSize: 14,
    fontFamily: "Inder",
    flex: 1,
  },
  actionsSection: {
    marginBottom: 30,
    gap: 15,
  },
  actionButton: {
    paddingVertical: 16,
    borderRadius: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 6,
  },
  supportButton: {
    backgroundColor: "#335C67",
  },
  restoreButton: {
    backgroundColor: "transparent",
  },
  restoreButtonText: {
    fontSize: 18,
    fontWeight: "bold",
    fontFamily: "Inder",
  },
  platformSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 30,
    padding: 30,
    marginBottom: 30,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  platformTitle: {
    fontSize: 20,
    fontWeight: "bold",
    fontFamily: "Inder",
    textAlign: "center",
    marginBottom: 15,
  },
  platformInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  platformIcon: {
    fontSize: 32,
    marginRight: 15,
  },
  platformDetails: {
    flex: 1,
  },
  platformText: {
    fontSize: 16,
    fontWeight: "bold",
    fontFamily: "Inder",
    marginBottom: 4,
  },
  platformSubtext: {
    fontSize: 14,
    fontFamily: "Inder",
    lineHeight: 18,
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
    fontFamily: "Inder",
  },
  footer: {
    alignItems: "center",
    paddingBottom: 30,
  },
  footerText: {
    fontSize: 14,
    fontFamily: "Inder",
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 20,
  },
});

export default ProFeaturesPage;
