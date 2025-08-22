import React, { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../contexts/ThemeContext";

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
  const theme = currentTheme.colors;
  const [posts, setPosts] = useState<Post[]>([]);
  const [friends, setFriends] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);

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

  useEffect(() => {
    setPosts(mockPosts);
    setFriends(mockFriends);
  }, []);

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

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      const filtered = mockSearchUsers.filter((user) =>
        user.name.toLowerCase().includes(query.toLowerCase())
      );
      setSearchResults(filtered);
    } else {
      setSearchResults([]);
    }
  };

  const handleAddFriend = (user: User) => {
    setFriends([...friends, { ...user, isFriend: true }]);
    setSearchResults(searchResults.filter((u) => u.id !== user.id));
    Alert.alert("Success", `Added ${user.name} as a friend!`);
  };

  const renderPost = ({ item }: { item: Post }) => (
    <View style={[styles.postCard, { backgroundColor: theme.surface }]}>
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

  const renderFriend = ({ item }: { item: User }) => (
    <View style={styles.friendItem}>
      <View style={styles.avatarContainer}>
        <Image source={{ uri: item.avatar }} style={styles.friendAvatar} />
        {item.isOnline && <View style={styles.onlineIndicator} />}
      </View>
      <Text style={[styles.friendName, { color: theme.text }]}>
        {item.name}
      </Text>
    </View>
  );

  const renderSearchResult = ({ item }: { item: User }) => (
    <View style={[styles.searchResultItem, { backgroundColor: theme.surface }]}>
      <View style={styles.userInfo}>
        <View style={styles.avatarContainer}>
          <Image source={{ uri: item.avatar }} style={styles.avatar} />
          {item.isOnline && <View style={styles.onlineIndicator} />}
        </View>
        <Text style={[styles.userName, { color: theme.text }]}>
          {item.name}
        </Text>
      </View>
      <TouchableOpacity
        style={[styles.addButton, { backgroundColor: theme.primary }]}
        onPress={() => handleAddFriend(item)}
      >
        <Text style={styles.addButtonText}>Add Friend</Text>
      </TouchableOpacity>
    </View>
  );

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
        {/* Friends Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Friends
          </Text>
          <FlatList
            data={friends}
            renderItem={renderFriend}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.friendsList}
          />
        </View>

        {/* Search Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Find Friends
          </Text>
          <TextInput
            style={[
              styles.searchInput,
              { backgroundColor: theme.surface, color: theme.text },
            ]}
            placeholder="Search for friends..."
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {searchResults.length > 0 && (
            <FlatList
              data={searchResults}
              renderItem={renderSearchResult}
              keyExtractor={(item) => item.id}
              style={styles.searchResults}
            />
          )}
        </View>

        {/* Posts Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Community Feed
          </Text>
          <FlatList
            data={posts}
            renderItem={renderPost}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
          />
        </View>
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
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 20,
    fontSize: 16,
  },
  searchResults: {
    marginTop: 8,
    maxHeight: 200,
  },
  searchResultItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  addButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
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
});
