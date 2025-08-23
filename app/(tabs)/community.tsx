import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { UserAPI, UserSearchResult } from "../../lib/userAPI";

// TypeScript interfaces
interface User {
  id: string;
  name: string;
  avatar: string;
  isOnline: boolean;
  isFriend: boolean;
}

interface Post {
  id: string;
  user: User;
  timestamp: string;
  content: string;
  image?: string;
  likes: number;
  comments: number;
  isLiked: boolean;
  sessionData?: {
    horseName: string;
    duration: string;
    distance: string;
    avgSpeed: string;
  };
}

export default function CommunityScreen() {
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const theme = currentTheme.colors;
  const [posts, setPosts] = useState<Post[]>([]);
  const [friends, setFriends] = useState<UserSearchResult[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [activeTab, setActiveTab] = useState<"Feed" | "Challenges" | "Groups">(
    "Feed"
  );

  // Default avatar URL for users without profile images
  const getAvatarUrl = (profileImageUrl?: string) => {
    return (
      profileImageUrl ||
      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150"
    );
  };

  // Mock data
  const mockPosts: Post[] = [
    {
      id: "1",
      user: {
        id: "user1",
        name: "Sarah Johnson",
        avatar:
          "https://images.unsplash.com/photo-1494790108755-2616b612b1-woman-smiling?w=150",
        isOnline: true,
        isFriend: true,
      },
      timestamp: "2 hours ago",
      content: "Amazing training session with Thunder today! 🐴",
      image: "https://images.unsplash.com/photo-1553284966-19b8815c7817?w=400",
      likes: 12,
      comments: 3,
      isLiked: false,
      sessionData: {
        horseName: "Thunder",
        duration: "45 min",
        distance: "3.2 km",
        avgSpeed: "4.3 km/h",
      },
    },
    {
      id: "2",
      user: {
        id: "user2",
        name: "Mike Chen",
        avatar:
          "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
        isOnline: false,
        isFriend: true,
      },
      timestamp: "4 hours ago",
      content: "Perfect weather for trail riding! Luna was in great spirits.",
      likes: 8,
      comments: 1,
      isLiked: true,
      sessionData: {
        horseName: "Luna",
        duration: "60 min",
        distance: "5.1 km",
        avgSpeed: "5.1 km/h",
      },
    },
    {
      id: "3",
      user: {
        id: "user3",
        name: "Emma Rodriguez",
        avatar:
          "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150",
        isOnline: true,
        isFriend: true,
      },
      timestamp: "1 day ago",
      content:
        "Working on dressage techniques with Storm. Progress is slow but steady!",
      likes: 15,
      comments: 5,
      isLiked: false,
      sessionData: {
        horseName: "Storm",
        duration: "30 min",
        distance: "1.8 km",
        avgSpeed: "3.6 km/h",
      },
    },
  ];

  const mockFriends: User[] = [
    {
      id: "friend1",
      name: "Alex Thompson",
      avatar:
        "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150",
      isOnline: true,
      isFriend: true,
    },
    {
      id: "friend2",
      name: "Jessica Lee",
      avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150",
      isOnline: false,
      isFriend: true,
    },
    {
      id: "friend3",
      name: "David Kim",
      avatar:
        "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150",
      isOnline: true,
      isFriend: true,
    },
  ];

  const mockSearchUsers: User[] = [
    {
      id: "search1",
      name: "Sophie Miller",
      avatar:
        "https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?w=150",
      isOnline: false,
      isFriend: false,
    },
    {
      id: "search2",
      name: "Ryan Taylor",
      avatar:
        "https://images.unsplash.com/photo-1507591064344-4c6ce005b128?w=150",
      isOnline: true,
      isFriend: false,
    },
  ];

  // Load friends when component mounts and user is available
  useEffect(() => {
    if (user?.id) {
      loadFriends();
    }

    // Load mock posts (you can replace this with real post data later)
    setPosts(mockPosts);
  }, [user]);

  // Debug effect to track isSearching state changes
  useEffect(() => {
    // Removed console logs for cleaner code
  }, [isSearching, searchResults.length, searchQuery]);

  // Load friends from database
  const loadFriends = async () => {
    if (!user?.id) {
      return;
    }

    setIsLoadingFriends(true);

    // Create a timeout promise that rejects after 10 seconds
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error("Loading friends timed out after 10 seconds"));
      }, 10000);
    });

    try {
      // Race between the API call and the timeout
      const { friends: userFriends, error } = await Promise.race([
        UserAPI.getFriends(user.id),
        timeoutPromise,
      ]) as { friends: UserSearchResult[]; error: string | null };

      if (error) {
        Alert.alert("Error", "Failed to load friends");
        setFriends([]); // Set empty array on error
        return;
      }

      // Set friends regardless of whether the array is empty or not
      setFriends(userFriends || []);
    } catch (error) {
      // Handle timeout specifically
      if (error instanceof Error && error.message.includes("timed out")) {
        Alert.alert(
          "Loading Timeout",
          "Loading friends took too long. Please check your connection and try again."
        );
      } else {
        Alert.alert("Error", "Failed to load friends");
      }
      setFriends([]); // Set empty array on error
    } finally {
      setIsLoadingFriends(false);
    }
  };

  // Search for users with manual trigger
  const handleSearchInput = (query: string) => {
    setSearchQuery(query);
    // Clear results when query changes but don't search automatically
    if (!query.trim()) {
      setSearchResults([]);
    }
  };

  const performSearch = useCallback(async () => {
    const query = searchQuery.trim();

    if (!query || !user?.id) {
      setSearchResults([]);
      return;
    }

    if (query.length < 2) {
      Alert.alert("Search", "Please enter at least 2 characters to search");
      return;
    }

    setIsSearching(true);

    // Create a timeout promise that rejects after 20 seconds (increased from 10)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error("Search timed out after 20 seconds"));
      }, 20000);
    });

    try {
      // Race between the API call and the timeout
      const { users, error } = (await Promise.race([
        UserAPI.searchUsersDirectAPI(query, user.id),
        timeoutPromise,
      ])) as { users: UserSearchResult[]; error: string | null };

      if (error) {
        Alert.alert("Search Error", error);
        setSearchResults([]); // Set empty results on error
        return;
      }

      // Ensure we have valid users array before setting state
      const validUsers = users && Array.isArray(users) ? users : [];
      setSearchResults(validUsers);
    } catch (error) {
      // Handle timeout specifically
      if (error instanceof Error && error.message.includes("timed out")) {
        Alert.alert(
          "Search Timeout",
          "Search took too long. Please try again with a more specific query."
        );
      } else {
        Alert.alert("Error", "Failed to search users");
      }

      setSearchResults([]); // Set empty results on error
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, user?.id]);

  // Add friend functionality
  const handleAddFriend = async (userToAdd: UserSearchResult) => {
    if (!user?.id) {
      return;
    }

    try {
      const { success, error } = await UserAPI.sendFriendRequest(
        user.id,
        userToAdd.id
      );

      if (error) {
        Alert.alert("Error", error);
        return;
      }

      if (success) {
        // Remove from search results
        const updatedResults = searchResults.filter(
          (u) => u.id !== userToAdd.id
        );
        setSearchResults(updatedResults);

        Alert.alert("Success", `Friend request sent to ${userToAdd.name}!`);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to send friend request");
    }
  };

  // Handle post likes (using mock data for now)
  const handleLike = (postId: string) => {
    setPosts(
      posts.map((post) =>
        post.id === postId
          ? {
              ...post,
              isLiked: !post.isLiked,
              likes: post.isLiked ? post.likes - 1 : post.likes + 1,
            }
          : post
      )
    );
  };

  const renderPost = ({ item }: { item: Post }) => (
    <View
      key={item.id}
      style={[styles.postCard, { backgroundColor: theme.surface }]}
    >
      <View style={styles.postHeader}>
        <View style={styles.userInfo}>
          <View style={styles.avatarContainer}>
            <Image source={{ uri: item.user.avatar }} style={styles.avatar} />
            {item.user.isOnline && <View style={styles.onlineIndicator} />}
          </View>
          <View>
            <Text style={[styles.userName, { color: theme.text }]}>
              {item.user.name}
            </Text>
            <Text style={[styles.timestamp, { color: theme.textSecondary }]}>
              {item.timestamp}
            </Text>
          </View>
        </View>
      </View>

      <Text style={[styles.postContent, { color: theme.text }]}>
        {item.content}
      </Text>

      {item.image && (
        <Image source={{ uri: item.image }} style={styles.postImage} />
      )}

      {item.sessionData && (
        <View style={[styles.sessionCard, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sessionTitle, { color: theme.primary }]}>
            Training Session with {item.sessionData.horseName}
          </Text>
          <View style={styles.sessionStats}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.text }]}>
                {item.sessionData.duration}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                Duration
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.text }]}>
                {item.sessionData.distance}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                Distance
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.text }]}>
                {item.sessionData.avgSpeed}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                Avg Speed
              </Text>
            </View>
          </View>
        </View>
      )}

      <View style={styles.postActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleLike(item.id)}
        >
          <Text
            style={[
              styles.actionText,
              { color: item.isLiked ? theme.primary : theme.textSecondary },
            ]}
          >
            ❤️ {item.likes}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Text style={[styles.actionText, { color: theme.textSecondary }]}>
            💬 {item.comments}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFriend = ({ item }: { item: UserSearchResult }) => (
    <View key={item.id} style={styles.friendItem}>
      <View style={styles.avatarContainer}>
        <Image
          source={{ uri: getAvatarUrl(item.profile_image_url) }}
          style={styles.friendAvatar}
        />
        {item.is_online && <View style={styles.onlineIndicator} />}
      </View>
      <Text style={[styles.friendName, { color: theme.text }]}>
        {item.name}
      </Text>
    </View>
  );

  const renderSearchResult = ({ item }: { item: UserSearchResult }) => {
    return (
      <View
        key={item.id}
        style={[styles.searchResultItem, { backgroundColor: theme.surface }]}
      >
        <View style={styles.userInfo}>
          <View style={styles.avatarContainer}>
            <Image
              source={{ uri: getAvatarUrl(item.profile_image_url) }}
              style={styles.avatar}
            />
            {item.is_online && <View style={styles.onlineIndicator} />}
          </View>
          <View style={styles.userDetails}>
            <Text style={[styles.userName, { color: theme.text }]}>
              {item.name}
            </Text>
            <Text style={[styles.userAge, { color: theme.textSecondary }]}>
              Age: {item.age}
            </Text>
            {item.description && (
              <Text
                style={[styles.userDescription, { color: theme.textSecondary }]}
                numberOfLines={1}
              >
                {item.description}
              </Text>
            )}
          </View>
        </View>
        {!item.is_friend && (
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: theme.primary }]}
            onPress={() => handleAddFriend(item)}
          >
            <Text style={styles.addButtonText}>Add Friend</Text>
          </TouchableOpacity>
        )}
        {item.is_friend && (
          <View
            style={[styles.friendBadge, { backgroundColor: theme.surface }]}
          >
            <Text
              style={[styles.friendBadgeText, { color: theme.textSecondary }]}
            >
              Friends
            </Text>
          </View>
        )}
      </View>
    );
  };

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
          <Text style={[styles.header, { color: "#FFFFFF" }]}>Community</Text>
        </View>
      </SafeAreaView>
      <ScrollView
        style={[
          styles.viewPort,
          { backgroundColor: currentTheme.colors.background },
        ]}
      >
        {/* Tab Selector */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === "Feed" && { backgroundColor: theme.primary },
            ]}
            onPress={() => setActiveTab("Feed")}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color: activeTab === "Feed" ? "#FFFFFF" : theme.textSecondary,
                },
              ]}
            >
              Feed
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === "Challenges" && { backgroundColor: theme.primary },
            ]}
            onPress={() => setActiveTab("Challenges")}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color:
                    activeTab === "Challenges"
                      ? "#FFFFFF"
                      : theme.textSecondary,
                },
              ]}
            >
              Challenges
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === "Groups" && { backgroundColor: theme.primary },
            ]}
            onPress={() => setActiveTab("Groups")}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color:
                    activeTab === "Groups" ? "#FFFFFF" : theme.textSecondary,
                },
              ]}
            >
              Groups
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        {!user ? (
          <View style={styles.notLoggedInContainer}>
            <Text style={styles.placeholderEmoji}>🔐</Text>
            <Text style={[styles.placeholderTitle, { color: theme.text }]}>
              Login Required
            </Text>
            <Text
              style={[styles.placeholderText, { color: theme.textSecondary }]}
            >
              Please log in to access the community features and connect with
              other riders.
            </Text>
          </View>
        ) : activeTab === "Feed" ? (
          <>
            {/* Friends Section */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Friends
              </Text>
              {isLoadingFriends ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator color={theme.primary} size="small" />
                  <Text
                    style={[styles.loadingText, { color: theme.textSecondary }]}
                  >
                    Loading friends...
                  </Text>
                </View>
              ) : friends.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.friendsList}
                >
                  {friends.map((item) => renderFriend({ item }))}
                </ScrollView>
              ) : (
                <View style={styles.noResultsContainer}>
                  <Text
                    style={[
                      styles.noResultsText,
                      { color: theme.textSecondary },
                    ]}
                  >
                    No friends yet. Start by searching for people to connect
                    with!
                  </Text>
                </View>
              )}
            </View>

            {/* Search Section */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Find Friends
              </Text>
              <View style={styles.searchContainer}>
                <TextInput
                  style={[
                    styles.searchInput,
                    { backgroundColor: theme.surface, color: theme.text },
                  ]}
                  placeholder="Search for friends..."
                  placeholderTextColor={theme.textSecondary}
                  value={searchQuery}
                  onChangeText={handleSearchInput}
                  onSubmitEditing={performSearch}
                  returnKeyType="search"
                />
                <TouchableOpacity
                  style={[
                    styles.searchButton,
                    { backgroundColor: theme.primary },
                  ]}
                  onPress={performSearch}
                  disabled={isSearching || searchQuery.trim().length < 2}
                >
                  {isSearching ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.searchButtonText}>🔍</Text>
                  )}
                </TouchableOpacity>
              </View>
              {isSearching && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator color={theme.primary} size="small" />
                  <Text
                    style={[styles.loadingText, { color: theme.textSecondary }]}
                  >
                    Searching...
                  </Text>
                </View>
              )}

              {/* Search Results Section */}
              {!isSearching && searchResults.length > 0 && (
                <View style={styles.searchResults}>
                  <Text
                    style={[
                      styles.sectionTitle,
                      { color: theme.text, fontSize: 16, marginBottom: 8 },
                    ]}
                  >
                    Search Results ({searchResults.length})
                  </Text>
                  <ScrollView
                    style={{ maxHeight: 500, width: "100%" }}
                    showsVerticalScrollIndicator={true}
                    nestedScrollEnabled={true}
                    contentContainerStyle={{ paddingRight: 4 }}
                  >
                    {searchResults.map((item, index) => {
                      return (
                        <View key={`search-result-${item.id}-${index}`}>
                          {renderSearchResult({ item })}
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* No Results Message */}
              {!isSearching &&
                searchQuery.trim().length >= 2 &&
                searchResults.length === 0 && (
                  <View style={styles.noResultsContainer}>
                    <Text
                      style={[
                        styles.noResultsText,
                        { color: theme.textSecondary },
                      ]}
                    >
                      No users found with the name "{searchQuery}"
                    </Text>
                  </View>
                )}
            </View>

            {/* Posts Section */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Community Feed
              </Text>
              <View>{posts.map((item) => renderPost({ item }))}</View>
            </View>
          </>
        ) : activeTab === "Challenges" ? (
          <View style={styles.placeholderContainer}>
            <View
              style={[
                styles.placeholderCard,
                { backgroundColor: theme.surface },
              ]}
            >
              <Text style={styles.placeholderEmoji}>🏆</Text>
              <Text style={[styles.placeholderTitle, { color: theme.text }]}>
                Challenges Coming Soon!
              </Text>
              <Text
                style={[styles.placeholderText, { color: theme.textSecondary }]}
              >
                Compete with friends in exciting equestrian challenges.{"\n\n"}•
                Weekly riding challenges{"\n"}• Distance competitions{"\n"}•
                Skill-based contests{"\n"}• Leaderboards and rewards
              </Text>
              <View
                style={[
                  styles.placeholderBadge,
                  { backgroundColor: theme.primary },
                ]}
              >
                <Text style={styles.placeholderBadgeText}>
                  Under Development
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.placeholderContainer}>
            <View
              style={[
                styles.placeholderCard,
                { backgroundColor: theme.surface },
              ]}
            >
              <Text style={styles.placeholderEmoji}>👥</Text>
              <Text style={[styles.placeholderTitle, { color: theme.text }]}>
                Groups Coming Soon!
              </Text>
              <Text
                style={[styles.placeholderText, { color: theme.textSecondary }]}
              >
                Join riding groups and connect with local equestrian
                communities.{"\n\n"}• Local riding clubs{"\n"}• Training groups
                {"\n"}• Event coordination{"\n"}• Group chat and planning
              </Text>
              <View
                style={[
                  styles.placeholderBadge,
                  { backgroundColor: theme.primary },
                ]}
              >
                <Text style={styles.placeholderBadgeText}>
                  Under Development
                </Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#335C67",
  },
  safeArea: {
    backgroundColor: "#335C67",
    paddingBottom: 5,
  },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    marginBottom: -45,
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
    paddingTop: 30,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#F8F9FA",
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: 25,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  tabText: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inder",
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 30,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 12,
  },
  friendsList: {
    paddingVertical: 8,
  },
  friendItem: {
    alignItems: "center",
    marginRight: 16,
  },
  friendAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  friendName: {
    fontSize: 12,
    marginTop: 4,
    textAlign: "center",
  },
  searchInput: {
    flex: 1,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 20,
    fontSize: 16,
    marginRight: 8,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  searchButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  searchButtonText: {
    fontSize: 18,
    color: "#FFFFFF",
  },
  searchResults: {
    marginTop: 12,
    padding: 8,
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    maxHeight: 500,
    overflow: "hidden",
    width: "100%",
  },
  searchResultItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    width: "100%",
    flex: 1,
  },
  addButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 80,
    flexShrink: 0,
  },
  addButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "bold",
  },
  postCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  postHeader: {
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  avatarContainer: {
    position: "relative",
    marginRight: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  onlineIndicator: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#4CAF50",
    borderWidth: 2,
    borderColor: "white",
  },
  userName: {
    fontSize: 16,
    fontWeight: "bold",
  },
  timestamp: {
    fontSize: 12,
    marginTop: 2,
  },
  postContent: {
    fontSize: 16,
    lineHeight: 20,
    marginBottom: 12,
  },
  postImage: {
    width: "100%",
    height: 200,
    borderRadius: 8,
    marginBottom: 12,
  },
  sessionCard: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  sessionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 8,
  },
  sessionStats: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 16,
    fontWeight: "bold",
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  postActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
  actionButton: {
    flex: 1,
    alignItems: "center",
  },
  actionText: {
    fontSize: 14,
    fontWeight: "500",
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  placeholderCard: {
    padding: 32,
    borderRadius: 20,
    alignItems: "center",
    maxWidth: 320,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  placeholderEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  placeholderTitle: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 16,
    fontFamily: "Inder",
  },
  placeholderText: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 24,
  },
  placeholderBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  placeholderBadgeText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  userDetails: {
    flex: 1,
  },
  userAge: {
    fontSize: 12,
    marginTop: 2,
  },
  userDescription: {
    fontSize: 12,
    marginTop: 4,
    fontStyle: "italic",
  },
  friendBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  friendBadgeText: {
    fontSize: 12,
    fontWeight: "500",
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
  },
  noResultsContainer: {
    padding: 16,
    alignItems: "center",
  },
  noResultsText: {
    fontSize: 14,
    textAlign: "center",
  },
  notLoggedInContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 60,
  },
});
