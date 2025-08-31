import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../contexts/AuthContext";
import { useDialog } from "../contexts/DialogContext";
import { useTheme } from "../contexts/ThemeContext";
import * as HorseAPI from "../lib/horseAPI";
import { UserBadgeWithDetails } from "../lib/supabase";
import * as UserAPI from "../lib/userAPI";

interface UserProfile {
  id: string;
  name: string;
  age: number;
  description: string;
  experience: number;
  is_pro_member: boolean;
  profile_image_url?: string;
}

const UserProfileScreen = () => {
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { user } = useAuth();
  const { currentTheme } = useTheme();
  const { showError, showSuccess } = useDialog();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [horsesCount, setHorsesCount] = useState(0);
  const [countersLoading, setCountersLoading] = useState(true);
  const [friendshipStatus, setFriendshipStatus] = useState<
    "none" | "pending" | "friends"
  >("none");
  const [sendingRequest, setSendingRequest] = useState(false);

  // Badges state
  const [userBadges, setUserBadges] = useState<UserBadgeWithDetails[]>([]);
  const [badgesLoading, setBadgesLoading] = useState(false);
  const [badgeStats, setBadgeStats] = useState({
    totalBadges: 0,
    legendaryBadges: 0,
    epicBadges: 0,
    rareBadges: 0,
    commonBadges: 0,
    categories: {} as { [key: string]: number },
  });

  // Badge dialog state
  const [selectedBadge, setSelectedBadge] =
    useState<UserBadgeWithDetails | null>(null);
  const [badgeDialogVisible, setBadgeDialogVisible] = useState(false);

  const isOwnProfile = user?.id === userId;

  useEffect(() => {
    if (userId) {
      loadProfile();
      loadCounters();
      loadUserBadges();
      if (!isOwnProfile) {
        checkFriendshipStatus();
      }
    }
  }, [userId]);

  const loadProfile = async () => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      // Use direct REST API to get user profile
      const supabaseUrl = "https://grdsqxwghajehneksxik.supabase.co";
      const apiKey =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyZHNxeHdnaGFqZWhuZWtzeGlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQyMzIwMDUsImV4cCI6MjA2OTgwODAwNX0.PL2kAvrRGZbjnJcvKXMLVAaIF-ZfOWBOvzoPNVr9Fms";

      const response = await fetch(
        `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`,
        {
          headers: {
            apikey: apiKey,
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        const profiles = await response.json();
        if (profiles && profiles.length > 0) {
          setProfile(profiles[0]);
        } else {
          setError("User not found");
        }
      } else {
        setError("Failed to load user profile");
      }
    } catch (error) {
      console.error("Error loading user profile:", error);
      setError("Failed to load user profile");
    } finally {
      setLoading(false);
    }
  };

  const loadCounters = async () => {
    if (!userId) return;

    setCountersLoading(true);
    try {
      const horsesData = await HorseAPI.HorseAPI.getHorses(userId);

      setHorsesCount(horsesData?.length || 0);
    } catch (error) {
      console.error("Error loading counters:", error);
      setHorsesCount(0);
    } finally {
      setCountersLoading(false);
    }
  };

  // Direct API functions for badges
  const getUserBadgesDirectAPI = async (userId: string) => {
    try {
      const url = `https://grdsqxwghajehneksxik.supabase.co/rest/v1/user_badges?user_id=eq.${userId}&select=*,badge:badges!user_badges_badge_id_fkey(*)`;

      const response = (await Promise.race([
        fetch(url, {
          headers: {
            apikey:
              "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyZHNxeHdnaGFqZWhuZWtzeGlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQyMzIwMDUsImV4cCI6MjA2OTgwODAwNX0.PL2kAvrRGZbjnJcvKXMLVAaIF-ZfOWBOvzoPNVr9Fms",
            Authorization:
              "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyZHNxeHdnaGFqZWhuZWtzeGlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQyMzIwMDUsImV4cCI6MjA2OTgwODAwNX0.PL2kAvrRGZbjnJcvKXMLVAaIF-ZfOWBOvzoPNVr9Fms",
            "Content-Type": "application/json",
          },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("Badges API request timeout")),
            10000
          )
        ),
      ])) as Response;

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          "Badges API response not OK:",
          response.status,
          response.statusText
        );
        console.error("Error response body:", errorText);
        return [];
      }

      const badges = await response.json();
      return badges || [];
    } catch (error) {
      console.error("Error fetching badges via direct API:", error);
      return [];
    }
  };

  const getBadgeStatsDirectAPI = (badges: any[]) => {
    const stats = {
      totalBadges: badges.length,
      legendaryBadges: 0,
      epicBadges: 0,
      rareBadges: 0,
      commonBadges: 0,
      categories: {} as { [key: string]: number },
    };

    badges.forEach((userBadge) => {
      if (userBadge.badge) {
        const rarity = userBadge.badge.rarity;
        const category = userBadge.badge.category;

        // Count by rarity
        switch (rarity) {
          case "legendary":
            stats.legendaryBadges++;
            break;
          case "epic":
            stats.epicBadges++;
            break;
          case "rare":
            stats.rareBadges++;
            break;
          case "common":
            stats.commonBadges++;
            break;
        }

        // Count by category
        stats.categories[category] = (stats.categories[category] || 0) + 1;
      }
    });

    return stats;
  };

  const loadUserBadges = async () => {
    if (!userId) return;

    setBadgesLoading(true);
    try {
      // Load user badges using direct API with timeout
      const badges = await Promise.race([
        getUserBadgesDirectAPI(userId),
        new Promise<any[]>((_, reject) =>
          setTimeout(
            () => reject(new Error("Badge loading timeout after 10 seconds")),
            10000
          )
        ),
      ]);
      setUserBadges(badges);

      // Calculate badge statistics from the loaded badges
      const stats = getBadgeStatsDirectAPI(badges);
      setBadgeStats(stats);
    } catch (error) {
      console.error("Error loading user badges:", error);
      // Don't set error for badges, just log it and continue
      setUserBadges([]);
      setBadgeStats({
        totalBadges: 0,
        legendaryBadges: 0,
        epicBadges: 0,
        rareBadges: 0,
        commonBadges: 0,
        categories: {},
      });
    } finally {
      setBadgesLoading(false);
    }
  };

  const checkFriendshipStatus = async () => {
    if (!user?.id || !userId) return;

    try {
      const friendsResponse = await UserAPI.UserAPI.getFriends(user.id);
      const isFriend = friendsResponse.friends?.some(
        (friend) => friend.id === userId
      );

      if (isFriend) {
        setFriendshipStatus("friends");
      } else {
        // You could also check for pending requests here
        setFriendshipStatus("none");
      }
    } catch (error) {
      console.error("Error checking friendship status:", error);
    }
  };

  const handleAddFriend = async () => {
    if (!user?.id || !userId) return;

    setSendingRequest(true);
    try {
      const result = await UserAPI.UserAPI.sendFriendRequest(user.id, userId);

      if (result.error) {
        showError(result.error);
      } else {
        showSuccess("Friend request sent!");
        setFriendshipStatus("pending");
      }
    } catch (error) {
      console.error("Error sending friend request:", error);
      showError("Failed to send friend request");
    } finally {
      setSendingRequest(false);
    }
  };

  const handleBadgePress = (badge: UserBadgeWithDetails) => {
    setSelectedBadge(badge);
    setBadgeDialogVisible(true);
  };

  const closeBadgeDialog = () => {
    setBadgeDialogVisible(false);
    setSelectedBadge(null);
  };

  const getProfileImage = () => {
    return {
      uri:
        profile?.profile_image_url ||
        "https://via.placeholder.com/150x150/cccccc/666666?text=User",
    };
  };

  const renderBadgeDialog = () => (
    <Modal
      animationType="fade"
      transparent={true}
      visible={badgeDialogVisible}
      onRequestClose={closeBadgeDialog}
    >
      <View style={styles.badgeDialogOverlay}>
        <View style={styles.badgeDialogContainer}>
          {selectedBadge ? (
            <>
              <View style={styles.badgeDialogHeader}>
                <View
                  style={[
                    styles.badgeDialogIcon,
                    selectedBadge.badge.rarity === "legendary"
                      ? styles.legendaryBadge
                      : null,
                    selectedBadge.badge.rarity === "epic"
                      ? styles.epicBadge
                      : null,
                    selectedBadge.badge.rarity === "rare"
                      ? styles.rareBadge
                      : null,
                    selectedBadge.badge.rarity === "common"
                      ? styles.commonBadge
                      : null,
                  ]}
                >
                  <Text style={styles.badgeDialogEmoji}>
                    {selectedBadge.badge.icon_emoji}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.badgeDialogCloseButton}
                  onPress={closeBadgeDialog}
                >
                  <Text style={styles.badgeDialogCloseText}>✕</Text>
                </TouchableOpacity>
              </View>

              <Text
                style={[
                  styles.badgeDialogTitle,
                  { color: currentTheme.colors.text },
                ]}
              >
                {selectedBadge.badge.name}
              </Text>
              <Text
                style={[
                  styles.badgeDialogRarity,
                  { color: currentTheme.colors.textSecondary },
                ]}
              >
                {selectedBadge.badge.rarity.toUpperCase()} •{" "}
                {selectedBadge.badge.category.toUpperCase()}
              </Text>

              <Text
                style={[
                  styles.badgeDialogDescription,
                  { color: currentTheme.colors.text },
                ]}
              >
                {selectedBadge.badge.description}
              </Text>

              <View style={styles.badgeDialogFooter}>
                <Text
                  style={[
                    styles.badgeDialogEarnedText,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  Earned on{" "}
                  {new Date(selectedBadge.earned_at).toLocaleDateString()}
                </Text>
              </View>
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );

  if (loading) {
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
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Text style={styles.backIcon}>←</Text>
            </TouchableOpacity>
            <Text style={[styles.header, { color: "#FFFFFF" }]}>Profile</Text>
            <View style={styles.headerSpacer} />
          </View>
        </SafeAreaView>
        <View
          style={[
            styles.viewPort,
            { backgroundColor: currentTheme.colors.surface },
          ]}
        >
          <View style={styles.centered}>
            <ActivityIndicator
              size="large"
              color={currentTheme.colors.primary}
            />
            <Text
              style={[
                styles.loadingText,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              Loading profile...
            </Text>
          </View>
        </View>
      </View>
    );
  }

  if (error || !profile) {
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
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Text style={styles.backIcon}>←</Text>
            </TouchableOpacity>
            <Text style={[styles.header, { color: "#FFFFFF" }]}>Profile</Text>
            <View style={styles.headerSpacer} />
          </View>
        </SafeAreaView>
        <View
          style={[
            styles.viewPort,
            { backgroundColor: currentTheme.colors.surface },
          ]}
        >
          <View style={styles.centered}>
            <Text
              style={[styles.errorText, { color: currentTheme.colors.error }]}
            >
              {error || "Profile not found"}
            </Text>
            <TouchableOpacity onPress={loadProfile} style={styles.retryButton}>
              <Text
                style={[
                  styles.retryButtonText,
                  { color: currentTheme.colors.primary },
                ]}
              >
                Retry
              </Text>
            </TouchableOpacity>
          </View>
        </View>
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
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={[styles.header, { color: "#FFFFFF" }]}>
            {profile.name}
          </Text>
          <View style={styles.headerSpacer} />
        </View>
      </SafeAreaView>

      <ScrollView
        style={[
          styles.viewPort,
          { backgroundColor: currentTheme.colors.surface },
        ]}
      >
        <View style={styles.profileContainer}>
          {/* Profile Section */}
          <View
            style={[
              styles.profileSection,
              { backgroundColor: currentTheme.colors.background },
            ]}
          >
            <View style={styles.profileImageContainer}>
              <Image
                source={getProfileImage()}
                style={[
                  styles.profileImage,
                  { borderColor: currentTheme.colors.primary },
                ]}
              />
            </View>

            <Text
              style={[styles.userName, { color: currentTheme.colors.text }]}
            >
              {profile.name}
            </Text>
            <Text style={[styles.userAge, { color: currentTheme.colors.text }]}>
              {profile.age} years old
            </Text>
            <Text
              style={[
                styles.userDescription,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              {profile.description}
            </Text>

            <View style={styles.experienceContainer}>
              <Text
                style={[
                  styles.experienceLabel,
                  { color: currentTheme.colors.text },
                ]}
              >
                Experience
              </Text>
              <Text
                style={[
                  styles.experienceValue,
                  { color: currentTheme.colors.text },
                ]}
              >
                {profile.experience} years
              </Text>
            </View>

            {/* Counters Container */}
            <View style={styles.countersContainer}>
              <TouchableOpacity
                style={styles.counterItem}
                onPress={() =>
                  router.push({
                    pathname: "/user-horses",
                    params: { userId: userId },
                  })
                }
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.counterLabel,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  Horses
                </Text>
                {countersLoading ? (
                  <ActivityIndicator
                    size="small"
                    color={currentTheme.colors.primary}
                  />
                ) : (
                  <Text
                    style={[
                      styles.counterValue,
                      { color: currentTheme.colors.text },
                    ]}
                  >
                    {horsesCount}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.badgeContainer}>
              <View
                style={[
                  styles.badge,
                  profile.is_pro_member ? styles.proBadge : styles.regularBadge,
                  { backgroundColor: currentTheme.colors.surface },
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    profile.is_pro_member
                      ? styles.proBadgeText
                      : styles.regularBadgeText,
                    { color: currentTheme.colors.text },
                  ]}
                >
                  {profile.is_pro_member ? "PRO MEMBER" : "RIDER"}
                </Text>
              </View>
            </View>

            {!isOwnProfile && (
              <View style={styles.actionContainer}>
                {friendshipStatus === "none" && (
                  <TouchableOpacity
                    style={[
                      styles.addFriendButton,
                      { backgroundColor: currentTheme.colors.primary },
                    ]}
                    onPress={handleAddFriend}
                    disabled={sendingRequest}
                  >
                    {sendingRequest ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.addFriendButtonText}>Add Friend</Text>
                    )}
                  </TouchableOpacity>
                )}
                {friendshipStatus === "pending" && (
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor:
                          currentTheme.colors.warning || "#FFA500",
                      },
                    ]}
                  >
                    <Text style={styles.statusText}>Friend Request Sent</Text>
                  </View>
                )}
                {friendshipStatus === "friends" && (
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor:
                          currentTheme.colors.success || "#4CAF50",
                      },
                    ]}
                  >
                    <Text style={styles.statusText}>Friends</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>

        {/* Badges Section */}
        <View style={styles.badgesSection}>
          <View style={styles.badgesHeader}>
            <Text
              style={[styles.badgesTitle, { color: currentTheme.colors.text }]}
            >
              Achievements & Badges
            </Text>
            <View style={styles.badgeStatsContainer}>
              <Text
                style={[
                  styles.badgeStatsText,
                  { color: currentTheme.colors.textSecondary },
                ]}
              >
                {badgeStats.totalBadges} badges earned
              </Text>
            </View>
          </View>

          {badgesLoading ? (
            <View style={styles.badgesLoadingContainer}>
              <ActivityIndicator
                size="large"
                color={currentTheme.colors.primary}
              />
              <Text
                style={[
                  styles.badgesLoadingText,
                  { color: currentTheme.colors.text },
                ]}
              >
                Loading badges...
              </Text>
            </View>
          ) : userBadges.length > 0 ? (
            <View
              style={[
                styles.badgesGrid,
                { backgroundColor: currentTheme.colors.background },
              ]}
            >
              {userBadges.map((userBadge, index) => (
                <TouchableOpacity
                  key={userBadge.id}
                  style={styles.badgeItem}
                  onPress={() => handleBadgePress(userBadge)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.badgeIcon,
                      userBadge.badge.rarity === "legendary"
                        ? styles.legendaryBadge
                        : null,
                      userBadge.badge.rarity === "epic"
                        ? styles.epicBadge
                        : null,
                      userBadge.badge.rarity === "rare"
                        ? styles.rareBadge
                        : null,
                      userBadge.badge.rarity === "common"
                        ? styles.commonBadge
                        : null,
                    ]}
                  >
                    <Text style={styles.badgeEmoji}>
                      {userBadge.badge.icon_emoji}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.badgeLabel,
                      { color: currentTheme.colors.text },
                    ]}
                    numberOfLines={2}
                  >
                    {userBadge.badge.name}
                  </Text>
                  <Text
                    style={[
                      styles.badgeRarity,
                      { color: currentTheme.colors.textSecondary },
                    ]}
                  >
                    {userBadge.badge.rarity.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View
              style={[
                styles.noBadgesContainer,
                { backgroundColor: currentTheme.colors.background },
              ]}
            >
              <Text style={styles.noBadgesEmoji}>🏆</Text>
              <Text
                style={[
                  styles.noBadgesText,
                  { color: currentTheme.colors.text },
                ]}
              >
                No badges yet!
              </Text>
              <Text
                style={[
                  styles.noBadgesSubtext,
                  { color: currentTheme.colors.textSecondary },
                ]}
              >
                {isOwnProfile
                  ? "Complete your profile and participate in activities to earn badges."
                  : `${profile?.name} hasn't earned any badges yet.`}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Badge Dialog */}
      {renderBadgeDialog()}
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
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    marginBottom: -45,
    marginTop: -5,
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
    padding: 5,
  },
  backIcon: {
    fontSize: 24,
    color: "#fff",
  },
  headerSpacer: {
    width: 50,
  },
  viewPort: {
    flex: 1,
  },
  profileContainer: {
    flex: 1,
  },
  profileSection: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 30,
    borderRadius: 20,
    marginHorizontal: 20,
    marginVertical: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    fontFamily: "Inder",
  },
  errorText: {
    fontSize: 16,
    fontFamily: "Inder",
    textAlign: "center",
    marginBottom: 20,
  },
  retryButton: {
    padding: 10,
  },
  retryButtonText: {
    fontSize: 16,
    fontFamily: "Inder",
  },
  profileImageContainer: {
    marginBottom: 20,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
  },
  userName: {
    fontSize: 28,
    fontWeight: "bold",
    fontFamily: "Inder",
    marginBottom: 5,
    textAlign: "center",
  },
  userAge: {
    fontSize: 18,
    fontFamily: "Inder",
    marginBottom: 10,
    textAlign: "center",
  },
  userDescription: {
    fontSize: 16,
    fontFamily: "Inder",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 22,
  },
  experienceContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 15,
    paddingVertical: 15,
    paddingHorizontal: 20,
    marginBottom: 15,
    width: "100%",
    alignItems: "center",
  },
  experienceLabel: {
    fontSize: 16,
    fontFamily: "Inder",
    marginBottom: 5,
  },
  experienceValue: {
    fontSize: 24,
    fontWeight: "bold",
    fontFamily: "Inder",
  },
  countersContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 15,
    paddingVertical: 15,
    paddingHorizontal: 20,
    marginVertical: 15,
    width: "100%",
  },
  counterItem: {
    alignItems: "center",
    flex: 1,
  },
  counterLabel: {
    fontSize: 14,
    fontFamily: "Inder",
    marginBottom: 5,
  },
  counterValue: {
    fontSize: 24,
    fontWeight: "bold",
    fontFamily: "Inder",
  },
  badgeContainer: {
    marginVertical: 15,
    width: "100%",
    alignItems: "center",
  },
  badge: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  regularBadge: {
    borderWidth: 2,
    borderColor: "#4CAF50",
  },
  proBadge: {
    borderWidth: 2,
    borderColor: "#FFD700",
  },
  badgeText: {
    fontSize: 14,
    fontWeight: "bold",
    fontFamily: "Inder",
  },
  regularBadgeText: {
    color: "#4CAF50",
  },
  proBadgeText: {
    color: "#FFD700",
  },
  actionContainer: {
    width: "100%",
    alignItems: "center",
    marginTop: 20,
  },
  addFriendButton: {
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 150,
  },
  addFriendButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    fontFamily: "Inder",
  },
  statusBadge: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  statusText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
    fontFamily: "Inder",
  },
  // Badges styles
  badgesSection: {
    marginBottom: 30,
  },
  badgesHeader: {
    marginBottom: 20,
  },
  badgesTitle: {
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    fontFamily: "Inder",
    marginBottom: 8,
  },
  badgeStatsContainer: {
    alignItems: "center",
  },
  badgeStatsText: {
    fontSize: 14,
    fontFamily: "Inder",
    textAlign: "center",
  },
  badgesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
    borderRadius: 20,
    padding: 20,
    gap: 15,
  },
  badgeItem: {
    alignItems: "center",
    width: 90,
    marginBottom: 15,
  },
  badgeIcon: {
    width: 60,
    height: 60,
    backgroundColor: "#335C67",
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3,
  },
  legendaryBadge: {
    backgroundColor: "#FFD700",
    borderWidth: 2,
    borderColor: "#FFA500",
  },
  epicBadge: {
    backgroundColor: "#9C27B0",
    borderWidth: 2,
    borderColor: "#7B1FA2",
  },
  rareBadge: {
    backgroundColor: "#2196F3",
    borderWidth: 2,
    borderColor: "#1976D2",
  },
  commonBadge: {
    backgroundColor: "#4CAF50",
    borderWidth: 2,
    borderColor: "#388E3C",
  },
  badgeEmoji: {
    fontSize: 24,
    color: "#fff",
  },
  badgeLabel: {
    fontSize: 12,
    fontWeight: "bold",
    fontFamily: "Inder",
    textAlign: "center",
    lineHeight: 14,
    marginBottom: 2,
  },
  badgeRarity: {
    fontSize: 8,
    fontFamily: "Inder",
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  noBadgesContainer: {
    borderRadius: 20,
    padding: 40,
    alignItems: "center",
  },
  noBadgesEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  noBadgesText: {
    fontSize: 18,
    fontWeight: "bold",
    fontFamily: "Inder",
    marginBottom: 8,
  },
  noBadgesSubtext: {
    fontSize: 14,
    fontFamily: "Inder",
    textAlign: "center",
    lineHeight: 20,
  },
  badgesLoadingContainer: {
    paddingVertical: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  badgesLoadingText: {
    marginTop: 15,
    fontSize: 16,
    fontFamily: "Inder",
  },
  // Badge Dialog styles
  badgeDialogOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  badgeDialogContainer: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    width: "90%",
    maxWidth: 400,
    alignItems: "center",
  },
  badgeDialogHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    marginBottom: 15,
    position: "relative",
  },
  badgeDialogIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  badgeDialogEmoji: {
    fontSize: 40,
  },
  badgeDialogCloseButton: {
    position: "absolute",
    top: -10,
    right: -10,
    backgroundColor: "#666",
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  badgeDialogCloseText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  badgeDialogTitle: {
    fontSize: 24,
    fontWeight: "bold",
    fontFamily: "Inder",
    textAlign: "center",
    marginBottom: 5,
  },
  badgeDialogRarity: {
    fontSize: 14,
    fontFamily: "Inder",
    textAlign: "center",
    marginBottom: 15,
    fontWeight: "bold",
  },
  badgeDialogDescription: {
    fontSize: 16,
    fontFamily: "Inder",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 20,
  },
  badgeDialogFooter: {
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingTop: 15,
    width: "100%",
  },
  badgeDialogEarnedText: {
    fontSize: 14,
    fontFamily: "Inder",
    textAlign: "center",
    fontStyle: "italic",
  },
});

export default UserProfileScreen;
