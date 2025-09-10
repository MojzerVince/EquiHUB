import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
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
  Dimensions,
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
import { useMetric } from "../../contexts/MetricContext";
import { useTheme } from "../../contexts/ThemeContext";
import { ChallengeAPI } from "../../lib/challengeAPI";
import { ChallengeStorageService } from "../../lib/challengeStorage";
import { CommunityAPI, PostWithUser } from "../../lib/communityAPI";
import { GlobalChallengeAPI } from "../../lib/globalChallengeAPI";
import { HiddenPostsManager } from "../../lib/hiddenPostsManager";
import { getImageDataUrl } from "../../lib/imageUtils";
import {
  NotificationService,
  handleNotificationResponse,
} from "../../lib/notificationService";
import { ProfileAPIBase64 } from "../../lib/profileAPIBase64";
import { SimpleStableAPI, UserWithStable } from "../../lib/simpleStableAPI";
import { getSupabase, getSupabaseConfig } from "../../lib/supabase";
import { UserAPI, UserSearchResult } from "../../lib/userAPI";
import {
  ActiveChallenge,
  ActiveGlobalChallenge,
  ActiveStableChallenge,
  Challenge,
  ChallengeGoal,
  GlobalChallenge,
  StableChallenge,
  UserBadge,
} from "../../types/challengeTypes";

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
  const { formatDistance, formatDistanceUnit } = useMetric();
  const { user } = useAuth();
  const router = useRouter();
  const theme = currentTheme.colors;
  const [posts, setPosts] = useState<Post[]>([]);
  const [friends, setFriends] = useState<UserSearchResult[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false); // Start as false, set to true when loading begins
  const [activeTab, setActiveTab] = useState<"Feed" | "Challenges" | "Groups">(
    "Feed"
  );
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showFriendsManagement, setShowFriendsManagement] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [hiddenPostIds, setHiddenPostIds] = useState<string[]>([]);
  const [showPostMenu, setShowPostMenu] = useState<string | null>(null);
  const [reportingPost, setReportingPost] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [forceRender, setForceRender] = useState(0); // Add this to force re-renders
  const [postsLoaded, setPostsLoaded] = useState(false); // Track if posts have been loaded at least once

  // Challenge-related state
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loadingChallenges, setLoadingChallenges] = useState(false);
  const [activeChallenge, setActiveChallenge] =
    useState<ActiveChallenge | null>(null);
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(
    null
  );
  const [showChallengeGoals, setShowChallengeGoals] = useState(false);
  const [userBadges, setUserBadges] = useState<UserBadge[]>([]);
  const [availableChallenges, setAvailableChallenges] = useState<Challenge[]>(
    []
  );
  const [showGoalSelection, setShowGoalSelection] = useState(false);

  // Stable Challenge state
  const [stableChallenge, setStableChallenge] =
    useState<StableChallenge | null>(null);
  const [activeStableChallenge, setActiveStableChallenge] =
    useState<ActiveStableChallenge | null>(null);
  const [loadingStableChallenge, setLoadingStableChallenge] = useState(false);
  const [leaderboardRefreshing, setLeaderboardRefreshing] = useState(false);

  // Global Challenge state
  const [globalChallenge, setGlobalChallenge] =
    useState<GlobalChallenge | null>(null);
  const [activeGlobalChallenge, setActiveGlobalChallenge] =
    useState<ActiveGlobalChallenge | null>(null);
  const [loadingGlobalChallenge, setLoadingGlobalChallenge] = useState(false);
  const [globalLeaderboardRefreshing, setGlobalLeaderboardRefreshing] =
    useState(false);

  // Goal options for challenge selection - dynamic based on metric system
  const { metricSystem } = useMetric();
  const goalOptions: ChallengeGoal[] =
    metricSystem === "metric"
      ? [
          {
            id: "1",
            label: "20km Goal",
            target: 20,
            unit: "km",
            difficulty: "easy",
          },
          {
            id: "2",
            label: "50km Goal",
            target: 50,
            unit: "km",
            difficulty: "medium",
          },
          {
            id: "3",
            label: "75km Goal",
            target: 75,
            unit: "km",
            difficulty: "hard",
          },
          {
            id: "4",
            label: "100km Goal",
            target: 100,
            unit: "km",
            difficulty: "extreme",
          },
        ]
      : [
          {
            id: "1",
            label: "12mi Goal",
            target: 12,
            unit: "mi",
            difficulty: "easy",
          },
          {
            id: "2",
            label: "30mi Goal",
            target: 30,
            unit: "mi",
            difficulty: "medium",
          },
          {
            id: "3",
            label: "45mi Goal",
            target: 45,
            unit: "mi",
            difficulty: "hard",
          },
          {
            id: "4",
            label: "60mi Goal",
            target: 60,
            unit: "mi",
            difficulty: "extreme",
          },
        ];

  // Refs to track loading operations and prevent duplicates
  const isLoadingPostsRef = useRef(false);
  const isLoadingFriendRequestsRef = useRef(false);
  const isLoadingFriendsRef = useRef(false);
  const hasInitialLoadAttempted = useRef(false); // Track if we've attempted initial load

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

  const [suggestedUsers, setSuggestedUsers] = useState<UserWithStable[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [addingFriends, setAddingFriends] = useState<Set<string>>(new Set());

  // Pagination state for stable mates
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const USERS_PER_PAGE = 2;
  const MAX_USERS = 8;

  // Ref for horizontal scroll view
  const scrollViewRef = useRef<ScrollView>(null);

  // Load general friend suggestions for the user
  const loadSuggestions = useCallback(
    async (friendsList?: UserSearchResult[]) => {
      if (!user?.id) {
        setSuggestedUsers([]);
        setTotalPages(0);
        setCurrentPage(0);
        return;
      }

      setLoadingSuggestions(true);
      try {
        // Use new location-based API instead of same-stable API
        const { users, error } =
          await SimpleStableAPI.getLocationBasedSuggestions(user.id);

        if (error) {
          console.error("Error loading location-based suggestions:", error);
          setSuggestedUsers([]);
          setTotalPages(0);
          setCurrentPage(0);
        } else {
          console.log("🎯 Raw location suggestions received:", users.length);

          // Use provided friends list or fall back to state
          const currentFriends = friendsList || friends;
          console.log(
            "🔍 Using friends list for filtering:",
            currentFriends.map((f) => f.id)
          );

          // Filter out users who are already friends using existing friends state (backup filtering)
          const currentUserFriendIds = new Set(
            currentFriends.map((f) => f.id) || []
          );

          const unfriendedUsers = users.filter((mate) => {
            const isAlreadyFriend = currentUserFriendIds.has(mate.id);
            if (isAlreadyFriend) {
              console.warn(
                "⚠️ Found friend in suggestions (should have been filtered by API):",
                mate.name,
                mate.id
              );
            }
            return !isAlreadyFriend;
          });

          console.log("📝 After friend filtering:", unfriendedUsers.length);

          // Limit to MAX_USERS (8) and calculate pages
          const limitedUsers = unfriendedUsers.slice(0, MAX_USERS);
          setSuggestedUsers(limitedUsers);
          setTotalPages(Math.ceil(limitedUsers.length / USERS_PER_PAGE));
          setCurrentPage(0); // Reset to first page when data refreshes
        }
      } catch (error) {
        console.error("Exception loading location-based suggestions:", error);
        setSuggestedUsers([]);
        setTotalPages(0);
        setCurrentPage(0);
      } finally {
        setLoadingSuggestions(false);
      }
    },
    [user?.id, friends]
  ); // Add friends dependency to refilter when friends list changes

  // Pagination helper functions
  const getCurrentPageUsers = () => {
    const startIndex = currentPage * USERS_PER_PAGE;
    const endIndex = startIndex + USERS_PER_PAGE;
    return suggestedUsers.slice(startIndex, endIndex);
  };

  const goToNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
      // Scroll to next page
      const nextPageIndex = currentPage + 1;
      scrollViewRef.current?.scrollTo({
        x: nextPageIndex * (Dimensions.get("window").width - 32), // Account for padding
        animated: true,
      });
    }
  };

  const goToPrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
      // Scroll to previous page
      const prevPageIndex = currentPage - 1;
      scrollViewRef.current?.scrollTo({
        x: prevPageIndex * (Dimensions.get("window").width - 32), // Account for padding
        animated: true,
      });
    }
  };

  const goToPage = (pageIndex: number) => {
    if (pageIndex >= 0 && pageIndex < totalPages) {
      setCurrentPage(pageIndex);
      // Scroll to specific page
      scrollViewRef.current?.scrollTo({
        x: pageIndex * (Dimensions.get("window").width - 32), // Account for padding
        animated: true,
      });
    }
  };

  // Handle scroll end to update current page
  const handleScrollEnd = (event: any) => {
    const pageWidth = Dimensions.get("window").width - 32; // Account for padding
    const currentPageIndex = Math.round(
      event.nativeEvent.contentOffset.x / pageWidth
    );
    if (
      currentPageIndex >= 0 &&
      currentPageIndex < totalPages &&
      currentPageIndex !== currentPage
    ) {
      setCurrentPage(currentPageIndex);
    }
  };

  // Helper function to get challenge details by ID
  const getChallengeById = (challengeId: string): Challenge | null => {
    return challenges.find((challenge) => challenge.id === challengeId) || null;
  };

  // Challenge-related functions
  const loadChallenges = useCallback(async () => {
    if (!user?.id) return;

    setLoadingChallenges(true);
    try {
      // For now, use mock data. Later you can switch to real API
      const challengeList = ChallengeAPI.getMockChallenges();
      setChallenges(challengeList);
      setAvailableChallenges(challengeList);
    } catch (error) {
      console.error("Error loading challenges:", error);
    } finally {
      setLoadingChallenges(false);
    }
  }, [user?.id]);

  const loadActiveChallenge = useCallback(async () => {
    if (!user?.id) return;

    try {
      const active = await ChallengeStorageService.getActiveChallenge(user.id);
      setActiveChallenge(active);
    } catch (error) {
      console.error("Error loading active challenge:", error);
    }
  }, [user?.id]);

  const loadUserBadges = useCallback(async () => {
    if (!user?.id) return;

    try {
      const badges = await ChallengeStorageService.getUserBadges(user.id);
      setUserBadges(badges);
    } catch (error) {
      console.error("Error loading user badges:", error);
    }
  }, [user?.id]);

  // Stable Challenge functions (DISABLED - using global challenges instead)
  const loadStableChallenge = useCallback(async () => {
    if (!user?.id) return;

    // Disable stable challenge loading - using global challenges instead
    console.log("Stable challenge loading disabled - using global challenges");
    setLoadingStableChallenge(false);
    setStableChallenge(null);
    setActiveStableChallenge(null);
    return;

    /* COMMENTED OUT - Old stable challenge code
    setLoadingStableChallenge(true);
    try {
      // Get user's stable ID first
      const { data: userStable } = await getSupabase()
        .from("stable_members")
        .select("stable_id, stables(name)")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single();

      if (userStable?.stable_id) {
        // Load real stable challenge
        const challenge = await StableChallengeAPI.getCurrentStableChallenge(
          userStable.stable_id
        );
        setStableChallenge(challenge);

        // Load user's active stable challenge
        const activeStable =
          await StableChallengeAPI.getUserActiveStableChallenge(user.id);
        setActiveStableChallenge(activeStable);
      } else {
        // User is not in a stable
        setStableChallenge(null);
        setActiveStableChallenge(null);
      }

      // Check for monthly reset
      await StableChallengeAPI.checkAndResetMonthlyChallenges();
    } catch (error) {
      console.error("Error loading stable challenge:", error);
    } finally {
      setLoadingStableChallenge(false);
    }
    */
  }, [user?.id]);

  const updateStableChallengeContribution = async (distance: number) => {
    // Disabled - using global challenges instead
    console.log(
      "Stable challenge contribution disabled - using global challenges"
    );
    return;
  };

  // Real-time leaderboard refresh function (DISABLED)
  const refreshStableLeaderboard = useCallback(async () => {
    // Disabled - using global challenges instead
    console.log(
      "Stable leaderboard refresh disabled - using global challenges"
    );
    setLeaderboardRefreshing(false);
    return;
  }, []);

  // Auto-refresh leaderboard every 30 seconds when stable challenge is active (DISABLED)
  useEffect(() => {
    // Disabled - using global challenges instead
    console.log(
      "Stable challenge auto-refresh disabled - using global challenges"
    );
    return;
  }, []);

  const handleStartChallenge = (challenge: Challenge) => {
    if (activeChallenge) {
      Alert.alert(
        "Active Challenge",
        "You already have an active challenge. Complete or leave your current challenge before starting a new one.",
        [{ text: "OK" }]
      );
      return;
    }

    setSelectedChallenge(challenge);
    setShowGoalSelection(true);
  };

  const handleSelectGoal = async (goal: ChallengeGoal) => {
    if (!user?.id || !selectedChallenge) return;

    try {
      const newActiveChallenge: ActiveChallenge = {
        challengeId: selectedChallenge.id,
        goalId: goal.id,
        startDate: new Date().toISOString(),
        progress: 0,
        target: goal.target,
        unit: goal.unit,
        lastUpdated: new Date().toISOString(),
        sessions: [],
        isCompleted: false,
        earnedRewards: [],
      };

      const success = await ChallengeStorageService.saveActiveChallenge(
        user.id,
        newActiveChallenge
      );

      if (success) {
        setActiveChallenge(newActiveChallenge);
        setShowGoalSelection(false);
        setSelectedChallenge(null);

        Alert.alert(
          "Challenge Started!",
          `Good luck with your ${goal.label} goal!`,
          [{ text: "Let's Go!" }]
        );
      } else {
        Alert.alert("Error", "Failed to start challenge. Please try again.");
      }
    } catch (error) {
      console.error("Error starting challenge:", error);
      Alert.alert("Error", "Failed to start challenge. Please try again.");
    }
  };

  const handleViewProgress = () => {
    if (activeChallenge) {
      // For now, show an alert. Later you can create a dedicated screen
      Alert.alert(
        "Challenge Progress",
        `Progress: ${activeChallenge.progress.toFixed(1)} / ${
          activeChallenge.target
        } ${activeChallenge.unit}\n\nCompletion: ${(
          (activeChallenge.progress / activeChallenge.target) *
          100
        ).toFixed(1)}%`,
        [{ text: "OK" }]
      );
    }
  };

  const handleLeaveChallenge = async () => {
    if (activeChallenge && user?.id) {
      Alert.alert(
        "Leave Challenge",
        "Are you sure you want to leave this challenge? Your progress will be lost.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Leave",
            style: "destructive",
            onPress: async () => {
              await ChallengeStorageService.removeActiveChallenge(user.id);
              setActiveChallenge(null);
              loadChallenges(); // Reload available challenges
            },
          },
        ]
      );
    }
  };

  // Global Challenge functions
  const loadGlobalChallenge = useCallback(async () => {
    if (!user?.id) return;

    setLoadingGlobalChallenge(true);
    try {
      // Get current monthly global challenge
      const challenge = await GlobalChallengeAPI.getCurrentMonthlyChallenge();
      setGlobalChallenge(challenge);

      // Get user's active global challenge
      const activeGlobal =
        await GlobalChallengeAPI.getUserActiveGlobalChallenge(user.id);
      setActiveGlobalChallenge(activeGlobal);
    } catch (error) {
      console.error("Error loading global challenge:", error);
    } finally {
      setLoadingGlobalChallenge(false);
    }
  }, [user?.id]);

  const refreshGlobalLeaderboard = useCallback(async () => {
    if (!globalChallenge?.id) return;

    setGlobalLeaderboardRefreshing(true);
    try {
      // Get updated global leaderboard
      const updatedLeaderboard = await GlobalChallengeAPI.getGlobalLeaderboard(
        globalChallenge.id,
        user?.id
      );

      setGlobalChallenge((prev) =>
        prev
          ? {
              ...prev,
              globalLeaderboard: updatedLeaderboard,
            }
          : null
      );

      // Also refresh user's active challenge data
      if (user?.id) {
        const activeGlobal =
          await GlobalChallengeAPI.getUserActiveGlobalChallenge(user.id);
        setActiveGlobalChallenge(activeGlobal);
      }
    } catch (error) {
      console.error("Error refreshing global leaderboard:", error);
    } finally {
      setGlobalLeaderboardRefreshing(false);
    }
  }, [globalChallenge?.id, user?.id]);

  // Auto-refresh global leaderboard every 30 seconds when global challenge is active
  useEffect(() => {
    if (!globalChallenge?.id) return;

    const intervalId = setInterval(() => {
      refreshGlobalLeaderboard();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(intervalId);
  }, [globalChallenge?.id, refreshGlobalLeaderboard]);

  // Load initial data when component mounts and user is available (like horses screen)
  useEffect(() => {
    console.log(
      "🎯 Initial data useEffect triggered, user?.id:",
      !!user?.id,
      "hasInitialLoadAttempted:",
      hasInitialLoadAttempted.current
    );

    if (user?.id && !hasInitialLoadAttempted.current) {
      hasInitialLoadAttempted.current = true;

      console.log("🚀 Starting initial data load...");

      const loadInitialData = async () => {
        try {
          // Load friends first and get the result directly
          console.log("📥 Loading friends first...");
          const { friends: loadedFriends, error } = await UserAPI.getFriends(
            user.id
          );

          if (!error && loadedFriends) {
            console.log("✅ Friends loaded directly:", loadedFriends.length);
            setFriends(loadedFriends);

            // Load remaining data in parallel, passing the fresh friends data
            await Promise.all([
              loadFriendRequests(),
              loadHiddenPosts(),
              loadPosts(),
              loadSuggestions(loadedFriends), // Pass fresh friends data directly
              loadChallenges(), // Load available challenges
              loadActiveChallenge(), // Load active challenge
              loadUserBadges(), // Load user badges
              loadStableChallenge(), // Load stable challenge
              loadGlobalChallenge(), // Load global challenge
            ]);
          } else {
            console.error("Failed to load friends:", error);
            // Still try to load other data
            await Promise.all([
              loadFriendRequests(),
              loadHiddenPosts(),
              loadPosts(),
              loadSuggestions([]), // Pass empty friends list
              loadChallenges(), // Load available challenges
              loadActiveChallenge(), // Load active challenge
              loadUserBadges(), // Load user badges
              loadStableChallenge(), // Load stable challenge
              loadGlobalChallenge(), // Load global challenge
            ]);
          }

          console.log("✅ Initial data load complete");
        } catch (error) {
          console.error("Error loading initial community data:", error);
        }
      };

      loadInitialData();
    }
  }, [user?.id]); // Only depend on user?.id - like horses screen

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
      "🔄 loadPosts called, state:",
      isLoadingPosts,
      "ref state:",
      isLoadingPostsRef.current,
      "user.id:",
      user?.id
    );

    // Prevent multiple simultaneous calls
    if (isLoadingPostsRef.current) {
      console.log("🔄 loadPosts: Already loading, skipping duplicate call");
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
      setPostsLoaded(true); // Mark posts as loaded for the session
      console.log("✅ Posts set successfully");
    } catch (error) {
      console.error("Error loading posts:", error);
      // Set empty posts on error
      setPosts([]);
    } finally {
      console.log("🏁 loadPosts complete, resetting loading flags");
      isLoadingPostsRef.current = false;
      setIsLoadingPosts(false);
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

    // Prevent multiple simultaneous calls
    if (isLoadingFriendRequestsRef.current) {
      console.log(
        "🔄 loadFriendRequests: Already loading, skipping duplicate call"
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

      // Note: Success logging is handled by CommunityAPI
      setFriendRequests(friendRequestsList);
      setNotificationCount(friendRequestsList.length);
    } catch (error) {
      console.error("💥 Exception loading friend requests:", error);
      setFriendRequests([]);
      setNotificationCount(0);
    } finally {
      isLoadingFriendRequestsRef.current = false;
      setIsLoadingRequests(false);
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

  // Handle removing a friend
  const handleRemoveFriend = async (friend: UserSearchResult) => {
    if (!user?.id) return;

    Alert.alert(
      "Remove Friend",
      `Are you sure you want to remove ${friend.name} from your friends?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              const { success, error } = await UserAPI.removeFriend(
                user.id,
                friend.id
              );

              if (error) {
                Alert.alert("Error", error);
                return;
              }

              if (success) {
                // Remove friend from local state
                setFriends((prev) => prev.filter((f) => f.id !== friend.id));

                Alert.alert(
                  "Success",
                  `${friend.name} has been removed from your friends.`
                );
              }
            } catch (error) {
              Alert.alert("Error", "Failed to remove friend");
            }
          },
        },
      ]
    );
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
        // Reset loading ref to allow fresh call
        isLoadingFriendRequestsRef.current = false;
        loadFriendRequests();
      }
    }, 600000); // Check every 10 minutes instead of 5 minutes

    return () => clearInterval(interval);
  }, [user?.id, friendRequests.length]); // Remove loadFriendRequests to prevent circular re-renders

  // Load friends from database
  const loadFriends = useCallback(async () => {
    if (!user?.id) {
      setIsLoadingFriends(false);
      setFriends([]);
      return;
    }

    // Prevent multiple simultaneous calls
    if (isLoadingFriendsRef.current) {
      console.log("🔄 loadFriends: Already loading, skipping duplicate call");
      return;
    }

    isLoadingFriendsRef.current = true;
    setIsLoadingFriends(true);

    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error("Loading friends timed out after 20 seconds"));
        }, 20000); // Increased from 10 to 20 seconds
      });

      const { friends: userFriends, error } = (await Promise.race([
        UserAPI.getFriends(user.id),
        timeoutPromise,
      ])) as { friends: UserSearchResult[]; error: string | null };

      if (error) {
        console.error("❌ Error loading friends:", error);
        // Don't show alert for expected database issues - just log them
        // Only show alert for unexpected errors that users need to know about
        if (
          !error.includes("Database error") &&
          !error.includes("Failed to get friends")
        ) {
          Alert.alert("Error", "Failed to load friends");
        }
        setFriends([]);
        return;
      }

      console.log("✅ Friends loaded successfully:", userFriends?.length || 0);
      setFriends(userFriends || []);
    } catch (error) {
      console.error("💥 Exception loading friends:", error);
      // Only show alert for timeout errors or unexpected exceptions
      if (error instanceof Error && error.message.includes("timed out")) {
        Alert.alert(
          "Timeout",
          "Loading friends took too long. Please try again."
        );
      } else {
        console.log("🔍 Friends loading failed silently:", error);
        // Don't show alert for database connection issues - fail silently
      }
      setFriends([]);
    } finally {
      isLoadingFriendsRef.current = false;
      setIsLoadingFriends(false);
    }
  }, [user?.id]);

  // Refresh function to reload all data
  const onRefresh = useCallback(async () => {
    if (!user?.id) return;

    setRefreshing(true);

    try {
      // Reset all loading refs to allow fresh calls
      isLoadingFriendsRef.current = false;
      isLoadingFriendRequestsRef.current = false;
      isLoadingPostsRef.current = false;

      // Reset posts loaded flag to ensure fresh data on refresh
      setPostsLoaded(false);

      // Load friends first and get the result directly (same as initial load)
      console.log("🔄 Refreshing: Loading friends first...");
      const { friends: loadedFriends, error } = await UserAPI.getFriends(
        user.id
      );

      if (!error && loadedFriends) {
        console.log(
          "✅ Refresh: Friends loaded directly:",
          loadedFriends.length
        );
        setFriends(loadedFriends);

        // Run remaining loading functions in parallel for faster refresh
        await Promise.all([
          loadFriendRequests(),
          loadHiddenPosts(),
          loadPosts(), // Always refresh posts on manual pull-to-refresh
          loadSuggestions(loadedFriends), // Pass fresh friends data directly
        ]);
      } else {
        console.error("Refresh: Failed to load friends:", error);
        // Still try to refresh other data
        await Promise.all([
          loadFriendRequests(),
          loadHiddenPosts(),
          loadPosts(),
          loadSuggestions([]), // Pass empty friends list
        ]);
      }
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

  // Search for users with manual trigger
  const handleSearchInput = (query: string) => {
    setSearchQuery(query);
    setHasSearched(false); // Reset search state when query changes
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
    setHasSearched(true); // Mark that a search has been performed

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
        // Get secure configuration for URL
        const config = getSupabaseConfig();

        // Supabase stores session data under this key format
        const supabaseSessionKey = `sb-${
          config.url.split("//")[1].split(".")[0]
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
          // Get the initialized Supabase client
          const supabase = getSupabase();

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
                  <Image
                    source={{ uri: item.sessionData.horseImageUrl }}
                    style={styles.horseAvatarOverlay}
                  />
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

  const renderSuggestedUser = ({ item }: { item: UserWithStable }) => {
    const isAddingFriend = addingFriends.has(item.id);

    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.gridUserCard, { backgroundColor: theme.surface }]}
        onPress={() =>
          router.push({
            pathname: "/user-profile",
            params: { userId: item.id },
          })
        }
        activeOpacity={0.8}
      >
        <View style={styles.gridUserInfo}>
          <View style={styles.avatarContainer}>
            <Image
              source={{ uri: getAvatarUrl(item.profile_image_url) }}
              style={styles.gridAvatar}
            />
            {item.is_online && <View style={styles.onlineIndicator} />}
          </View>
          <Text
            style={[styles.gridUserName, { color: theme.text }]}
            numberOfLines={1}
          >
            {item.name}
          </Text>
          {item.stable_name && (
            <Text
              style={[styles.gridStableName, { color: theme.textSecondary }]}
              numberOfLines={1}
            >
              {item.stable_name}
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={[
            styles.gridAddButton,
            {
              backgroundColor: isAddingFriend
                ? theme.textSecondary
                : theme.primary,
              opacity: isAddingFriend ? 0.7 : 1,
            },
          ]}
          onPress={(e) => {
            e.stopPropagation();
            // Convert UserWithStable to UserSearchResult format for handleAddFriend
            const userSearchResult: UserSearchResult = {
              id: item.id,
              name: item.name,
              age: item.age || 0, // Default to 0 if age is not available
              profile_image_url: item.profile_image_url,
              description: item.description || "",
              is_online: item.is_online || false,
              is_friend: false,
            };
            handleAddFriend(userSearchResult);
          }}
          disabled={isAddingFriend}
        >
          {isAddingFriend ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.gridAddButtonText}>Add</Text>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderSearchResult = ({ item }: { item: UserSearchResult }) => {
    // Check if this user is in our friends list or marked as friend in API response
    const isFriend =
      friends.some((friend) => friend.id === item.id) || item.is_friend;

    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.searchResultItem, { backgroundColor: theme.surface }]}
        onPress={() =>
          router.push({
            pathname: "/user-profile",
            params: { userId: item.id },
          })
        }
        activeOpacity={0.8}
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
        {!isFriend && (
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: theme.primary }]}
            onPress={(e) => {
              e.stopPropagation(); // Prevent navigation when pressing add friend button
              handleAddFriend(item);
            }}
          >
            <Text style={styles.addButtonText}>Add Friend</Text>
          </TouchableOpacity>
        )}
        {isFriend && (
          <View
            style={[
              styles.friendBadge,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Text
              style={[styles.friendBadgeText, { color: theme.textSecondary }]}
            >
              Friend
            </Text>
          </View>
        )}
      </TouchableOpacity>
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
          {user && (
            <TouchableOpacity
              style={styles.friendsButton}
              onPress={async () => {
                setShowFriendsManagement(true);
                // Refresh friends list when opening the modal
                if (user?.id) {
                  await loadFriends();
                }
              }}
            >
              <Image
                style={{ width: 36, height: 36 }}
                source={require("../../assets/in_app_icons/friends.png")}
              />
            </TouchableOpacity>
          )}
          <Text style={[styles.header, { color: "#FFFFFF" }]}>Community</Text>
          {user && (
            <TouchableOpacity
              style={styles.notificationIcon}
              onPress={() => setShowNotifications(true)}
            >
              <Image
                style={{ width: 36, height: 36 }}
                source={require("../../assets/in_app_icons/notifications.png")}
              />
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
            {/* Friend Suggestions Section */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Riders from Your Area
              </Text>
              {loadingSuggestions ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={theme.primary} />
                  <Text
                    style={[styles.loadingText, { color: theme.textSecondary }]}
                  >
                    Loading friend suggestions...
                  </Text>
                </View>
              ) : suggestedUsers.length > 0 ? (
                <View style={styles.paginatedContainer}>
                  {/* Swipeable horizontal ScrollView */}
                  <ScrollView
                    ref={scrollViewRef}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onMomentumScrollEnd={handleScrollEnd}
                    style={styles.horizontalScrollView}
                    contentContainerStyle={styles.scrollViewContent}
                    decelerationRate="fast"
                    snapToInterval={Dimensions.get("window").width - 32} // Account for padding
                    snapToAlignment="start"
                  >
                    {Array.from({ length: totalPages }, (_, pageIndex) => (
                      <View
                        key={pageIndex}
                        style={[
                          styles.scrollPage,
                          { width: Dimensions.get("window").width - 32 },
                        ]}
                      >
                        <View style={styles.usersGrid}>
                          {suggestedUsers
                            .slice(
                              pageIndex * USERS_PER_PAGE,
                              (pageIndex + 1) * USERS_PER_PAGE
                            )
                            .map((user: UserWithStable) =>
                              renderSuggestedUser({ item: user })
                            )}
                        </View>
                      </View>
                    ))}
                  </ScrollView>

                  {/* Pagination dots */}
                  {totalPages > 1 && (
                    <View style={styles.simplePaginationContainer}>
                      {Array.from({ length: totalPages }, (_, index) => (
                        <TouchableOpacity
                          key={index}
                          style={[
                            styles.paginationDot,
                            {
                              backgroundColor:
                                index === currentPage
                                  ? theme.primary + "80" // Slightly lighter for current page
                                  : theme.textSecondary + "30",
                            },
                          ]}
                          onPress={() => goToPage(index)}
                        />
                      ))}
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.noResultsContainer}>
                  <Text
                    style={[styles.emptyText, { color: theme.textSecondary }]}
                  >
                    {user
                      ? "No location-based suggestions available. Join a stable in your area to find nearby riders!"
                      : "Login to see friend suggestions"}
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
                {searchQuery.length > 0 && (
                  <TouchableOpacity
                    style={[
                      styles.clearButton,
                      { backgroundColor: theme.surface },
                    ]}
                    onPress={() => {
                      setSearchQuery("");
                      setSearchResults([]);
                      setHasSearched(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.clearButtonText,
                        { color: theme.textSecondary },
                      ]}
                    >
                      ✕
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[
                    styles.searchButton,
                    { backgroundColor: theme.surface },
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
                hasSearched &&
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
          <View
            style={[
              styles.scrollContainer,
              { backgroundColor: theme.background },
            ]}
          >
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Global Challenge Section */}
              {globalChallenge ? (
                <View
                  style={[
                    styles.activeChallengeCard,
                    { backgroundColor: theme.surface },
                  ]}
                >
                  <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>
                      🌍 Global Stable Challenge
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.refreshButton,
                        { backgroundColor: theme.primary },
                      ]}
                      onPress={refreshGlobalLeaderboard}
                      disabled={globalLeaderboardRefreshing}
                    >
                      {globalLeaderboardRefreshing ? (
                        <ActivityIndicator size="small" color="white" />
                      ) : (
                        <Text style={styles.refreshButtonText}>↻</Text>
                      )}
                    </TouchableOpacity>
                  </View>

                  <View
                    style={[
                      styles.challengeCard,
                      { backgroundColor: theme.surface },
                    ]}
                  >
                    <Text
                      style={[styles.challengeTitle, { color: theme.text }]}
                    >
                      {globalChallenge.title}
                    </Text>
                    <Text
                      style={[
                        styles.challengeDescription,
                        { color: theme.textSecondary },
                      ]}
                    >
                      {globalChallenge.description}
                    </Text>

                    {/* User's Stable Progress */}
                    {activeGlobalChallenge && (
                      <View style={styles.progressContainer}>
                        <Text
                          style={[styles.progressText, { color: theme.text }]}
                        >
                          {activeGlobalChallenge.stableProgress > 0
                            ? `${activeGlobalChallenge.stableName} - Rank #${activeGlobalChallenge.stableRank}`
                            : `${activeGlobalChallenge.stableName} - Start riding to contribute to your stable!`}
                        </Text>
                        <View
                          style={[
                            styles.progressBar,
                            { backgroundColor: theme.border },
                          ]}
                        >
                          <View
                            style={[
                              styles.progressFill,
                              {
                                backgroundColor: theme.primary,
                                width: `${Math.min(
                                  (activeGlobalChallenge.stableProgress /
                                    globalChallenge.targetDistance) *
                                    100,
                                  100
                                )}%`,
                              },
                            ]}
                          />
                        </View>
                        <Text
                          style={[styles.progressText, { color: theme.text }]}
                        >
                          Stable:{" "}
                          {formatDistance(activeGlobalChallenge.stableProgress)}{" "}
                          / {formatDistance(globalChallenge.targetDistance)}{" "}
                          {formatDistanceUnit()}
                        </Text>
                        <Text
                          style={[
                            styles.progressText,
                            { color: theme.textSecondary, fontSize: 12 },
                          ]}
                        >
                          Your contribution:{" "}
                          {formatDistance(
                            activeGlobalChallenge.userContribution
                          )}{" "}
                          {formatDistanceUnit()}
                        </Text>
                      </View>
                    )}

                    {/* Global Leaderboard (Top 5) */}
                    {globalChallenge.globalLeaderboard.length > 0 && (
                      <View
                        style={[
                          styles.stableLeaderboard,
                          { backgroundColor: "rgba(0, 0, 0, 0.05)" },
                        ]}
                      >
                        <Text
                          style={[
                            styles.leaderboardTitle,
                            { color: theme.text },
                          ]}
                        >
                          🏆 Global Leaderboard (Top 5)
                        </Text>
                        {globalChallenge.globalLeaderboard
                          .slice(0, 5)
                          .map((stable, index) => (
                            <View
                              key={stable.stableId}
                              style={[
                                styles.leaderboardItem,
                                stable.isUserStable && {
                                  backgroundColor: theme.primary + "20",
                                },
                              ]}
                            >
                              <View style={styles.leaderboardRank}>
                                <Text
                                  style={[
                                    styles.rankText,
                                    {
                                      color:
                                        index < 3
                                          ? index === 0
                                            ? "#FFD700"
                                            : index === 1
                                            ? "#C0C0C0"
                                            : "#CD7F32"
                                          : theme.text,
                                    },
                                  ]}
                                >
                                  {index < 3
                                    ? index === 0
                                      ? "🥇"
                                      : index === 1
                                      ? "🥈"
                                      : "🥉"
                                    : `#${stable.rank}`}
                                </Text>
                              </View>
                              <View style={styles.participantInfo}>
                                <Text
                                  style={[
                                    styles.participantName,
                                    {
                                      color: stable.isUserStable
                                        ? theme.primary
                                        : theme.text,
                                      fontWeight: stable.isUserStable
                                        ? "bold"
                                        : "600",
                                    },
                                  ]}
                                >
                                  {stable.stableName}{" "}
                                  {stable.isUserStable ? "(Your Stable)" : ""}
                                </Text>
                                <Text
                                  style={[
                                    styles.participantContribution,
                                    { color: theme.textSecondary },
                                  ]}
                                >
                                  {formatDistance(stable.progressValue)}{" "}
                                  {formatDistanceUnit()} • {stable.memberCount}{" "}
                                  members • Avg:{" "}
                                  {formatDistance(stable.averageContribution)}{" "}
                                  {formatDistanceUnit()}
                                </Text>
                              </View>
                            </View>
                          ))}

                        {globalChallenge.globalLeaderboard.length > 5 && (
                          <Text
                            style={[
                              styles.autoParticipationText,
                              { color: theme.textSecondary, marginTop: 8 },
                            ]}
                          >
                            + {globalChallenge.globalLeaderboard.length - 5}{" "}
                            more stables competing
                          </Text>
                        )}
                      </View>
                    )}

                    {!activeGlobalChallenge && (
                      <View
                        style={[
                          styles.autoParticipationNote,
                          { borderColor: theme.border },
                        ]}
                      >
                        <Text
                          style={[
                            styles.autoParticipationText,
                            { color: theme.textSecondary },
                          ]}
                        >
                          Join a stable to participate in global challenges! All
                          stable members automatically contribute to their
                          stable's progress.
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              ) : loadingGlobalChallenge ? (
                <View
                  style={[
                    styles.activeChallengeCard,
                    { backgroundColor: theme.surface },
                  ]}
                >
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={theme.primary} />
                    <Text
                      style={[
                        styles.loadingText,
                        { color: theme.textSecondary },
                      ]}
                    >
                      Loading global challenge...
                    </Text>
                  </View>
                </View>
              ) : (
                <View
                  style={[
                    styles.activeChallengeCard,
                    { backgroundColor: theme.surface },
                  ]}
                >
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>
                    🌍 Global Stable Challenge
                  </Text>
                  <Text
                    style={[
                      styles.autoParticipationText,
                      {
                        color: theme.textSecondary,
                        textAlign: "center",
                        padding: 20,
                      },
                    ]}
                  >
                    No active global challenge at the moment. Check back soon!
                  </Text>
                </View>
              )}

              {/* Individual Active Challenge Section */}
              {activeChallenge ? (
                <View
                  style={[
                    styles.activeChallengeCard,
                    { backgroundColor: theme.surface },
                  ]}
                >
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>
                    Individual Active Challenge
                  </Text>
                  <View
                    style={[
                      styles.challengeCard,
                      { backgroundColor: theme.surface },
                    ]}
                  >
                    <Text
                      style={[styles.challengeTitle, { color: theme.text }]}
                    >
                      {getChallengeById(activeChallenge.challengeId)?.title ||
                        "Challenge"}
                    </Text>
                    <Text
                      style={[
                        styles.challengeDescription,
                        { color: theme.textSecondary },
                      ]}
                    >
                      {getChallengeById(activeChallenge.challengeId)
                        ?.description || "Challenge description"}
                    </Text>

                    {/* Progress Bar */}
                    <View style={styles.progressContainer}>
                      <View
                        style={[
                          styles.progressBar,
                          { backgroundColor: theme.border },
                        ]}
                      >
                        <View
                          style={[
                            styles.progressFill,
                            {
                              backgroundColor: theme.primary,
                              width: `${Math.min(
                                (activeChallenge.progress /
                                  activeChallenge.target) *
                                  100,
                                100
                              )}%`,
                            },
                          ]}
                        />
                      </View>
                      <Text
                        style={[styles.progressText, { color: theme.text }]}
                      >
                        {activeChallenge.progress.toFixed(1)} /{" "}
                        {activeChallenge.target} {activeChallenge.unit}
                      </Text>
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.challengeActions}>
                      <TouchableOpacity
                        style={[
                          styles.challengeActionButton,
                          styles.challengePrimaryButton,
                          { backgroundColor: theme.primary },
                        ]}
                        onPress={handleViewProgress}
                      >
                        <Text
                          style={[
                            styles.challengeButtonText,
                            { color: "white" },
                          ]}
                        >
                          View Progress
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.challengeActionButton,
                          styles.challengeSecondaryButton,
                          { borderColor: theme.primary },
                        ]}
                        onPress={handleLeaveChallenge}
                      >
                        <Text
                          style={[
                            styles.challengeButtonText,
                            styles.challengeSecondaryButtonText,
                            { color: theme.primary },
                          ]}
                        >
                          Leave Challenge
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ) : null}

              {/* Stable Challenge Section */}
              {stableChallenge && (
                <View
                  style={[
                    styles.stableChallengeCard,
                    { backgroundColor: theme.surface },
                  ]}
                >
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>
                    🏇 Stable Challenge
                  </Text>
                  <View
                    style={[
                      styles.challengeCard,
                      {
                        backgroundColor: theme.surface,
                        borderWidth: 2,
                        borderColor: theme.accent,
                      },
                    ]}
                  >
                    <Text
                      style={[styles.challengeTitle, { color: theme.text }]}
                    >
                      {stableChallenge.title}
                    </Text>
                    <Text
                      style={[
                        styles.challengeDescription,
                        { color: theme.textSecondary },
                      ]}
                    >
                      {stableChallenge.description}
                    </Text>

                    {/* Stable Progress Bar */}
                    <View style={styles.progressContainer}>
                      <View
                        style={[
                          styles.progressBar,
                          { backgroundColor: theme.border },
                        ]}
                      >
                        <View
                          style={[
                            styles.progressFill,
                            {
                              backgroundColor: theme.accent,
                              width: `${Math.min(
                                (stableChallenge.currentProgress /
                                  stableChallenge.targetDistance) *
                                  100,
                                100
                              )}%`,
                            },
                          ]}
                        />
                      </View>
                      <Text
                        style={[styles.progressText, { color: theme.text }]}
                      >
                        {stableChallenge.currentProgress.toFixed(1)} /{" "}
                        {stableChallenge.targetDistance} {stableChallenge.unit}
                      </Text>
                    </View>

                    {/* Stable Leaderboard */}
                    <View style={styles.stableLeaderboard}>
                      <View style={styles.leaderboardHeader}>
                        <Text
                          style={[
                            styles.leaderboardTitle,
                            { color: theme.text },
                          ]}
                        >
                          Top Contributors
                        </Text>
                        <TouchableOpacity
                          style={[
                            styles.stableRefreshButton,
                            { backgroundColor: theme.accent },
                          ]}
                          onPress={refreshStableLeaderboard}
                          disabled={leaderboardRefreshing}
                        >
                          <Text
                            style={[
                              styles.stableRefreshButtonText,
                              { color: "white" },
                            ]}
                          >
                            {leaderboardRefreshing ? "🔄" : "↻"}
                          </Text>
                        </TouchableOpacity>
                      </View>
                      {stableChallenge.leaderboard
                        .slice(0, 3)
                        .map((participant, index) => (
                          <View
                            key={participant.userId}
                            style={styles.leaderboardItem}
                          >
                            <View style={styles.leaderboardRank}>
                              <Text
                                style={[
                                  styles.rankText,
                                  { color: theme.textSecondary },
                                ]}
                              >
                                {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}
                              </Text>
                            </View>
                            <View style={styles.participantInfo}>
                              <Text
                                style={[
                                  styles.participantName,
                                  { color: theme.text },
                                ]}
                              >
                                {participant.userName}
                              </Text>
                              <Text
                                style={[
                                  styles.participantContribution,
                                  { color: theme.textSecondary },
                                ]}
                              >
                                {participant.contribution.toFixed(1)}{" "}
                                {stableChallenge.unit}
                              </Text>
                            </View>
                          </View>
                        ))}
                    </View>

                    {/* Automatic Participation Note */}
                    <View
                      style={[
                        styles.autoParticipationNote,
                        { backgroundColor: theme.surface },
                      ]}
                    >
                      <Text
                        style={[
                          styles.autoParticipationText,
                          { color: theme.textSecondary },
                        ]}
                      >
                        ✨ Your rides automatically contribute to your stable's
                        monthly challenge!
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Available Individual Challenges Section */}
              {!activeChallenge && (
                /* Available Challenges Section */
                <View
                  style={[
                    styles.availableChallengesSection,
                    { backgroundColor: theme.background },
                  ]}
                >
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>
                    Available Challenges
                  </Text>
                  {availableChallenges.map((challenge) => (
                    <View
                      key={challenge.id}
                      style={[
                        styles.challengeCard,
                        { backgroundColor: theme.surface },
                      ]}
                    >
                      <Text
                        style={[styles.challengeTitle, { color: theme.text }]}
                      >
                        {challenge.title}
                      </Text>
                      <Text
                        style={[
                          styles.challengeDescription,
                          { color: theme.textSecondary },
                        ]}
                      >
                        {challenge.description}
                      </Text>

                      <View style={styles.challengeDetails}>
                        <Text
                          style={[styles.challengeInfo, { color: theme.text }]}
                        >
                          Type: {challenge.type}
                        </Text>
                        <Text
                          style={[styles.challengeInfo, { color: theme.text }]}
                        >
                          Difficulty: {challenge.difficulty}
                        </Text>
                      </View>

                      <TouchableOpacity
                        style={[
                          styles.challengeActionButton,
                          styles.challengePrimaryButton,
                          { backgroundColor: theme.primary },
                        ]}
                        onPress={() => handleStartChallenge(challenge)}
                      >
                        <Text
                          style={[
                            styles.challengeButtonText,
                            { color: "white" },
                          ]}
                        >
                          Start Challenge
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ))}

                  {availableChallenges.length === 0 && (
                    <View style={styles.emptyState}>
                      <Text
                        style={[
                          styles.emptyStateText,
                          { color: theme.textSecondary },
                        ]}
                      >
                        No challenges available at the moment
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Goal Selection Modal */}
              <Modal
                visible={showGoalSelection}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowGoalSelection(false)}
              >
                <View style={styles.challengeModalOverlay}>
                  <View
                    style={[
                      styles.challengeModalContent,
                      { backgroundColor: theme.surface },
                    ]}
                  >
                    <Text
                      style={[
                        styles.challengeModalTitle,
                        { color: theme.text },
                      ]}
                    >
                      Choose Your Goal
                    </Text>
                    <Text
                      style={[
                        styles.challengeModalSubtitle,
                        { color: theme.textSecondary },
                      ]}
                    >
                      Select your target distance for this challenge
                    </Text>

                    {goalOptions.map((goal) => (
                      <TouchableOpacity
                        key={goal.id}
                        style={[
                          styles.goalOption,
                          { backgroundColor: theme.background },
                        ]}
                        onPress={() => handleSelectGoal(goal)}
                      >
                        <Text style={[styles.goalText, { color: theme.text }]}>
                          {goal.label}
                        </Text>
                        <Text
                          style={[
                            styles.goalDescription,
                            { color: theme.textSecondary },
                          ]}
                        >
                          {goal.target} {goal.unit} - {goal.difficulty} level
                        </Text>
                      </TouchableOpacity>
                    ))}

                    <TouchableOpacity
                      style={[
                        styles.challengeActionButton,
                        styles.challengeSecondaryButton,
                        { borderColor: theme.primary },
                      ]}
                      onPress={() => setShowGoalSelection(false)}
                    >
                      <Text
                        style={[
                          styles.challengeButtonText,
                          styles.challengeSecondaryButtonText,
                          { color: theme.primary },
                        ]}
                      >
                        Cancel
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Modal>
            </ScrollView>
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

      {/* Friends Management Modal */}
      <Modal
        visible={showFriendsManagement}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFriendsManagement(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContainer,
              {
                backgroundColor: currentTheme.colors.surface,
                height: "60%",
                minHeight: 400,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text
                style={[styles.modalTitle, { color: currentTheme.colors.text }]}
              >
                Friends Management
              </Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowFriendsManagement(false)}
              >
                <Text
                  style={[
                    styles.modalCloseText,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  ✕
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.friendsListContainer}
              contentContainerStyle={{ minHeight: 200 }}
            >
              {isLoadingFriends ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator
                    size="large"
                    color={currentTheme.colors.primary}
                  />
                  <Text
                    style={[
                      styles.loadingText,
                      { color: currentTheme.colors.text },
                    ]}
                  >
                    Loading friends...
                  </Text>
                </View>
              ) : friends.length === 0 ? (
                <View style={styles.friendsEmptyStateContainer}>
                  <Text
                    style={[
                      styles.friendsEmptyStateText,
                      { color: currentTheme.colors.text },
                    ]}
                  >
                    You don't have any friends yet.
                  </Text>
                  <Text
                    style={[
                      styles.friendsEmptyStateSubtext,
                      { color: currentTheme.colors.textSecondary },
                    ]}
                  >
                    Start connecting with people in the community!
                  </Text>
                </View>
              ) : (
                friends.map((friend) => (
                  <View
                    key={friend.id}
                    style={[
                      styles.friendItemContainer,
                      { backgroundColor: currentTheme.colors.background },
                    ]}
                  >
                    <View style={styles.friendInfoContainer}>
                      {friend.profile_image_url ? (
                        <Image
                          source={{ uri: friend.profile_image_url }}
                          style={styles.friendAvatarImage}
                        />
                      ) : (
                        <View style={styles.defaultFriendAvatar}>
                          <Text style={styles.defaultFriendAvatarText}>
                            {friend.name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View style={styles.friendDetailsContainer}>
                        <Text
                          style={[
                            styles.friendDisplayName,
                            { color: currentTheme.colors.text },
                          ]}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {friend.name}
                        </Text>
                        <Text
                          style={[
                            styles.friendDisplayDescription,
                            { color: currentTheme.colors.textSecondary },
                          ]}
                          numberOfLines={2}
                          ellipsizeMode="tail"
                        >
                          {friend.description && friend.description.trim()
                            ? friend.description.length > 60
                              ? friend.description.substring(0, 60) + "..."
                              : friend.description
                            : "Equestrian enthusiast"}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.removeFriendButton}
                      onPress={() => handleRemoveFriend(friend)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.removeFriendButtonText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
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
  viewPort: {
    backgroundColor: "#FFFFFF",
    flex: 1,
    borderTopLeftRadius: 50,
    borderTopRightRadius: 50,
    marginTop: -4,
    paddingTop: 10,
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
    width: "92%",
    alignSelf: "center",
    padding: 5,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
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
  clearButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: "bold",
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
    zIndex: 10,
  },
  friendsButton: {
    position: "absolute",
    left: 20,
    padding: 10,
    borderRadius: 20,
    minWidth: 40,
    minHeight: 40,
    marginTop: 10,
    justifyContent: "center",
    alignItems: "center",
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
  // Additional styles for stable mates
  stableInfo: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    fontStyle: "italic",
  },
  // Pagination styles for friend suggestions
  paginatedContainer: {
    marginTop: 8,
  },
  usersGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  paginationContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  paginationDots: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    gap: 8,
  },
  paginationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  simplePaginationContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: -10,
    gap: 12,
  },
  pageInfo: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
  },
  // Grid card styles for friend suggestions
  gridUserCard: {
    width: "48%", // Two cards per row with gap - adjusted for horizontal scroll
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    alignItems: "center",
    marginHorizontal: "1%", // Add small horizontal margin for better spacing
  },
  gridUserInfo: {
    alignItems: "center",
    marginBottom: 8,
  },
  gridAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  gridUserName: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 8,
    textAlign: "center",
  },
  gridStableName: {
    fontSize: 12,
    fontWeight: "400",
    marginTop: 2,
    textAlign: "center",
    fontStyle: "italic",
  },
  gridAddButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    minWidth: 60,
    alignItems: "center",
  },
  gridAddButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  // Horizontal scroll view styles
  horizontalScrollView: {
    marginBottom: 8,
    borderRadius: 16,
  },
  scrollViewContent: {
    alignItems: "flex-start",
  },
  scrollPage: {
    paddingHorizontal: 4, // Small padding for page separation
  },
  // Challenge styles
  activeChallengeCard: {
    margin: 15,
    padding: 15,
    borderRadius: 15,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  challengeCard: {
    padding: 15,
    borderRadius: 12,
    marginVertical: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  challengeTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
  },
  challengeDescription: {
    fontSize: 14,
    marginBottom: 12,
    lineHeight: 20,
  },
  progressContainer: {
    marginVertical: 12,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  challengeActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  challengeActionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    marginHorizontal: 4,
  },
  challengePrimaryButton: {
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  challengeSecondaryButton: {
    borderWidth: 1,
    backgroundColor: "transparent",
  },
  challengeButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  challengeSecondaryButtonText: {
    // Additional styling for secondary button text
  },
  availableChallengesSection: {
    padding: 15,
    marginBottom: 115,
  },
  challengeDetails: {
    marginVertical: 8,
  },
  challengeInfo: {
    fontSize: 12,
    marginBottom: 4,
  },
  emptyState: {
    padding: 40,
    alignItems: "center",
  },
  emptyStateText: {
    fontSize: 16,
    textAlign: "center",
  },
  challengeModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  challengeModalContent: {
    width: "90%",
    maxWidth: 400,
    padding: 20,
    borderRadius: 15,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    marginBottom: 100,
  },
  challengeModalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
  },
  challengeModalSubtitle: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 20,
  },
  goalOption: {
    padding: 15,
    borderRadius: 10,
    marginVertical: 5,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  goalText: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  goalDescription: {
    fontSize: 12,
  },
  // Friends Management Modal Styles
  friendsListContainer: {
    flex: 1,
    padding: 15,
    paddingTop: 10,
  },
  friendItemContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    marginBottom: 16,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(51, 92, 103, 0.1)",
  },
  friendInfoContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12,
  },
  friendAvatarImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
    borderWidth: 2,
    borderColor: "#335C67",
  },
  defaultFriendAvatar: {
    backgroundColor: "#335C67",
    justifyContent: "center",
    alignItems: "center",
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
    borderWidth: 2,
    borderColor: "#2A4A52",
  },
  defaultFriendAvatarText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  friendDetailsContainer: {
    flex: 1,
    justifyContent: "center",
  },
  friendDisplayName: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6,
    color: "#2C3E50",
    letterSpacing: 0.3,
  },
  friendDisplayDescription: {
    fontSize: 14,
    color: "#7F8C8D",
    lineHeight: 18,
  },
  removeFriendButton: {
    backgroundColor: "#E74C3C",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    elevation: 2,
    shadowColor: "#E74C3C",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    minWidth: 80,
    alignItems: "center",
  },
  removeFriendButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  friendsEmptyStateContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  friendsEmptyStateText: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
    textAlign: "center",
  },
  friendsEmptyStateSubtext: {
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: 40,
  },
  // Stable Challenge Styles
  stableChallengeCard: {
    padding: 15,
    marginBottom: 15,
    borderRadius: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  stableLeaderboard: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "rgba(0, 0, 0, 0.05)",
  },
  leaderboardTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 12,
  },
  leaderboardItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  leaderboardRank: {
    width: 30,
    alignItems: "center",
  },
  rankText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  participantInfo: {
    flex: 1,
    marginLeft: 12,
  },
  participantName: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  participantContribution: {
    fontSize: 12,
    fontWeight: "500",
  },
  autoParticipationNote: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  autoParticipationText: {
    fontSize: 13,
    fontStyle: "italic",
    textAlign: "center",
  },
  // Real-time leaderboard styles
  leaderboardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  stableRefreshButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  stableRefreshButtonText: {
    fontSize: 14,
    fontWeight: "bold",
  },
});
