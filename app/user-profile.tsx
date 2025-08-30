import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
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
  const [friendsCount, setFriendsCount] = useState(0);
  const [countersLoading, setCountersLoading] = useState(true);
  const [friendshipStatus, setFriendshipStatus] = useState<
    "none" | "pending" | "friends"
  >("none");
  const [sendingRequest, setSendingRequest] = useState(false);

  const isOwnProfile = user?.id === userId;

  useEffect(() => {
    if (userId) {
      loadProfile();
      loadCounters();
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
      const [horsesData, friendsResponse] = await Promise.all([
        HorseAPI.HorseAPI.getHorses(userId),
        UserAPI.UserAPI.getFriends(userId),
      ]);

      setHorsesCount(horsesData?.length || 0);
      setFriendsCount(friendsResponse?.friends?.length || 0);
    } catch (error) {
      console.error("Error loading counters:", error);
      setHorsesCount(0);
      setFriendsCount(0);
    } finally {
      setCountersLoading(false);
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

  const getProfileImage = () => {
    return {
      uri:
        profile?.profile_image_url ||
        "https://via.placeholder.com/150x150/cccccc/666666?text=User",
    };
  };

  if (loading) {
    return (
      <SafeAreaView
        style={[
          styles.container,
          { backgroundColor: currentTheme.colors.background },
        ]}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Text
              style={[
                styles.backButtonText,
                { color: currentTheme.colors.primary },
              ]}
            >
              ← Back
            </Text>
          </TouchableOpacity>
          <Text
            style={[styles.headerTitle, { color: currentTheme.colors.text }]}
          >
            Profile
          </Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={currentTheme.colors.primary} />
          <Text
            style={[
              styles.loadingText,
              { color: currentTheme.colors.textSecondary },
            ]}
          >
            Loading profile...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !profile) {
    return (
      <SafeAreaView
        style={[
          styles.container,
          { backgroundColor: currentTheme.colors.background },
        ]}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Text
              style={[
                styles.backButtonText,
                { color: currentTheme.colors.primary },
              ]}
            >
              ← Back
            </Text>
          </TouchableOpacity>
          <Text
            style={[styles.headerTitle, { color: currentTheme.colors.text }]}
          >
            Profile
          </Text>
          <View style={styles.headerSpacer} />
        </View>
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
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: currentTheme.colors.background },
      ]}
    >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text
            style={[
              styles.backButtonText,
              { color: currentTheme.colors.primary },
            ]}
          >
            ← Back
          </Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: currentTheme.colors.text }]}>
          {profile.name}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
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

        <Text style={[styles.userName, { color: currentTheme.colors.text }]}>
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
          <TouchableOpacity
            style={styles.counterItem}
            onPress={() =>
              router.push({
                pathname: "/user-friends",
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
              Friends
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
                {friendsCount}
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
                  { backgroundColor: currentTheme.colors.warning || "#FFA500" },
                ]}
              >
                <Text style={styles.statusText}>Friend Request Sent</Text>
              </View>
            )}
            {friendshipStatus === "friends" && (
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: currentTheme.colors.success || "#4CAF50" },
                ]}
              >
                <Text style={styles.statusText}>Friends</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  backButton: {
    padding: 5,
  },
  backButtonText: {
    fontSize: 16,
    fontFamily: "Inder",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    fontFamily: "Inder",
    textAlign: "center",
  },
  headerSpacer: {
    width: 50,
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
  content: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 20,
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
});

export default UserProfileScreen;
