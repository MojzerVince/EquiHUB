import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../contexts/AuthContext";
import { useDialog } from "../contexts/DialogContext";
import { useTheme } from "../contexts/ThemeContext";
import * as UserAPI from "../lib/userAPI";

interface FriendWithStatus extends UserAPI.UserSearchResult {
  friendshipStatus: "none" | "pending" | "friends" | "self";
}

const UserFriendsScreen = () => {
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { user } = useAuth();
  const { currentTheme } = useTheme();
  const { showError, showSuccess } = useDialog();

  const [friends, setFriends] = useState<FriendWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [addingFriends, setAddingFriends] = useState<Set<string>>(new Set());
  const [removingFriends, setRemovingFriends] = useState<Set<string>>(new Set());

  const isOwnProfile = user?.id === userId;

  useEffect(() => {
    loadFriends();
    loadUserProfile();
  }, [userId]);

  const loadFriends = async () => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      const friendsResponse = await UserAPI.UserAPI.getFriends(userId);

      if (friendsResponse.error) {
        setError(friendsResponse.error);
        setFriends([]);
        return;
      }

      // If viewing own profile, just show friends
      if (isOwnProfile) {
        const friendsWithStatus: FriendWithStatus[] =
          friendsResponse.friends.map((friend) => ({
            ...friend,
            friendshipStatus: "friends" as const,
          }));
        setFriends(friendsWithStatus);
      } else {
        // If viewing someone else's profile, check friendship status with current user
        const currentUserFriendsResponse = await UserAPI.UserAPI.getFriends(
          user?.id || ""
        );
        const currentUserFriendIds = new Set(
          currentUserFriendsResponse.friends?.map((f) => f.id) || []
        );

        const friendsWithStatus: FriendWithStatus[] =
          friendsResponse.friends.map((friend) => {
            let status: "none" | "pending" | "friends" | "self" = "none";

            if (friend.id === user?.id) {
              status = "self";
            } else if (currentUserFriendIds.has(friend.id)) {
              status = "friends";
            }
            // Note: We could also check for pending status here if needed

            return {
              ...friend,
              friendshipStatus: status,
            };
          });

        setFriends(friendsWithStatus);
      }
    } catch (error) {
      console.error("Error loading friends:", error);
      setError("Failed to load friends");
      setFriends([]);
    } finally {
      setLoading(false);
    }
  };

  const loadUserProfile = async () => {
    if (!userId) return;

    try {
      // Use direct REST API to get user profile
      const supabaseUrl = "https://grdsqxwghajehneksxik.supabase.co";
      const apiKey =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyZHNxeHdnaGFqZWhuZWtzeGlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQyMzIwMDUsImV4cCI6MjA2OTgwODAwNX0.PL2kAvrRGZbjnJcvKXMLVAaIF-ZfOWBOvzoPNVr9Fms";

      const response = await fetch(
        `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=name,profile_image_url`,
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
          setUserProfile(profiles[0]);
        }
      }
    } catch (error) {
      console.error("Error loading user profile:", error);
    }
  };

  const handleAddFriend = async (friendId: string) => {
    if (!user?.id) return;

    setAddingFriends((prev) => new Set(prev).add(friendId));

    try {
      const result = await UserAPI.UserAPI.sendFriendRequest(user.id, friendId);

      if (result.error) {
        showError(result.error);
      } else {
        showSuccess("Friend request sent!");
        // Update the friendship status
        setFriends((prev) =>
          prev.map((friend) =>
            friend.id === friendId
              ? { ...friend, friendshipStatus: "pending" }
              : friend
          )
        );
      }
    } catch (error) {
      console.error("Error sending friend request:", error);
      showError("Failed to send friend request");
    } finally {
      setAddingFriends((prev) => {
        const newSet = new Set(prev);
        newSet.delete(friendId);
        return newSet;
      });
    }
  };

  const handleRemoveFriend = async (friendId: string) => {
    if (!user?.id) return;

    setRemovingFriends((prev) => new Set(prev).add(friendId));

    try {
      const result = await UserAPI.UserAPI.removeFriend(user.id, friendId);

      if (result.error) {
        showError(result.error);
      } else {
        showSuccess("Friend removed successfully!");
        // Update the friendship status or reload friends
        if (isOwnProfile) {
          // If viewing own profile, remove the friend from the list
          setFriends((prev) => prev.filter((friend) => friend.id !== friendId));
        } else {
          // If viewing someone else's profile, update the status
          setFriends((prev) =>
            prev.map((friend) =>
              friend.id === friendId
                ? { ...friend, friendshipStatus: "none" }
                : friend
            )
          );
        }
      }
    } catch (error) {
      console.error("Error removing friend:", error);
      showError("Failed to remove friend");
    } finally {
      setRemovingFriends((prev) => {
        const newSet = new Set(prev);
        newSet.delete(friendId);
        return newSet;
      });
    }
  };

  const renderFriendItem = ({ item }: { item: FriendWithStatus }) => (
    <TouchableOpacity
      style={[
        styles.friendCard,
        { backgroundColor: currentTheme.colors.surface },
      ]}
      onPress={() =>
        router.push({ pathname: "/user-profile", params: { userId: item.id } })
      }
      activeOpacity={0.8}
    >
      <Image
        source={{
          uri:
            item.profile_image_url ||
            "https://via.placeholder.com/60x60/cccccc/666666?text=User",
        }}
        style={styles.friendImage}
      />
      <View style={styles.friendInfo}>
        <Text style={[styles.friendName, { color: currentTheme.colors.text }]}>
          {item.name}
        </Text>
        <Text
          style={[
            styles.friendAge,
            { color: currentTheme.colors.textSecondary },
          ]}
        >
          {item.age} years old
        </Text>
        {item.description && (
          <Text
            style={[
              styles.friendDescription,
              { color: currentTheme.colors.textSecondary },
            ]}
            numberOfLines={2}
          >
            {item.description}
          </Text>
        )}
        {item.is_pro_member && (
          <Text
            style={[styles.proBadge, { color: currentTheme.colors.primary }]}
          >
            PRO MEMBER
          </Text>
        )}
      </View>

      {!isOwnProfile && item.friendshipStatus !== "self" && (
        <TouchableOpacity
          style={styles.actionContainer}
          onPress={(e) => {
            e.stopPropagation(); // Prevent navigation when pressing action buttons
          }}
        >
          {item.friendshipStatus === "none" && (
            <TouchableOpacity
              style={[
                styles.addButton,
                { backgroundColor: currentTheme.colors.primary },
              ]}
              onPress={() => handleAddFriend(item.id)}
              disabled={addingFriends.has(item.id)}
            >
              {addingFriends.has(item.id) ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.addButtonText}>Add Friend</Text>
              )}
            </TouchableOpacity>
          )}
          {item.friendshipStatus === "pending" && (
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: currentTheme.colors.warning || "#FFA500" },
              ]}
            >
              <Text style={styles.statusText}>Pending</Text>
            </View>
          )}
          {item.friendshipStatus === "friends" && (
            <TouchableOpacity
              style={[
                styles.removeButton,
                { backgroundColor: currentTheme.colors.error || "#FF6B6B" },
              ]}
              onPress={() => handleRemoveFriend(item.id)}
              disabled={removingFriends.has(item.id)}
            >
              {removingFriends.has(item.id) ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.removeButtonText}>Delete Friend</Text>
              )}
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      )}

      {isOwnProfile && (
        <TouchableOpacity
          style={styles.actionContainer}
          onPress={(e) => {
            e.stopPropagation(); // Prevent navigation when pressing action buttons
          }}
        >
          <TouchableOpacity
            style={[
              styles.removeButton,
              { backgroundColor: currentTheme.colors.error || "#FF6B6B" },
            ]}
            onPress={() => handleRemoveFriend(item.id)}
            disabled={removingFriends.has(item.id)}
          >
            {removingFriends.has(item.id) ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.removeButtonText}>Delete Friend</Text>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

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
            {isOwnProfile ? "My Friends" : `${userProfile?.name || "User"}'s Friends`}
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
            Loading friends...
          </Text>
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
          {isOwnProfile ? "My Friends" : `${userProfile?.name || "User"}'s Friends`}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {error ? (
        <View style={styles.centered}>
          <Text
            style={[styles.errorText, { color: currentTheme.colors.error }]}
          >
            {error}
          </Text>
          <TouchableOpacity onPress={loadFriends} style={styles.retryButton}>
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
      ) : friends.length === 0 ? (
        <View style={styles.centered}>
          <Text
            style={[
              styles.emptyText,
              { color: currentTheme.colors.textSecondary },
            ]}
          >
            {`${userProfile?.name || "This user"} doesn't have any friends yet`}
          </Text>
        </View>
      ) : (
        <FlatList
          data={friends}
          renderItem={renderFriendItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}
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
  emptyText: {
    fontSize: 16,
    fontFamily: "Inder",
    textAlign: "center",
  },
  listContainer: {
    padding: 20,
  },
  friendCard: {
    flexDirection: "row",
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  friendImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 15,
  },
  friendInfo: {
    flex: 1,
    justifyContent: "center",
  },
  friendName: {
    fontSize: 18,
    fontWeight: "bold",
    fontFamily: "Inder",
    marginBottom: 3,
  },
  friendAge: {
    fontSize: 14,
    fontFamily: "Inder",
    marginBottom: 3,
  },
  friendDescription: {
    fontSize: 12,
    fontFamily: "Inder",
    marginBottom: 5,
  },
  proBadge: {
    fontSize: 10,
    fontWeight: "bold",
    fontFamily: "Inder",
  },
  actionContainer: {
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
  },
  addButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 80,
    alignItems: "center",
  },
  addButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
    fontFamily: "Inder",
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    minWidth: 70,
    alignItems: "center",
  },
  statusText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "bold",
    fontFamily: "Inder",
  },
  removeButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 80,
    alignItems: "center",
  },
  removeButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
    fontFamily: "Inder",
  },
});

export default UserFriendsScreen;
