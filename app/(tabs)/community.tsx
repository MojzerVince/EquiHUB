import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import * as Notifications from "expo-notifications";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  RefreshControl,
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
import { CommunityAPI, PostWithUser } from "../../lib/communityAPI";
import { HiddenPostsManager } from "../../lib/hiddenPostsManager";
import { getImageDataUrl } from "../../lib/imageUtils";
import {
  NotificationService,
  handleNotificationResponse,
} from "../../lib/notificationService";
import { ProfileAPIBase64 } from "../../lib/profileAPIBase64";
import { supabase, supabaseUrl } from "../../lib/supabase";
import { UserAPI, UserSearchResult } from "../../lib/userAPI";

// TypeScript interfaces
interface FriendRequest {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_avatar?: string;
  receiver_id: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
}
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
  isLiked: boolean;
  sessionData?: {
    horseName: string;
    duration: string;
    distance: string;
    avgSpeed: string;
    horseImageUrl?: string;
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
  const [isLoadingPosts, setIsLoadingPosts] = useState(false); // Start as false, set to true when loading begins
  const [activeTab, setActiveTab] = useState<"Feed" | "Challenges" | "Groups">(
    "Feed"
  );
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [hiddenPostIds, setHiddenPostIds] = useState<string[]>([]);
  const [showPostMenu, setShowPostMenu] = useState<string | null>(null);
  const [reportingPost, setReportingPost] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [forceRender, setForceRender] = useState(0); // Add this to force re-renders
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  // Refs to track loading operations and prevent duplicates
  const isLoadingPostsRef = useRef(false);
  const isLoadingFriendRequestsRef = useRef(false);
  const isLoadingFriendsRef = useRef(false);

  // Memoize filtered posts to prevent excessive filtering on every render
  const visiblePosts = useMemo(() => {
    return posts.filter((post) => !hiddenPostIds.includes(post.id));
  }, [posts, hiddenPostIds]);

  // Default avatar URL for users without profile images
  const getAvatarUrl = (profileImageUrl?: string) => {
    return (
      profileImageUrl ||
      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150"
    );
  };

  // Helper function to get the best available image URL (base64 > image_url)
  const getBestImageUrl = (
    imageUrl?: string,
    imageBase64?: string
  ): string | undefined => {
    if (imageBase64) {
      // Convert base64 to data URL
      return getImageDataUrl(imageBase64, "image/jpeg");
    }
    if (imageUrl) {
    }
    return imageUrl;
  };

  // Helper function to get session uploaded image (only base64)
  const getSessionUploadedImage = (
    imageBase64?: string
  ): string | undefined => {
    if (imageBase64) {
      return getImageDataUrl(imageBase64, "image/jpeg");
    }
    return undefined;
  };

  // Helper function to get horse profile image (only image_url)
  const getHorseProfileImage = (imageUrl?: string): string | undefined => {
    if (imageUrl) {
      return imageUrl;
    }
    return undefined;
  };

  const mockFriends: User[] = [
    {
      id: "friend1",
      name: "Alex Thompson",
      avatar: getAvatarUrl(undefined), // Use default avatar
      isOnline: true,
      isFriend: true,
    },
    {
      id: "friend2",
      name: "Jessica Lee",
      avatar: getAvatarUrl(undefined), // Use default avatar
      isOnline: false,
      isFriend: true,
    },
    {
      id: "friend3",
      name: "David Kim",
      avatar: getAvatarUrl(undefined), // Use default avatar
      isOnline: true,
      isFriend: true,
    },
  ];

  const mockSearchUsers: User[] = [
    {
      id: "search1",
      name: "Sophie Miller",
      avatar: getAvatarUrl(undefined), // Use default avatar
      isOnline: false,
      isFriend: false,
    },
    {
      id: "search2",
      name: "Ryan Taylor",
      avatar: getAvatarUrl(undefined), // Use default avatar
      isOnline: true,
      isFriend: false,
    },
  ];

  // Load friends when component mounts and user is available (optimized)
  useEffect(() => {
    console.log("🎯 Initial data useEffect triggered, user?.id:", !!user?.id);
    if (user?.id) {
      // Use a flag to prevent multiple simultaneous loads
      let isMounted = true;

      const loadInitialData = async () => {
        if (!isMounted) return;

        console.log("🚀 Starting initial data load...");
        try {
          // Load data in parallel for better performance
          await Promise.all([
            loadFriends(),
            loadFriendRequests(),
            loadHiddenPosts(),
            loadPosts(),
          ]);
          console.log("✅ Initial data load complete");
        } catch (error) {
          console.error("Error loading initial community data:", error);
        }
      };

      loadInitialData();

      return () => {
        isMounted = false;
      };
    }
  }, [user?.id]); // Remove other dependencies to prevent multiple calls

  // Setup push notifications
  useEffect(() => {
    let notificationListener: Notifications.Subscription;
    let responseListener: Notifications.Subscription;

    const setupNotifications = async () => {
      if (user?.id) {
        try {
          // Register for push notifications and get token
          const token =
            await NotificationService.registerForPushNotificationsAsync();

          if (token) {
            // Save the token to the database
            await NotificationService.savePushToken(user.id, token);
            console.log("Push notification token registered successfully");
          }
        } catch (error) {
          console.error("Error setting up push notifications:", error);
        }
      }

      // Listen for notifications received while app is running
      notificationListener = Notifications.addNotificationReceivedListener(
        (notification) => {
          console.log("Notification received:", notification);
          // Refresh friend requests when a friend request notification is received
          if (notification.request.content.data?.type === "friend_request") {
            loadFriendRequests();
          }
        }
      );

      // Listen for notification responses (when user taps on notification)
      responseListener = Notifications.addNotificationResponseReceivedListener(
        (response) => {
          console.log("Notification response:", response);
          handleNotificationResponse(response);

          // If it's a friend request notification, open the notifications modal
          if (
            response.notification.request.content.data?.type ===
            "friend_request"
          ) {
            setShowNotifications(true);
            loadFriendRequests();
          }
        }
      );
    };

    setupNotifications();

    // Cleanup listeners
    return () => {
      if (notificationListener) {
        notificationListener.remove();
      }
      if (responseListener) {
        responseListener.remove();
      }
    };
  }, [user]);

  // Load posts from database
  const loadPosts = useCallback(async () => {
    console.log(
      "🔄 loadPosts called, ref:",
      isLoadingPostsRef.current,
      "state:",
      isLoadingPosts,
      "user.id:",
      user?.id
    );

    // Prevent concurrent calls using ref (more reliable than state)
    if (isLoadingPostsRef.current) {
      console.log("⚠️ Posts already loading (ref check), skipping...");
      return;
    }

    isLoadingPostsRef.current = true;

    console.log("🚀 Setting isLoadingPosts to true...");
    setIsLoadingPosts(true);

    try {
      let allPosts: Post[] = [];

      // Load posts from database if user is logged in
      if (user?.id) {
        console.log("👤 Loading posts for user:", user.id);

        // Make the real API call
        const { posts: dbPosts, error } = await CommunityAPI.getFeedPosts(
          user.id
        );

        if (error) {
          console.error("Error loading posts from database:", error);
        } else {
          console.log("📦 Raw posts from API:", dbPosts?.length || 0);
          // Convert database posts to the format expected by the UI
          const formattedPosts: Post[] = dbPosts.map((dbPost: PostWithUser) => {
            // Separate session uploaded image (base64) from horse profile image (image_url)
            const sessionUploadedImage = getSessionUploadedImage(
              dbPost.image_base64
            );

            // For horse profile image, try multiple sources in order of preference:
            // 1. session_data.horse_image_url (new format)
            // 2. image_url (if it's a session post, this should be the horse image)
            const horseProfileImage =
              dbPost.session_data?.horse_image_url ||
              (dbPost.session_data
                ? getHorseProfileImage(dbPost.image_url)
                : undefined);

            return {
              id: dbPost.id,
              user: {
                id: dbPost.profiles.id,
                name: dbPost.profiles.name,
                avatar: getAvatarUrl(dbPost.profiles.profile_image_url),
                isOnline: true,
                isFriend: true,
              },
              timestamp: new Date(dbPost.created_at).toLocaleString(),
              content: dbPost.content,
              image: sessionUploadedImage, // Only use base64 for main post image
              likes: dbPost.likes_count,
              isLiked: dbPost.is_liked || false,
              sessionData: dbPost.session_data
                ? {
                    horseName: dbPost.session_data.horse_name,
                    duration: dbPost.session_data.duration,
                    distance: dbPost.session_data.distance,
                    avgSpeed: dbPost.session_data.avg_speed,
                    horseImageUrl: horseProfileImage, // Use the properly determined horse profile image
                  }
                : undefined,
            };
          });

          allPosts = formattedPosts;
        }
      } else {
        console.log("❌ No user ID available, cannot load posts");
      }

      console.log("📝 Setting posts, count:", allPosts.length);
      setPosts(allPosts);
      console.log("✅ Posts set successfully");
    } catch (error) {
      console.error("Error loading posts:", error);
      // Set empty posts on error
      setPosts([]);
    } finally {
      console.log("🏁 loadPosts complete, resetting loading flags");
      setIsLoadingPosts(false);
      isLoadingPostsRef.current = false;
    }
  }, [user?.id]);

  // Load incoming friend requests
  const loadFriendRequests = useCallback(async () => {
    if (!user?.id) {
      setIsLoadingRequests(false);
      setFriendRequests([]);
      setNotificationCount(0);
      return;
    }

    // Prevent concurrent calls using ref
    if (isLoadingFriendRequestsRef.current) {
      console.log(
        "⚠️ Friend requests already loading (ref check), skipping..."
      );
      return;
    }

    isLoadingFriendRequestsRef.current = true;

    setIsLoadingRequests(true);

    try {
      // Use CommunityAPI REST endpoint
      const { requests, error } = await CommunityAPI.getPendingFriendRequests(
        user.id
      );

      if (error) {
        console.error("❌ Error loading friend requests:", error);
        setFriendRequests([]);
        setNotificationCount(0);
        return;
      }

      const friendRequestsList: FriendRequest[] = (requests || []).map(
        (request) => ({
          id: request.id,
          sender_id: request.user_id, // user_id is the sender
          sender_name: request.sender_name || "Unknown User",
          sender_avatar: request.sender_avatar,
          receiver_id: user.id,
          status: request.status as "pending" | "accepted" | "declined",
          created_at: request.created_at,
        })
      );

      if (friendRequestsList.length === 0) {
        console.log("� No pending friend requests found");
      }
      setFriendRequests(friendRequestsList);
      setNotificationCount(friendRequestsList.length);
    } catch (error) {
      console.error("💥 Exception loading friend requests:", error);
      setFriendRequests([]);
      setNotificationCount(0);
    } finally {
      setIsLoadingRequests(false);
      isLoadingFriendRequestsRef.current = false;
    }
  }, [user?.id]);

  // Handle accepting a friend request
  const handleAcceptFriendRequest = async (request: FriendRequest) => {
    if (!user?.id) return;

    try {
      // Use CommunityAPI REST endpoint instead of UserAPI
      const { success, error } = await CommunityAPI.acceptFriendRequest(
        user.id,
        request.sender_id
      );

      if (error) {
        Alert.alert("Error", error);
        return;
      }

      if (success) {
        // Remove from friend requests
        setFriendRequests((prev) =>
          prev.filter((req) => req.id !== request.id)
        );
        setNotificationCount((prev) => Math.max(0, prev - 1));

        // Refresh friends list
        await loadFriends();

        Alert.alert(
          "Success",
          `You are now friends with ${request.sender_name}!`
        );
      }
    } catch (error) {
      Alert.alert("Error", "Failed to accept friend request");
    }
  };

  // Handle declining a friend request
  const handleDeclineFriendRequest = async (request: FriendRequest) => {
    try {
      // For now, just remove from local state since there's no decline API
      setFriendRequests((prev) => prev.filter((req) => req.id !== request.id));
      setNotificationCount((prev) => Math.max(0, prev - 1));

      Alert.alert(
        "Request Declined",
        `Friend request from ${request.sender_name} was declined.`
      );
    } catch (error) {
      Alert.alert("Error", "Failed to decline friend request");
    }
  };

  // Load hidden posts from storage
  const loadHiddenPosts = useCallback(async () => {
    if (!user?.id) {
      setHiddenPostIds([]);
      return;
    }

    try {
      const hiddenIds = await HiddenPostsManager.getHiddenPostIds(user.id);
      setHiddenPostIds(hiddenIds);
    } catch (error) {
      console.error("Error loading hidden posts:", error);
      setHiddenPostIds([]);
    }
  }, [user?.id]);

  // Handle hiding a post
  const handleHidePost = async (post: Post) => {
    if (!user?.id) return;

    try {
      const success = await HiddenPostsManager.hidePost(
        user.id,
        post.id,
        post.user.name,
        post.content
      );

      if (success) {
        // Update local state to hide the post immediately
        setHiddenPostIds((prev) => [...prev, post.id]);
        setShowPostMenu(null);
        // Force a re-render to ensure the post is hidden immediately
        setForceRender((prev) => prev + 1);
        Alert.alert(
          "Success",
          "Post has been hidden. You can view hidden posts in the Options tab."
        );
      } else {
        Alert.alert("Error", "Failed to hide post. Please try again.");
      }
    } catch (error) {
      console.error("Error hiding post:", error);
      Alert.alert("Error", "Failed to hide post. Please try again.");
    }
  };

  // Handle reporting a post
  const handleReportPost = async (post: Post) => {
    if (!user?.id || !reportReason.trim()) {
      Alert.alert("Error", "Please provide a reason for reporting this post.");
      return;
    }

    try {
      const { success, error } = await CommunityAPI.reportPost(
        post.id,
        user.id,
        reportReason.trim()
      );

      if (success) {
        setReportingPost(null);
        setReportReason("");
        setShowPostMenu(null);
        Alert.alert(
          "Success",
          "Post has been reported. Thank you for helping keep our community safe."
        );
      } else {
        Alert.alert(
          "Error",
          error || "Failed to report post. Please try again."
        );
      }
    } catch (error) {
      console.error("Error reporting post:", error);
      Alert.alert("Error", "Failed to report post. Please try again.");
    }
  };

  // Handle deleting a post (for user's own posts)
  const handleDeletePost = async (post: Post) => {
    if (!user?.id || user.id !== post.user.id) {
      Alert.alert("Error", "You can only delete your own posts.");
      return;
    }

    Alert.alert(
      "Delete Post",
      "Are you sure you want to delete this post? This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const { success, error } = await CommunityAPI.deletePost(
                post.id,
                user.id
              );

              if (success) {
                // Remove the post from local state immediately
                setPosts((prevPosts) =>
                  prevPosts.filter((p) => p.id !== post.id)
                );
                setShowPostMenu(null);
                Alert.alert("Success", "Post has been deleted.");
              } else {
                Alert.alert(
                  "Error",
                  error || "Failed to delete post. Please try again."
                );
              }
            } catch (error) {
              console.error("Error deleting post:", error);
              Alert.alert("Error", "Failed to delete post. Please try again.");
            }
          },
        },
      ]
    );
  };

  // Debug effect to track isSearching state changes
  useEffect(() => {
    // Removed console logs for cleaner code
  }, [isSearching, searchResults.length, searchQuery]);

  // Periodic refresh of friend requests when user is active (very reduced frequency)
  useEffect(() => {
    if (!user?.id) return;

    const interval = setInterval(() => {
      // Only refresh if there are pending requests to reduce API calls
      if (friendRequests.length > 0) {
        loadFriendRequests();
      }
    }, 600000); // Check every 10 minutes instead of 5 minutes

    return () => clearInterval(interval);
  }, [user?.id, friendRequests.length, loadFriendRequests]); // Add loadFriendRequests to dependencies

  // Load friends from database
  const loadFriends = useCallback(async () => {
    if (!user?.id) {
      setIsLoadingFriends(false);
      setFriends([]);
      return;
    }

    // Prevent concurrent calls using ref
    if (isLoadingFriendsRef.current) {
      console.log("⚠️ Friends already loading (ref check), skipping...");
      return;
    }

    isLoadingFriendsRef.current = true;

    setIsLoadingFriends(true);

    try {
      // Temporary fix: Just set empty state immediately
      // TODO: Re-enable API call once connection issues are resolved
      setTimeout(() => {
        setFriends([]);
        setIsLoadingFriends(false);
        isLoadingFriendsRef.current = false;
      }, 500); // Small delay to show it's working

      /*
      // Original API call - commented out temporarily
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error("Loading friends timed out after 10 seconds"));
        }, 10000);
      });

      const { friends: userFriends, error } = await Promise.race([
        UserAPI.getFriends(user.id),
        timeoutPromise,
      ]) as { friends: UserSearchResult[]; error: string | null };

      if (error) {
        Alert.alert("Error", "Failed to load friends");
        setFriends([]);
        return;
      }

      setFriends(userFriends || []);
      */
    } catch (error) {
      console.error("Error loading friends:", error);
      setFriends([]);
      setIsLoadingFriends(false);
      isLoadingFriendsRef.current = false;
    }
  }, [user?.id]);

  // Refresh function to reload all data
  const onRefresh = useCallback(async () => {
    if (!user?.id) return;

    setRefreshing(true);

    try {
      // Run all loading functions in parallel for faster refresh
      await Promise.all([
        loadFriendRequests(),
        loadFriends(),
        loadHiddenPosts(),
        loadPosts(), // Always refresh posts on manual pull-to-refresh
      ]);
    } catch (error) {
      console.error("Error refreshing community data:", error);
      Alert.alert(
        "Refresh Error",
        "Failed to refresh community data. Please try again."
      );
    } finally {
      setRefreshing(false);
    }
  }, [user?.id]); // Remove function dependencies to prevent excessive re-creation

  // Refresh all data when screen is focused (optimized to prevent duplicate calls)
  useFocusEffect(
    useCallback(() => {
      // Only run on focus if we don't have data and we're not currently loading
      if (!user?.id) return;

      // Add a small delay to prevent conflict with initial data loading
      const timeoutId = setTimeout(() => {
        // Only reload if we actually need data and nothing is loading
        if (friends.length === 0 && !isLoadingFriends) {
          loadFriends();
        }
        // Only reload friend requests if we have none and aren't already loading
        if (friendRequests.length === 0 && !isLoadingRequests) {
          loadFriendRequests();
        }
        if (hiddenPostIds.length === 0) {
          loadHiddenPosts();
        }
        // Only reload posts if we have none and aren't already loading
        if (posts.length === 0 && !isLoadingPosts) {
          loadPosts();
        }
      }, 200); // Slightly longer delay to ensure initial load completes

      return () => clearTimeout(timeoutId);
    }, [user?.id]) // Remove other dependencies to prevent excessive re-runs
  );

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
    console.log(
      "🎯 handleAddFriend called for user:",
      userToAdd.name,
      userToAdd.id
    );

    if (!user?.id) {
      console.log("❌ No user logged in");
      Alert.alert("Error", "You must be logged in to send friend requests");
      return;
    }

    console.log("👤 Current user:", user.id);
    console.log("📤 Sending friend request using REST API...");

    try {
      // Get the current auth token using REST API instead of supabase.auth.getSession()
      console.log("🔑 Getting auth token via REST API...");

      // Try to get stored session from AsyncStorage first (more reliable)
      let authToken: string | null = null;

      try {
        // Supabase stores session data under this key format
        const supabaseSessionKey = `sb-${
          supabaseUrl.split("//")[1].split(".")[0]
        }-auth-token`;
        console.log(
          "🔍 Looking for session in AsyncStorage with key:",
          supabaseSessionKey
        );

        const sessionData = await AsyncStorage.getItem(supabaseSessionKey);
        if (sessionData) {
          console.log("📱 Found session data in AsyncStorage");
          const parsedSession = JSON.parse(sessionData);
          authToken = parsedSession.access_token;
          console.log("📱 Got auth token from AsyncStorage:", !!authToken);
        } else {
          console.log("📱 No session data found in AsyncStorage");

          // Try alternative keys that Supabase might use
          const allKeys = await AsyncStorage.getAllKeys();
          console.log(
            "� All AsyncStorage keys:",
            allKeys.filter(
              (key) => key.includes("supabase") || key.includes("auth")
            )
          );

          // Try to find any Supabase auth keys
          const authKeys = allKeys.filter(
            (key) => key.includes("supabase") && key.includes("auth")
          );

          for (const key of authKeys) {
            try {
              const data = await AsyncStorage.getItem(key);
              if (data) {
                const parsed = JSON.parse(data);
                if (parsed.access_token) {
                  authToken = parsed.access_token;
                  //console.log("📱 Found auth token in key:", key);
                  break;
                }
              }
            } catch (e) {
              console.log("🔍 Key", key, "not valid JSON");
            }
          }
        }
      } catch (storageError) {
        console.log("📱 AsyncStorage lookup failed:", storageError);
      }

      // Fallback: Try direct session call with short timeout
      if (!authToken) {
        console.log("🔄 Trying direct session call...");
        try {
          // Try multiple approaches to get the session
          const approaches = [
            // Approach 1: Quick session call
            async () => {
              const {
                data: { session },
              } = await supabase.auth.getSession();
              return session?.access_token || null;
            },
            // Approach 2: Get user and then session
            async () => {
              const {
                data: { user },
              } = await supabase.auth.getUser();
              if (user) {
                const {
                  data: { session },
                } = await supabase.auth.getSession();
                return session?.access_token || null;
              }
              return null;
            },
          ];

          for (let i = 0; i < approaches.length; i++) {
            try {
              console.log(`🔄 Trying approach ${i + 1}...`);
              const token = await Promise.race([
                approaches[i](),
                new Promise<null>((_, reject) => {
                  setTimeout(() => reject(new Error("Timeout")), 2000);
                }),
              ]);

              if (token) {
                authToken = token;
                console.log(`✅ Got auth token from approach ${i + 1}`);
                break;
              }
            } catch (error) {
              console.log(
                `❌ Approach ${i + 1} failed:`,
                error instanceof Error ? error.message : "Unknown"
              );
            }
          }
        } catch (sessionError) {
          console.log("⏱️ All session approaches failed");
        }
      }

      if (!authToken) {
        console.error("❌ No auth token available via any method");
        Alert.alert("Error", "Authentication required. Please log in again.");
        return;
      }

      // Use CommunityAPI REST endpoint with auth token
      const { success, error } = await CommunityAPI.sendFriendRequest(
        user.id,
        userToAdd.id,
        authToken
      );

      console.log("📨 Friend request result:", { success, error });

      if (error) {
        console.error("❌ Friend request error:", error);
        Alert.alert("Error", error);
        return;
      }

      if (success) {
        console.log("✅ Friend request sent successfully");

        // Remove from search results
        const updatedResults = searchResults.filter(
          (u) => u.id !== userToAdd.id
        );
        setSearchResults(updatedResults);
        console.log("🔄 Updated search results, removed user");

        // Send push notification to the recipient
        try {
          console.log("📢 Attempting to send push notification...");
          // Get the current user's profile to get their name
          const currentUserProfile = await ProfileAPIBase64.getProfile(user.id);
          const senderName = currentUserProfile?.name || "Someone";
          console.log("👤 Sender name:", senderName);

          await NotificationService.sendFriendRequestNotification(
            userToAdd.id,
            senderName,
            user.id
          );
          console.log(
            `✅ Push notification sent to ${userToAdd.name} for friend request`
          );
        } catch (notificationError) {
          console.error(
            "❌ Failed to send push notification:",
            notificationError
          );
          // Don't show error to user as the friend request was still sent successfully
        }

        Alert.alert("Success", `Friend request sent to ${userToAdd.name}!`);
        console.log("🎉 Success alert shown");

        // Note: The receiving user will see the notification when they load the app
        // since we call loadFriendRequests() on component mount
      } else {
        console.log(
          "⚠️ Friend request was not successful but no error was returned"
        );
        Alert.alert(
          "Warning",
          "Friend request may not have been sent. Please try again."
        );
      }
    } catch (error) {
      console.error("💥 Exception in handleAddFriend:", error);
      Alert.alert(
        "Error",
        `Failed to send friend request: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  };

  // Handle post likes
  const handleLike = async (postId: string) => {
    if (!user?.id) {
      Alert.alert("Error", "You must be logged in to like posts");
      return;
    }

    // Find the post
    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    // Handle database posts
    try {
      const { success, error } = await CommunityAPI.togglePostLike(
        postId,
        user.id
      );

      if (error) {
        Alert.alert("Error", error);
        return;
      }

      if (success) {
        // Update local state optimistically
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
      }
    } catch (error) {
      console.error("Error toggling like:", error);
      Alert.alert("Error", "Failed to update like. Please try again.");
    }
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
            {/* Horse image overlay for session posts */}
            {item.sessionData && (
              <>
                {item.sessionData.horseImageUrl ? (
                  <TouchableOpacity
                    onPress={() =>
                      setExpandedImage(item.sessionData!.horseImageUrl!)
                    }
                    activeOpacity={0.9}
                  >
                    <Image
                      source={{ uri: item.sessionData.horseImageUrl }}
                      style={styles.horseAvatarOverlay}
                    />
                  </TouchableOpacity>
                ) : (
                  <>
                    {/* Placeholder for missing horse image */}
                    <View
                      style={[
                        styles.horseAvatarOverlay,
                        {
                          backgroundColor: "#E0E0E0",
                          justifyContent: "center",
                          alignItems: "center",
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 12, color: "#666" }}>🐎</Text>
                    </View>
                  </>
                )}
              </>
            )}
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
        {/* Post menu button - show for all posts */}
        <View style={styles.postMenuContainer}>
          <TouchableOpacity
            style={styles.postMenuButton}
            onPress={() => {
              setShowPostMenu(showPostMenu === item.id ? null : item.id);
            }}
          >
            <Text style={[styles.postMenuDots, { color: theme.textSecondary }]}>
              ⋯
            </Text>
          </TouchableOpacity>
          {showPostMenu === item.id && (
            <View style={[styles.postMenu, { backgroundColor: theme.surface }]}>
              {user?.id === item.user.id ? (
                // Show delete option for user's own posts
                <TouchableOpacity
                  style={[
                    styles.postMenuItem,
                    { backgroundColor: "rgba(255, 107, 107, 0.1)" },
                  ]}
                  activeOpacity={0.7}
                  onPress={() => {
                    console.log("Delete button pressed for post:", item.id);
                    // Add a small delay to ensure the touch is registered
                    setTimeout(() => {
                      handleDeletePost(item);
                    }, 100);
                  }}
                >
                  <Text style={[styles.postMenuText, { color: "#FF6B6B" }]}>
                    🗑️ Delete Post
                  </Text>
                </TouchableOpacity>
              ) : (
                // Show hide and report options for other users' posts
                <>
                  <TouchableOpacity
                    style={[
                      styles.postMenuItem,
                      { backgroundColor: "rgba(128, 128, 128, 0.1)" },
                    ]}
                    activeOpacity={0.7}
                    onPress={() => {
                      console.log("Hide button pressed for post:", item.id);
                      setTimeout(() => {
                        Alert.alert("Debug", "Hide button was pressed!");
                        handleHidePost(item);
                      }, 100);
                    }}
                  >
                    <Text style={[styles.postMenuText, { color: theme.text }]}>
                      🙈 Hide Post
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.postMenuItem,
                      { backgroundColor: "rgba(255, 107, 107, 0.1)" },
                    ]}
                    activeOpacity={0.7}
                    onPress={() => {
                      console.log("Report button pressed for post:", item.id);
                      setTimeout(() => {
                        Alert.alert("Debug", "Report button was pressed!");
                        setReportingPost(item.id);
                        setShowPostMenu(null);
                      }, 100);
                    }}
                  >
                    <Text style={[styles.postMenuText, { color: "#FF6B6B" }]}>
                      🚨 Report Post
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}
        </View>
      </View>

      <Text style={[styles.postContent, { color: theme.text }]}>
        {item.content}
      </Text>

      {/* Show main image for all posts (uploaded session images from base64 only) */}
      {item.image && (
        <>
          <TouchableOpacity
            onPress={() => setExpandedImage(item.image!)}
            activeOpacity={0.9}
          >
            <Image source={{ uri: item.image }} style={styles.postImage} />
          </TouchableOpacity>
        </>
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

  // Custom notification badge component
  const NotificationBadge = ({ count }: { count: number }) => {
    if (count === 0) return null;

    return (
      <View style={styles.notificationBadge}>
        <Text style={styles.notificationBadgeText}>
          {count > 99 ? "99+" : count}
        </Text>
      </View>
    );
  };

  // Render friend request item
  const renderFriendRequest = ({ item }: { item: FriendRequest }) => (
    <View
      key={item.id}
      style={[styles.friendRequestItem, { backgroundColor: theme.surface }]}
    >
      <View style={styles.userInfo}>
        <View style={styles.avatarContainer}>
          <Image
            source={{ uri: getAvatarUrl(item.sender_avatar) }}
            style={styles.avatar}
          />
        </View>
        <View style={styles.userDetails}>
          <Text style={[styles.userName, { color: theme.text }]}>
            {item.sender_name}
          </Text>
          <Text style={[styles.requestText, { color: theme.textSecondary }]}>
            Sent you a friend request
          </Text>
          <Text style={[styles.requestTime, { color: theme.textSecondary }]}>
            {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>
      </View>
      <View style={styles.requestActions}>
        <TouchableOpacity
          style={[styles.acceptButton, { backgroundColor: theme.primary }]}
          onPress={() => handleAcceptFriendRequest(item)}
        >
          <Text style={styles.acceptButtonText}>Accept</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.declineButton, { backgroundColor: "#FF6B6B" }]}
          onPress={() => handleDeclineFriendRequest(item)}
        >
          <Text style={styles.declineButtonText}>Decline</Text>
        </TouchableOpacity>
      </View>
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
          {user && (
            <TouchableOpacity
              style={styles.notificationIcon}
              onPress={() => setShowNotifications(true)}
            >
              <Text style={{ fontSize: 18, color: "#FFFFFF" }}>🔔</Text>
              <NotificationBadge count={notificationCount} />
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
      <ScrollView
        style={[
          styles.viewPort,
          { backgroundColor: currentTheme.colors.background },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[currentTheme.colors.primary]} // Android
            tintColor={currentTheme.colors.primary} // iOS
            title="Pull to refresh"
            titleColor={currentTheme.colors.text}
          />
        }
        onScroll={undefined}
        scrollEventThrottle={16}
        stickyHeaderIndices={[0]} // Make the first element (tab container) sticky
      >
        {/* Tab Selector - Will become sticky when scrolling */}
        <View style={styles.stickyTabWrapper}>
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[
                styles.tabButton,
                activeTab === "Feed" && { backgroundColor: theme.primary },
              ]}
              onPress={() => setActiveTab("Feed")}
            >
              <View style={styles.tabContent}>
                <Text
                  style={[
                    styles.tabText,
                    {
                      color:
                        activeTab === "Feed" ? "#FFFFFF" : theme.textSecondary,
                    },
                  ]}
                >
                  Feed
                </Text>
                {notificationCount > 0 && activeTab !== "Feed" && (
                  <View style={styles.tabNotificationDot} />
                )}
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tabButton,
                activeTab === "Challenges" && {
                  backgroundColor: theme.primary,
                },
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
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  Friends
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    loadFriends();
                    loadFriendRequests();
                  }}
                  style={[
                    styles.refreshButton,
                    { backgroundColor: theme.primary },
                  ]}
                >
                  <Text style={styles.refreshButtonText}>🔄</Text>
                </TouchableOpacity>
              </View>
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
            <View style={[styles.section, { marginBottom: 130 }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Community Feed
              </Text>
              {isLoadingPosts ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator color={theme.primary} size="large" />
                  <Text
                    style={[styles.loadingText, { color: theme.textSecondary }]}
                  >
                    Loading posts...
                  </Text>
                </View>
              ) : visiblePosts.length > 0 ? (
                <View key={forceRender}>
                  {visiblePosts.map((item) => renderPost({ item }))}
                </View>
              ) : (
                <View style={styles.noResultsContainer}>
                  <Text style={styles.placeholderEmoji}>📝</Text>
                  <Text
                    style={[styles.placeholderTitle, { color: theme.text }]}
                  >
                    No Posts Yet
                  </Text>
                  <Text
                    style={[
                      styles.noResultsText,
                      { color: theme.textSecondary },
                    ]}
                  >
                    Be the first to share your riding experience! Share a
                    session from your training sessions to get started.
                  </Text>
                </View>
              )}
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

      {/* Overlay disabled - menu only closes via 3-dots toggle */}
      {showPostMenu !== null && (
        <View style={styles.menuOverlay} pointerEvents="none" />
      )}

      {/* Friend Requests Modal */}
      <Modal
        visible={showNotifications}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowNotifications(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContainer,
              { backgroundColor: theme.background },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                Friend Requests
              </Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowNotifications(false)}
              >
                <Text
                  style={[
                    styles.modalCloseText,
                    { color: theme.textSecondary },
                  ]}
                >
                  ✕
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              {isLoadingRequests ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator color={theme.primary} size="small" />
                  <Text
                    style={[styles.loadingText, { color: theme.textSecondary }]}
                  >
                    Loading requests...
                  </Text>
                </View>
              ) : friendRequests.length > 0 ? (
                friendRequests.map((request) =>
                  renderFriendRequest({ item: request })
                )
              ) : (
                <View style={styles.noResultsContainer}>
                  <Text
                    style={[
                      styles.noResultsText,
                      { color: theme.textSecondary },
                    ]}
                  >
                    You have no notifications yet.
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Report Post Modal */}
      <Modal
        visible={reportingPost !== null}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setReportingPost(null);
          setReportReason("");
        }}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContainer,
              { backgroundColor: theme.background },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                Report Post
              </Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => {
                  setReportingPost(null);
                  setReportReason("");
                }}
              >
                <Text
                  style={[
                    styles.modalCloseText,
                    { color: theme.textSecondary },
                  ]}
                >
                  ✕
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              <Text style={[styles.reportLabel, { color: theme.text }]}>
                Please tell us why you're reporting this post:
              </Text>
              <TextInput
                style={[
                  styles.reportInput,
                  {
                    backgroundColor: theme.surface,
                    color: theme.text,
                    borderColor: theme.textSecondary,
                  },
                ]}
                placeholder="Enter reason for reporting..."
                placeholderTextColor={theme.textSecondary}
                value={reportReason}
                onChangeText={setReportReason}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              <View style={styles.reportButtons}>
                <TouchableOpacity
                  style={[
                    styles.reportCancelButton,
                    { backgroundColor: theme.textSecondary },
                  ]}
                  onPress={() => {
                    setReportingPost(null);
                    setReportReason("");
                  }}
                >
                  <Text style={styles.reportCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.reportSubmitButton,
                    { backgroundColor: "#FF6B6B" },
                  ]}
                  onPress={() => {
                    const post = posts.find((p) => p.id === reportingPost);
                    if (post) handleReportPost(post);
                  }}
                  disabled={!reportReason.trim()}
                >
                  <Text
                    style={[
                      styles.reportSubmitText,
                      { opacity: reportReason.trim() ? 1 : 0.5 },
                    ]}
                  >
                    Report
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Expanded Image Modal */}
      <Modal
        visible={expandedImage !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setExpandedImage(null)}
      >
        <View style={styles.expandedImageOverlay}>
          <TouchableOpacity
            style={styles.expandedImageContainer}
            onPress={() => setExpandedImage(null)}
            activeOpacity={1}
          >
            <View style={styles.expandedImageHeader}>
              <TouchableOpacity
                style={styles.expandedImageCloseButton}
                onPress={() => setExpandedImage(null)}
              >
                <Text style={styles.expandedImageCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            {expandedImage && (
              <TouchableOpacity
                onPress={(e) => e.stopPropagation()}
                activeOpacity={1}
              >
                <Image
                  source={{ uri: expandedImage }}
                  style={styles.expandedImage}
                  resizeMode="contain"
                />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        </View>
      </Modal>
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
    paddingTop: 20,
  },
  stickyTabWrapper: {
    paddingTop: 0,
    zIndex: 10,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#F8F9FA",
    marginBottom: 15,
    borderRadius: 25,
    width: "90%",
    alignSelf: "center",
    padding: 5,
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
  tabContent: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  tabNotificationDot: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FF4444",
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
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  refreshButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  refreshButtonText: {
    fontSize: 16,
    color: "#FFFFFF",
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
  postMenuContainer: {
    position: "absolute",
    right: 6,
    zIndex: 10,
    width: 50,
  },
  postMenuButton: {
    padding: 8,
    borderRadius: 16,
    backgroundColor: "rgba(0, 0, 0, 0.05)",
  },
  postMenuDots: {
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    lineHeight: 20,
  },
  postMenu: {
    position: "absolute",
    top: 40,
    right: 0,
    minWidth: 160,
    borderRadius: 8,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    zIndex: 1000,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  postMenuItem: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
    minHeight: 50,
    justifyContent: "center",
  },
  postMenuText: {
    fontSize: 14,
    fontWeight: "500",
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
  horseAvatarOverlay: {
    position: "absolute",
    bottom: -8,
    right: -8,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "white",
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
    height: 300,
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
  // Notification and Friend Request Styles
  notificationBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: "#FF4444",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  notificationBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "bold",
  },
  friendRequestItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  requestText: {
    fontSize: 14,
    marginTop: 2,
  },
  requestTime: {
    fontSize: 12,
    marginTop: 2,
  },
  requestActions: {
    flexDirection: "row",
    gap: 8,
  },
  acceptButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    minWidth: 70,
  },
  acceptButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  declineButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    minWidth: 70,
  },
  declineButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  notificationIcon: {
    position: "absolute",
    right: 20,
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
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    maxHeight: "80%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 0,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  modalCloseButton: {
    padding: 8,
    borderRadius: 20,
  },
  modalCloseText: {
    fontSize: 18,
    fontWeight: "bold",
  },
  modalContent: {
    padding: 20,
    maxHeight: 400,
  },
  reportLabel: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 12,
  },
  reportInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    marginBottom: 20,
  },
  reportButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  reportCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  reportCancelText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  reportSubmitButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  reportSubmitText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  menuOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "transparent",
    zIndex: 5,
  },
  // Expanded Image Modal Styles
  expandedImageOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  expandedImageContainer: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  expandedImageHeader: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
  },
  expandedImageCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  expandedImageCloseText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "bold",
  },
  expandedImage: {
    width: "90%",
    height: "80%",
    borderRadius: 8,
  },
});
