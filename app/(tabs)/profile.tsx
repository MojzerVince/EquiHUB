import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
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
import SimpleStableSelection from "../../components/SimpleStableSelection";
import { useAuth } from "../../contexts/AuthContext";
import { useDialog } from "../../contexts/DialogContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useLoadingState } from "../../hooks/useLoadingState";
import API_CONFIG from "../../lib/apiConfig";
import * as HorseAPI from "../../lib/horseAPI";
import { ImageCompression } from "../../lib/imageCompression";
import { SimpleStable, SimpleStableAPI } from "../../lib/simpleStableAPI";
import { getSupabase, UserBadgeWithDetails } from "../../lib/supabase";

const ProfileScreen = () => {
  const router = useRouter();
  const { user } = useAuth();
  const { currentTheme } = useTheme();
  const { showError, showConfirm } = useDialog();

  // All hooks must be declared before any early returns
  const [isEditing, setIsEditing] = useState(false);
  const [userName, setUserName] = useState("Loading...");
  const [userAge, setUserAge] = useState("Loading...");
  const [userDescription, setUserDescription] = useState("Loading profile...");
  const [userExperience, setUserExperience] = useState("0");
  const [isProMember, setIsProMember] = useState(false);
  const [userStableRanch, setUserStableRanch] = useState("");

  // Stable selection state
  const [selectedStable, setSelectedStable] = useState<SimpleStable | null>(
    null
  );
  const [newStableData, setNewStableData] = useState<any>(null);
  const [showStableSelection, setShowStableSelection] = useState(false);

  // Store the saved values to revert to when canceling
  const [savedUserName, setSavedUserName] = useState("Loading...");
  const [savedUserAge, setSavedUserAge] = useState("Loading...");
  const [savedUserDescription, setSavedUserDescription] =
    useState("Loading profile...");
  const [savedUserExperience, setSavedUserExperience] = useState("0");
  const [savedIsProMember, setSavedIsProMember] = useState(false);
  const [savedUserStableRanch, setSavedUserStableRanch] = useState("");
  const [savedSelectedStable, setSavedSelectedStable] =
    useState<SimpleStable | null>(null);
  const [savedNewStableData, setSavedNewStableData] = useState<any>(null);

  // State for custom success modal
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // State for custom image picker modal
  const [showImagePickerModal, setShowImagePickerModal] = useState(false);

  // State for profile image
  const [profileImage, setProfileImage] = useState(
    require("../../assets/images/horses/falko.png")
  );
  const [savedProfileImage, setSavedProfileImage] = useState(
    require("../../assets/images/horses/falko.png")
  );

  // Loading state
  const { isLoading, error, setLoading, setError, clearError } =
    useLoadingState();

  // Refresh state
  const [refreshing, setRefreshing] = useState(false);

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

  // Counters state
  const [horsesCount, setHorsesCount] = useState(0);
  const [countersLoading, setCountersLoading] = useState(false);

  // Badge dialog state
  const [selectedBadge, setSelectedBadge] =
    useState<UserBadgeWithDetails | null>(null);
  const [badgeDialogVisible, setBadgeDialogVisible] = useState(false);

  // Load profile data on component mount
  useEffect(() => {
    // Only initialize if we have a valid user
    if (user?.id) {
      initializeProfile();
    }
  }, [user?.id]);

  // Get the user ID from the authenticated user
  const USER_ID = user?.id;

  // If no user is authenticated, we shouldn't be on this page
  if (!USER_ID) {
    return (
      <SafeAreaView
        style={[
          styles.container,
          { backgroundColor: currentTheme.colors.primary },
        ]}
      >
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: currentTheme.colors.text }]}>
            No user authenticated
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Function to determine membership status based on database value only
  const determineMembershipStatus = (databaseProStatus: boolean) => {
    // Logic: Pro member only if database explicitly says true
    return databaseProStatus === true;
  };

  // Direct API functions to bypass Supabase client issues
  const getProfileDirectAPI = async (userId: string) => {
    try {
      const url = `${API_CONFIG.SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`;

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
            () => reject(new Error("Profile API request timeout")),
            10000
          )
        ),
      ])) as Response;

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          "Profile API response not OK:",
          response.status,
          response.statusText
        );
        console.error("Error response body:", errorText);
        return null;
      }

      const profiles = await response.json();

      return profiles.length > 0 ? profiles[0] : null;
    } catch (error) {
      console.error("Error fetching profile via direct API:", error);
      return null;
    }
  };

  const createProfileDirectAPI = async (userId: string, profileData: any) => {
    try {
      const newProfile = {
        id: userId,
        ...profileData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const response = await fetch(
        `${API_CONFIG.SUPABASE_URL}/rest/v1/profiles`,
        {
          method: "POST",
          headers: {
            apikey:
              "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyZHNxeHdnaGFqZWhuZWtzeGlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQyMzIwMDUsImV4cCI6MjA2OTgwODAwNX0.PL2kAvrRGZbjnJcvKXMLVAaIF-ZfOWBOvzoPNVr9Fms",
            Authorization:
              "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyZHNxeHdnaGFqZWhuZWtzeGlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQyMzIwMDUsImV4cCI6MjA2OTgwODAwNX0.PL2kAvrRGZbjnJcvKXMLVAaIF-ZfOWBOvzoPNVr9Fms",
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify(newProfile),
        }
      );

      if (!response.ok) {
        console.error(
          "Create profile API response not OK:",
          response.status,
          response.statusText
        );
        const errorText = await response.text();
        console.error("Error response:", errorText);
        return null;
      }

      const createdProfiles = await response.json();

      return createdProfiles.length > 0 ? createdProfiles[0] : null;
    } catch (error) {
      console.error("Error creating profile via direct API:", error);
      return null;
    }
  };

  const updateProfileDirectAPI = async (userId: string, profileData: any) => {
    try {
      const updatePayload = {
        ...profileData,
        updated_at: new Date().toISOString(),
      };

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error("Profile update timeout after 15 seconds")),
          15000
        );
      });

      const fetchPromise = fetch(
        `${API_CONFIG.SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`,
        {
          method: "PATCH",
          headers: {
            apikey:
              "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyZHNxeHdnaGFqZWhuZWtzeGlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQyMzIwMDUsImV4cCI6MjA2OTgwODAwNX0.PL2kAvrRGZbjnJcvKXMLVAaIF-ZfOWBOvzoPNVr9Fms",
            Authorization:
              "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyZHNxeHdnaGFqZWhuZWtzeGlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQyMzIwMDUsImV4cCI6MjA2OTgwODAwNX0.PL2kAvrRGZbjnJcvKXMLVAaIF-ZfOWBOvzoPNVr9Fms",
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify(updatePayload),
        }
      );

      const response = await Promise.race([fetchPromise, timeoutPromise]);

      if (!response.ok) {
        console.error(
          "Update profile API response not OK:",
          response.status,
          response.statusText
        );
        const errorText = await response.text();
        console.error("Error response:", errorText);
        return false;
      }

      const updatedProfiles = await response.json();

      return true;
    } catch (error) {
      console.error("Error updating profile via direct API:", error);
      return false;
    }
  };

  // Direct API functions for badges to bypass Supabase client issues
  const getUserBadgesDirectAPI = async (userId: string) => {
    try {
      const url = `${API_CONFIG.SUPABASE_URL}/rest/v1/user_badges?user_id=eq.${userId}&select=*,badge:badges!user_badges_badge_id_fkey(*)`;

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

  // Function to get membership display text
  const getMembershipDisplayText = (isProMember: boolean) => {
    return isProMember ? "PRO MEMBER" : "RIDER";
  };

  const initializeProfile = async () => {
    try {
      // Load profile data with timeout
      await loadProfile();

      // Load user badges and check eligibility (don't block if this fails)
      try {
        await loadUserBadges();
      } catch (error) {
        console.error("Error loading badges during initialization:", error);
        // Don't prevent profile loading if badges fail
      }

      // Load counters (don't block if this fails)
      try {
        await loadCounters();
      } catch (error) {
        console.error("Error loading counters during initialization:", error);
        // Don't prevent profile loading if counters fail
      }
    } catch (error) {
      console.error("Error during profile initialization:", error);
      setError("Failed to load profile. Please try refreshing.");
    }
  };

  const loadUserBadges = async () => {
    setBadgesLoading(true);
    try {
      // Load user badges using direct API with timeout
      const badges = await Promise.race([
        getUserBadgesDirectAPI(USER_ID),
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

      // Note: Badge eligibility checking is disabled for now to prevent hanging
      // TODO: Implement direct API for badge eligibility if needed
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

  const loadCounters = async () => {
    setCountersLoading(true);
    try {
      // Load horses count using lightweight API call
      const horsesCount = await HorseAPI.HorseAPI.getHorseCount(USER_ID);

      setHorsesCount(horsesCount);
    } catch (error) {
      console.error("Error loading counters:", error);
      // Don't show error for counters, just set to 0
      setHorsesCount(0);
    } finally {
      setCountersLoading(false);
    }
  };

  const loadProfile = async () => {
    setLoading(true);
    clearError();

    try {
      // Try direct REST API approach with timeout like in refresh
      let profile = await Promise.race([
        getProfileDirectAPI(USER_ID),
        new Promise<null>((_, reject) =>
          setTimeout(
            () => reject(new Error("Profile loading timeout after 15 seconds")),
            15000
          )
        ),
      ]);

      // If profile doesn't exist, create it with default values
      if (!profile) {
        const newProfile = await createProfileDirectAPI(USER_ID, {
          name: "Loading User...", // Don't use hardcoded values
          age: 0,
          description: "Welcome to EquiHub!",
          experience: 0,
          is_pro_member: false,
          stable_ranch: "",
        });

        // Use the newly created profile
        profile = newProfile;
      }

      // Update state with loaded/created profile data
      const loadedExperience = profile.experience || 0;
      const loadedProStatus = profile.is_pro_member || false;
      const loadedStableRanch = profile.stable_ranch || "";

      // Determine final membership status based on database value
      const finalProStatus = determineMembershipStatus(loadedProStatus);

      setUserName(profile.name);
      setUserAge(profile.age.toString());
      setUserDescription(profile.description);
      setUserExperience(loadedExperience.toString());
      setIsProMember(finalProStatus);
      setUserStableRanch(loadedStableRanch);
      
      // Load user's stable information from stable_members table
      try {
        const supabase = getSupabase();
        console.log('Loading stable for user ID:', USER_ID);
        
        const { data: stableMemberships, error: stableError } = await supabase
          .from('stable_members')
          .select(`
            stable_id,
            stables!inner (
              id,
              name,
              location,
              city,
              state_province,
              country,
              is_verified
            )
          `)
          .eq('user_id', USER_ID);

        console.log('Stable query result:', { stableMemberships, stableError });

        if (stableError) {
          console.error('Stable query error:', stableError);
          setSelectedStable(null);
          setSavedSelectedStable(null);
        } else if (stableMemberships && stableMemberships.length > 0) {
          // Use the first stable if user is member of multiple stables
          const firstMembership = stableMemberships[0];
          const userStable: SimpleStable = {
            id: firstMembership.stables.id,
            name: firstMembership.stables.name,
            location: firstMembership.stables.location,
            city: firstMembership.stables.city,
            state_province: firstMembership.stables.state_province,
            country: firstMembership.stables.country,
            is_verified: firstMembership.stables.is_verified
          };
          setSelectedStable(userStable);
          setSavedSelectedStable(userStable);
          console.log('Successfully loaded user stable:', userStable.name);
          if (stableMemberships.length > 1) {
            console.log(`User is member of ${stableMemberships.length} stables, using first one`);
          }
        } else {
          console.log('No stable membership found for user');
          setSelectedStable(null);
          setSavedSelectedStable(null);
        }
      } catch (stableError) {
        console.error('Exception loading user stable:', stableError);
        setSelectedStable(null);
        setSavedSelectedStable(null);
      }
      
      setNewStableData(null);
      setSavedUserName(profile.name);
      setSavedUserAge(profile.age.toString());
      setSavedUserDescription(profile.description);
      setSavedUserExperience(loadedExperience.toString());
      setSavedIsProMember(finalProStatus);
      setSavedUserStableRanch(loadedStableRanch);
      setSavedNewStableData(null);

      if (profile.profile_image_url) {
        setProfileImage({ uri: profile.profile_image_url });
        setSavedProfileImage({ uri: profile.profile_image_url });
      } else {
        // Reset to default image if no profile image URL
        setProfileImage(require("../../assets/images/horses/falko.png"));
        setSavedProfileImage(require("../../assets/images/horses/falko.png"));
      }
    } catch (err) {
      setError("Failed to load profile");
      console.error("Error loading profile:", err);
    } finally {
      setLoading(false);
    }
  };

  // Refresh function for pull-to-refresh
  const onRefresh = async () => {
    setRefreshing(true);
    clearError();

    try {
      // Add 15-second timeout to profile refresh
      const profile = await Promise.race([
        getProfileDirectAPI(USER_ID),
        new Promise<null>((_, reject) =>
          setTimeout(
            () => reject(new Error("Profile refresh timeout after 15 seconds")),
            15000
          )
        ),
      ]);

      if (profile) {
        // Update state with refreshed profile data
        const loadedExperience = profile.experience || 0;
        const loadedProStatus = profile.is_pro_member || false;
        const loadedStableRanch = profile.stable_ranch || "";

        // Determine final membership status based on database value
        const finalProStatus = determineMembershipStatus(loadedProStatus);

        setUserName(profile.name);
        setUserAge(profile.age.toString());
        setUserDescription(profile.description);
        setUserExperience(loadedExperience.toString());
        setIsProMember(finalProStatus);
        setUserStableRanch(loadedStableRanch);
        
        // Load user's stable information from stable_members table
        try {
          const supabase = getSupabase();
          const { data: stableMemberships, error: stableError } = await supabase
            .from('stable_members')
            .select(`
              stable_id,
              stables!inner (
                id,
                name,
                location,
                city,
                state_province,
                country,
                is_verified
              )
            `)
            .eq('user_id', USER_ID);

          if (stableError) {
            console.error('Stable refresh error:', stableError);
            setSelectedStable(null);
            setSavedSelectedStable(null);
          } else if (stableMemberships && stableMemberships.length > 0) {
            const firstMembership = stableMemberships[0];
            const userStable: SimpleStable = {
              id: firstMembership.stables.id,
              name: firstMembership.stables.name,
              location: firstMembership.stables.location,
              city: firstMembership.stables.city,
              state_province: firstMembership.stables.state_province,
              country: firstMembership.stables.country,
              is_verified: firstMembership.stables.is_verified
            };
            setSelectedStable(userStable);
            setSavedSelectedStable(userStable);
            console.log('Refreshed user stable:', userStable.name);
          } else {
            setSelectedStable(null);
            setSavedSelectedStable(null);
            console.log('User is not a member of any stable (refresh)');
          }
        } catch (stableError) {
          console.error('Error refreshing user stable:', stableError);
          setSelectedStable(null);
          setSavedSelectedStable(null);
        }
        
        setNewStableData(null);
        setSavedUserName(profile.name);
        setSavedUserAge(profile.age.toString());
        setSavedUserDescription(profile.description);
        setSavedUserExperience(loadedExperience.toString());
        setSavedIsProMember(finalProStatus);
        setSavedUserStableRanch(loadedStableRanch);
        setSavedNewStableData(null);

        if (profile.profile_image_url) {
          setProfileImage({ uri: profile.profile_image_url });
          setSavedProfileImage({ uri: profile.profile_image_url });
        } else {
          // Reset to default image if no profile image URL
          setProfileImage(require("../../assets/images/horses/falko.png"));
          setSavedProfileImage(require("../../assets/images/horses/falko.png"));
        }

        // Reload badges after refreshing profile using direct API
        try {
          await loadUserBadges();
        } catch (error) {
          console.error("Error loading badges during refresh:", error);
          // Don't prevent refresh if badges fail
        }
      } else {
        setError("Failed to refresh profile data");
      }
    } catch (err) {
      setError("Failed to refresh profile");
      console.error("Error refreshing profile:", err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleEditPress = () => {
    setIsEditing(true);
  };

  const handleBadgePress = (badge: UserBadgeWithDetails) => {
    setSelectedBadge(badge);
    setBadgeDialogVisible(true);
  };

  const closeBadgeDialog = () => {
    setBadgeDialogVisible(false);
    setSelectedBadge(null);
  };

  const handleDescriptionChange = (text: string) => {
    // Count the number of lines
    const lineCount = text.split('\n').length;
    
    // Limit to 150 characters AND 5 lines
    if (text.length <= 150 && lineCount <= 5) {
      setUserDescription(text);
    }
  };

  const handleStableSelection = (
    stable: SimpleStable | null,
    isNewStable?: boolean,
    stableData?: any
  ) => {
    setSelectedStable(stable);
    setNewStableData(isNewStable ? stableData : null);

    // Update the stable/ranch text for display and saving
    if (stable) {
      setUserStableRanch(stable.name);
    } else if (isNewStable && stableData) {
      setUserStableRanch(stableData.name);
    } else {
      setUserStableRanch("");
    }
  };

  const handleClearStableSelection = () => {
    setSelectedStable(null);
    setNewStableData(null);
    setUserStableRanch("");
  };

  const compressImageForUpload = async (imageUri: string) => {
    try {
      const compressedImage = await ImageCompression.compressImage(imageUri, {
        maxWidth: 400,
        maxHeight: 400,
        quality: 0.6,
        format: "jpeg",
      });
      console.log("📷 Image compressed for profile upload");
      return compressedImage;
    } catch (error) {
      console.error("📷 Error compressing image:", error);
      return { uri: imageUri }; // Return original if compression fails
    }
  };

  const pickImage = async () => {
    // Request permission to access media library
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      showError(
        "You need to grant camera roll permissions to change your profile picture."
      );
      return;
    }

    // Show custom image picker modal instead of Alert
    setShowImagePickerModal(true);
  };

  const openCamera = async () => {
    setShowImagePickerModal(false);
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

    if (permissionResult.granted === false) {
      showError("You need to grant camera permissions to take a photo.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5, // Reduced from 0.8 to save data
      base64: false,
    });

    if (!result.canceled && result.assets[0]) {
      // Further compress the image before setting it
      const compressedImage = await compressImageForUpload(
        result.assets[0].uri
      );
      setProfileImage({ uri: compressedImage.uri });
    }
  };

  const openImageLibrary = async () => {
    setShowImagePickerModal(false);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5, // Reduced from 0.8 to save data
      base64: false,
    });

    if (!result.canceled && result.assets[0]) {
      // Further compress the image before setting it
      const compressedImage = await compressImageForUpload(
        result.assets[0].uri
      );
      setProfileImage({ uri: compressedImage.uri });
    }
  };

  const handleSave = async () => {
    if (userName.trim() === "") {
      showError("Name cannot be empty");
      return;
    }
    if (userAge.trim() === "" || isNaN(Number(userAge))) {
      showError("Please enter a valid age");
      return;
    }
    if (userExperience.trim() === "" || isNaN(Number(userExperience))) {
      showError("Please enter a valid experience number");
      return;
    }
    if (userDescription.length > 150) {
      showError("Description must be 150 characters or less");
      return;
    }
    if (userDescription.split('\n').length > 5) {
      showError("Description must be 5 lines or less");
      return;
    }

    setLoading(true);
    clearError();

    try {
      // Check if profileImage is a URI object (not a require() number)
      const isCurrentImageUri =
        profileImage && typeof profileImage === "object" && profileImage.uri;
      const isSavedImageUri =
        savedProfileImage &&
        typeof savedProfileImage === "object" &&
        savedProfileImage.uri;

      // Determine if we have a new image to upload
      const hasNewImage =
        isCurrentImageUri &&
        (!isSavedImageUri || profileImage.uri !== savedProfileImage.uri);

      // Prepare profile data - preserve existing image URL if no new image uploaded
      const experienceValue = parseInt(userExperience);
      // Keep the current pro status from state (which came from database)
      const finalProStatus = isProMember;

      const updateData: any = {
        name: userName,
        age: parseInt(userAge),
        description: userDescription,
        experience: experienceValue,
        is_pro_member: finalProStatus,
        stable_ranch: userStableRanch,
      };

      // Handle image upload if there's a new image
      if (hasNewImage) {
        try {
          // Convert image to base64 directly here instead of using separate upload function
          const response = await fetch(profileImage.uri);
          if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.status}`);
          }

          const blob = await response.blob();

          // Convert blob to Base64
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              if (reader.result) {
                const base64 = (reader.result as string).split(",")[1];
                resolve(base64);
              } else {
                reject(new Error("Failed to convert blob to Base64"));
              }
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });

          // Create data URL
          const mimeType = blob.type || "image/jpeg";
          const dataUrl = `data:${mimeType};base64,${base64}`;

          updateData.profile_image_url = dataUrl;
        } catch (imageError) {
          console.error("Image upload failed:", imageError);
          showConfirm(
            "Warning",
            "Image upload failed, but other changes will be saved.",
            () => {
              // Continue with save operation
            }
          );
        }
      } else if (isSavedImageUri) {
        // Keep existing image URL if user hasn't changed the image
        updateData.profile_image_url = savedProfileImage.uri;
      }

      // Handle stable creation before updating profile
      let actualStableId: string | null = null;
      if (newStableData && !selectedStable) {
        // User created a new stable - create it in the database
        try {
          const { stable, error } = await SimpleStableAPI.createStable({
            name: newStableData.name,
            location: newStableData.location,
            city: newStableData.city,
            state_province: newStableData.state_province,
            creator_id: USER_ID,
          });

          if (error || !stable) {
            throw new Error(error || "Failed to create stable");
          }

          actualStableId = stable.id;
          console.log("Successfully created new stable:", stable.name);
        } catch (stableError) {
          console.error("Error creating stable:", stableError);
          showError(
            "Failed to create stable. Profile will be saved without stable information."
          );
          // Continue with profile save even if stable creation fails
        }
      } else if (selectedStable) {
        // User selected an existing stable - store reference
        actualStableId = selectedStable.id;
        console.log("Using selected stable:", selectedStable.name);
      }

      // Update profile data using direct API approach (single update call)
      const success = await updateProfileDirectAPI(USER_ID, updateData);

      if (!success) {
        throw new Error("Failed to update profile");
      }

      // Update saved values with the current edited values
      setSavedUserName(userName);
      setSavedUserAge(userAge);
      setSavedUserDescription(userDescription);
      setSavedUserExperience(userExperience);
      setSavedIsProMember(finalProStatus);
      setSavedUserStableRanch(userStableRanch);

      // If stable operation was successful, clear the temporary selection state
      if (actualStableId) {
        // Clear the new stable data since it's now saved
        setNewStableData(null);
        setSavedNewStableData(null);
        // Keep the selected stable if we selected an existing one
        if (selectedStable) {
          setSavedSelectedStable(selectedStable);
        } else {
          // Clear selection for newly created stables since they're now in the database
          setSelectedStable(null);
          setSavedSelectedStable(null);
        }
      } else {
        // No stable operation, save current state as-is
        setSavedSelectedStable(selectedStable);
        setSavedNewStableData(newStableData);
      }

      // Also update current state to reflect the calculated pro status
      setIsProMember(finalProStatus);

      // Update saved image: use the current profileImage (which might have new base64 URL)
      setSavedProfileImage(profileImage);

      setIsEditing(false);
      setShowSuccessModal(true);

      // Check for new badges after successful save using direct API
      try {
        await loadUserBadges();
      } catch (error) {
        console.error("Error loading badges after save:", error);
        // Don't prevent save success if badges fail
      }
    } catch (err) {
      setError("Failed to save profile");
      showError("Failed to save profile. Please try again.");
      console.error("Error saving profile:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    // Reset to the last saved values instead of hardcoded original values
    setUserName(savedUserName);
    setUserAge(savedUserAge);
    setUserDescription(savedUserDescription);
    setUserExperience(savedUserExperience);
    setIsProMember(savedIsProMember);
    setUserStableRanch(savedUserStableRanch);
    setSelectedStable(savedSelectedStable);
    setNewStableData(savedNewStableData);
    setProfileImage(savedProfileImage);
    setIsEditing(false);
  };

  const SuccessModal = () => (
    <Modal
      animationType="fade"
      transparent={true}
      visible={showSuccessModal}
      onRequestClose={() => setShowSuccessModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalIcon}>
            <Text style={styles.checkIcon}>✓</Text>
          </View>
          <Text
            style={[styles.modalTitle, { color: currentTheme.colors.text }]}
          >
            Success!
          </Text>
          <Text
            style={[
              styles.modalMessage,
              { color: currentTheme.colors.textSecondary },
            ]}
          >
            Your profile has been updated successfully
          </Text>
          <TouchableOpacity
            style={styles.modalButton}
            onPress={() => setShowSuccessModal(false)}
          >
            <Text style={styles.modalButtonText}>OK</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const ImagePickerModal = () => (
    <Modal
      animationType="fade"
      transparent={true}
      visible={showImagePickerModal}
      onRequestClose={() => setShowImagePickerModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.imagePickerIcon}>
            <Text style={styles.cameraIcon}>📷</Text>
          </View>
          <Text
            style={[styles.modalTitle, { color: currentTheme.colors.text }]}
          >
            Select Image
          </Text>
          <Text
            style={[
              styles.modalMessage,
              { color: currentTheme.colors.textSecondary },
            ]}
          >
            Choose how you want to select your profile picture
          </Text>
          <View style={styles.imagePickerButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.imagePickerButton]}
              onPress={openCamera}
            >
              <Text style={styles.modalButtonText}>📸 Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.imagePickerButton]}
              onPress={openImageLibrary}
            >
              <Text style={styles.modalButtonText}>🖼️ Gallery</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.modalButton, styles.cancelModalButton]}
            onPress={() => setShowImagePickerModal(false)}
          >
            <Text style={styles.cancelModalButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

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
          <Text style={[styles.header, { color: "#FFFFFF" }]}>My Profile</Text>
          <TouchableOpacity
            style={styles.optionsButton}
            onPress={() => router.push("/options")}
          >
            <Image
              source={require("../../assets/UI_resources/UI_white/settings_white.png")}
              style={styles.optionsIcon}
            />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView
        style={[
          styles.viewPort,
          { backgroundColor: currentTheme.colors.surface },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.profileContainer}>
          {/* Profile Section */}
          <View
            style={[
              styles.profileSection,
              { backgroundColor: currentTheme.colors.background },
            ]}
          >
            {!isEditing ? (
              <TouchableOpacity
                style={[
                  styles.editButton,
                  {
                    backgroundColor: currentTheme.colors.primary,
                    borderColor: currentTheme.colors.border,
                  },
                ]}
                onPress={handleEditPress}
                disabled={isLoading}
              >
                <Text style={[styles.editButtonText, { color: "#FFFFFF" }]}>
                  Edit Profile
                </Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  style={[
                    styles.cancelButton,
                    { backgroundColor: currentTheme.colors.textSecondary },
                  ]}
                  onPress={handleCancel}
                  disabled={isLoading}
                >
                  <Text style={[styles.cancelButtonText, { color: "#FFFFFF" }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.saveButton,
                    { backgroundColor: currentTheme.colors.primary },
                  ]}
                  onPress={handleSave}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={[styles.saveButtonText, { color: "#FFFFFF" }]}>
                      Save
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            )}

            <View style={styles.profileImageContainer}>
              {!isEditing ? (
                <Image
                  source={profileImage}
                  style={[
                    styles.profileImage,
                    { borderColor: currentTheme.colors.primary },
                  ]}
                />
              ) : (
                <TouchableOpacity
                  onPress={pickImage}
                  style={styles.editImageContainer}
                >
                  <Image
                    source={profileImage}
                    style={[
                      styles.profileImage,
                      { borderColor: currentTheme.colors.primary },
                    ]}
                  />
                  <View style={styles.editImageOverlay}>
                    <Text style={styles.editImageLabel}>Edit</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>

            {!isEditing ? (
              <>
                <Text
                  style={[styles.userName, { color: currentTheme.colors.text }]}
                >
                  {userName}
                </Text>
                <Text
                  style={[styles.userAge, { color: currentTheme.colors.text }]}
                >
                  {userAge}
                </Text>
                <Text
                  style={[
                    styles.userDescription,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  {userDescription}
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
                    {userExperience} years
                  </Text>
                </View>

                <View style={styles.stableRanchContainer}>
                  <Text
                    style={[
                      styles.stableRanchLabel,
                      { color: currentTheme.colors.text },
                    ]}
                  >
                    Stable/Ranch
                  </Text>
                  {savedSelectedStable ? (
                    <View style={styles.viewStableContainer}>
                      <View style={styles.viewStableNameContainer}>
                        <Text
                          style={[
                            styles.stableRanchValue,
                            { color: currentTheme.colors.text },
                          ]}
                        >
                          {savedSelectedStable.name}
                        </Text>
                      </View>
                      {savedSelectedStable.location && (
                        <Text
                          style={[
                            styles.viewStableLocation,
                            { color: currentTheme.colors.textSecondary },
                          ]}
                        >
                          {savedSelectedStable.location}
                        </Text>
                      )}
                      {(savedSelectedStable.city || savedSelectedStable.state_province) && (
                        <Text
                          style={[
                            styles.viewStableLocation,
                            { color: currentTheme.colors.textSecondary },
                          ]}
                        >
                          {[savedSelectedStable.city, savedSelectedStable.state_province]
                            .filter(Boolean)
                            .join(', ')}
                        </Text>
                      )}
                    </View>
                  ) : (
                    <Text
                      style={[
                        styles.stableRanchValue,
                        {
                          color: userStableRanch
                            ? currentTheme.colors.text
                            : currentTheme.colors.textSecondary,
                        },
                      ]}
                    >
                      {userStableRanch || "Not specified"}
                    </Text>
                  )}
                </View>

                {/* Counters Container */}
                <View style={styles.countersContainer}>
                  <TouchableOpacity
                    style={styles.counterItem}
                    onPress={() =>
                      router.push({
                        pathname: "/user-horses",
                        params: { userId: USER_ID },
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
                  <TouchableOpacity
                    style={[
                      styles.badge,
                      isProMember ? styles.proBadge : styles.regularBadge,
                      { backgroundColor: currentTheme.colors.surface },
                    ]}
                    onPress={() => {
                      if (isProMember) {
                        router.push("/pro-features");
                      } else {
                        router.push("/subscription");
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.badgeText,
                        isProMember
                          ? styles.proBadgeText
                          : styles.regularBadgeText,
                        { color: currentTheme.colors.text },
                      ]}
                    >
                      {getMembershipDisplayText(isProMember)}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <TextInput
                  style={[
                    styles.editInput,
                    {
                      backgroundColor: currentTheme.colors.surface,
                      borderColor: currentTheme.colors.border,
                      color: currentTheme.colors.text,
                    },
                  ]}
                  value={userName}
                  onChangeText={setUserName}
                  placeholder="Enter your name"
                  placeholderTextColor={currentTheme.colors.textSecondary}
                />
                <TextInput
                  style={[
                    styles.editInput,
                    {
                      backgroundColor: currentTheme.colors.surface,
                      borderColor: currentTheme.colors.border,
                      color: currentTheme.colors.text,
                    },
                  ]}
                  value={userAge}
                  onChangeText={setUserAge}
                  placeholder="Enter your age"
                  placeholderTextColor={currentTheme.colors.textSecondary}
                  keyboardType="numeric"
                />
                <TextInput
                  style={[
                    styles.editInput,
                    styles.editDescriptionInput,
                    {
                      backgroundColor: currentTheme.colors.surface,
                      borderColor: currentTheme.colors.border,
                      color: currentTheme.colors.text,
                    },
                  ]}
                  value={userDescription}
                  onChangeText={handleDescriptionChange}
                  placeholder="Enter your description (max 150 chars, 5 lines)"
                  placeholderTextColor={currentTheme.colors.textSecondary}
                  multiline
                  numberOfLines={5}
                  maxLength={150}
                />
                <Text
                  style={[
                    styles.characterCounter,
                    {
                      color:
                        userDescription.length > 140 || userDescription.split('\n').length > 4
                          ? "#FF6B6B"
                          : currentTheme.colors.textSecondary,
                    },
                  ]}
                >
                  {userDescription.length}/150 characters • {userDescription.split('\n').length}/5 lines
                </Text>
                <TextInput
                  style={[
                    styles.editInput,
                    {
                      backgroundColor: currentTheme.colors.surface,
                      borderColor: currentTheme.colors.border,
                      color: currentTheme.colors.text,
                    },
                  ]}
                  value={userExperience}
                  onChangeText={setUserExperience}
                  placeholder="Years of experience"
                  placeholderTextColor={currentTheme.colors.textSecondary}
                  keyboardType="numeric"
                />

                {/* Stable/Ranch Selection */}
                <View style={styles.stableSelectionContainer}>
                  <Text
                    style={[
                      styles.stableSelectionLabel,
                      { color: currentTheme.colors.text },
                    ]}
                  >
                    Stable/Ranch (Optional)
                  </Text>
                  {selectedStable || newStableData ? (
                    <View
                      style={[
                        styles.selectedStableContainer,
                        { borderColor: currentTheme.colors.border },
                      ]}
                    >
                      <View style={styles.selectedStableInfo}>
                        {/* Stable name removed as requested */}
                        {selectedStable && (
                          <>
                            {selectedStable.location && (
                              <Text
                                style={[
                                  styles.selectedStableLocation,
                                  { color: currentTheme.colors.textSecondary },
                                ]}
                              >
                                {selectedStable.location}
                              </Text>
                            )}
                            {selectedStable.city &&
                              selectedStable.state_province && (
                                <Text
                                  style={[
                                    styles.selectedStableMembers,
                                    {
                                      color: currentTheme.colors.textSecondary,
                                    },
                                  ]}
                                >
                                  {selectedStable.city},{" "}
                                  {selectedStable.state_province}
                                </Text>
                              )}
                          </>
                        )}
                        {newStableData && (
                          <>
                            {newStableData.location && (
                              <Text
                                style={[
                                  styles.selectedStableLocation,
                                  { color: currentTheme.colors.textSecondary },
                                ]}
                              >
                                {newStableData.location}
                              </Text>
                            )}
                            {newStableData.city &&
                              newStableData.state_province && (
                                <Text
                                  style={[
                                    styles.selectedStableMembers,
                                    {
                                      color: currentTheme.colors.textSecondary,
                                    },
                                  ]}
                                >
                                  {newStableData.city},{" "}
                                  {newStableData.state_province}
                                </Text>
                              )}
                          </>
                        )}
                      </View>
                      <View style={styles.stableButtonsContainer}>
                        <TouchableOpacity
                          style={[
                            styles.clearStableButton,
                            {
                              backgroundColor:
                                currentTheme.colors.textSecondary,
                            },
                          ]}
                          onPress={handleClearStableSelection}
                        >
                          <Text style={styles.clearStableButtonText}>
                            Clear
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.changeStableButton,
                            { backgroundColor: currentTheme.colors.primary },
                          ]}
                          onPress={() => setShowStableSelection(true)}
                        >
                          <Text style={styles.changeStableButtonText}>
                            Change
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[
                        styles.selectStableButton,
                        {
                          backgroundColor: currentTheme.colors.surface,
                          borderColor: currentTheme.colors.border,
                        },
                      ]}
                      onPress={() => setShowStableSelection(true)}
                    >
                      <Text
                        style={[
                          styles.selectStableButtonText,
                          { color: currentTheme.colors.text },
                        ]}
                      >
                        Choose a Stable/Ranch
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}
          </View>

          <View style={styles.badgesSection}>
            <View style={styles.badgesHeader}>
              <Text
                style={[
                  styles.badgesTitle,
                  { color: currentTheme.colors.text },
                ]}
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
                <ActivityIndicator size="large" color="#335C67" />
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
                  Complete your profile and participate in activities to earn
                  badges.
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Custom Success Modal */}
      <SuccessModal />

      {/* Custom Image Picker Modal */}
      <ImagePickerModal />

      {/* Loading Overlay */}
      {isLoading ? (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#335C67" />
            <Text style={styles.loadingText}>Saving...</Text>
          </View>
        </View>
      ) : null}

      {/* Error Display */}
      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={clearError} style={styles.errorButton}>
            <Text style={styles.errorButtonText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Badge Dialog */}
      {renderBadgeDialog()}

      {/* Stable Selection Modal */}
      <SimpleStableSelection
        visible={showStableSelection}
        onClose={() => setShowStableSelection(false)}
        onSelect={handleStableSelection}
        selectedStable={selectedStable}
      />
    </View>
  );
};

const data = [];

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
  optionsButton: {
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
  optionsIcon: {
    width: 24,
    height: 24,
    tintColor: "#fff",
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
  optionsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
    fontFamily: "Inder",
  },
  sectionContent: {
    backgroundColor: "#E9F5F0",
    borderRadius: 20,
    padding: 5,
  },
  settingItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#C5D9D1",
  },
  settingInfo: {
    flex: 1,
    marginRight: 15,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: "bold",
    fontFamily: "Inder",
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 14,
    fontFamily: "Inder",
  },
  actionButton: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#C5D9D1",
  },
  actionButtonText: {
    fontSize: 16,
    fontFamily: "Inder",
    fontWeight: "500",
  },
  viewPort: {
    backgroundColor: "#FFFFFF",
    flex: 1,
    borderTopLeftRadius: 50,
    borderTopRightRadius: 50,
    marginTop: -4,
    paddingTop: 20,
  },
  profileContainer: {
    paddingHorizontal: 20,
    paddingBottom: 130, // Add bottom padding to account for tab bar
  },
  profileSection: {
    alignItems: "center",
    marginBottom: 40,
    borderRadius: 30,
    padding: 30,
    position: "relative",
  },
  editButton: {
    position: "absolute",
    top: 20,
    right: 20,
    backgroundColor: "#335C67",
    borderRadius: 15,
    paddingHorizontal: 15,
    paddingVertical: 8,
    zIndex: 1,
  },
  editButtonText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inder",
  },
  editButtonsContainer: {
    position: "absolute",
    top: 20,
    right: 20,
    flexDirection: "row",
    gap: 10,
    zIndex: 1,
  },
  cancelButton: {
    position: "absolute",
    left: 20,
    top: 20,
    backgroundColor: "#FF6B6B",
    borderRadius: 15,
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  cancelButtonText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inder",
  },
  saveButton: {
    position: "absolute",
    right: 20,
    top: 20,
    backgroundColor: "#4CAF50",
    borderRadius: 15,
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inder",
  },
  editInput: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginBottom: 15,
    fontSize: 16,
    fontFamily: "Inder",
    textAlign: "center",
    minWidth: 200,
  },
  editDescriptionInput: {
    textAlign: "left",
    minHeight: 120,
    textAlignVertical: "top",
  },
  characterCounter: {
    fontSize: 12,
    fontFamily: "Inder",
    textAlign: "right",
    marginTop: 5,
    marginBottom: 10,
    marginRight: 5,
  },
  profileImageContainer: {
    marginTop: 20,
    marginBottom: 20,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
  },
  editImageContainer: {
    position: "relative",
  },
  editImageOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  editImageLabel: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inder",
    fontWeight: "bold",
  },
  userName: {
    fontSize: 24,
    fontWeight: "bold",
    fontFamily: "Inder",
    marginBottom: 5,
    textAlign: "center",
  },
  userAge: {
    fontSize: 20,
    fontFamily: "Inder",
    marginBottom: 15,
    textAlign: "center",
  },
  userDescription: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 10,
    fontFamily: "Inder",
    marginBottom: 15,
  },
  experienceContainer: {
    alignItems: "center",
    marginTop: 5,
    marginBottom: 16,
  },
  experienceLabel: {
    fontSize: 14,
    fontFamily: "Inder",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  experienceValue: {
    fontSize: 18,
    fontWeight: "bold",
    fontFamily: "Inder",
    marginTop: 2,
  },
  stableRanchContainer: {
    alignItems: "center",
    marginBottom: 15,
  },
  stableRanchLabel: {
    fontSize: 14,
    fontFamily: "Inder",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 5,
  },
  stableRanchValue: {
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "Inder",
    marginTop: 2,
  },
  stableSelectionContainer: {
    marginBottom: 15,
  },
  stableSelectionLabel: {
    fontSize: 14,
    fontFamily: "Inder",
    marginBottom: 8,
    fontWeight: "600",
  },
  selectedStableContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "transparent",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    minHeight: 50,
  },
  selectedStableInfo: {
    flex: 1,
    marginRight: 12,
  },
  selectedStableName: {
    fontSize: 18,
    fontFamily: "Inder",
    fontWeight: "600",
    marginBottom: 4,
  },
  selectedStableNameContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  selectedStableLocation: {
    fontSize: 14,
    fontFamily: "Inder",
    marginBottom: 2,
  },
  selectedStableMembers: {
    fontSize: 12,
    fontFamily: "Inder",
  },
  // View mode stable styles
  viewStableContainer: {
    marginTop: 4,
  },
  viewStableNameContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  viewStableVerifiedBadge: {
    backgroundColor: "#4CAF50",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    marginLeft: 6,
  },
  viewStableVerifiedBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
    fontFamily: "Inder",
  },
  viewStableLocation: {
    fontSize: 12,
    fontFamily: "Inder",
    marginBottom: 1,
  },
  stableButtonsContainer: {
    flexDirection: "row",
    gap: 8,
  },
  clearStableButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  clearStableButtonText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inder",
    fontWeight: "600",
  },
  changeStableButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  changeStableButtonText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inder",
    fontWeight: "600",
  },
  selectStableButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    borderStyle: "dashed",
  },
  selectStableButtonText: {
    fontSize: 16,
    fontFamily: "Inder",
    fontWeight: "600",
  },
  badgeContainer: {
    alignItems: "center",
    marginTop: 5,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: -15,
    borderRadius: 15,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  proBadge: {
    borderColor: "#FFA500",
  },
  regularBadge: {
    borderColor: "#2196F3",
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "bold",
    fontFamily: "Inder",
    letterSpacing: 0.5,
  },
  proBadgeText: {},
  regularBadgeText: {},
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    backgroundColor: "#fff",
    borderRadius: 25,
    padding: 30,
    alignItems: "center",
    marginHorizontal: 40,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#4CAF50",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  checkIcon: {
    fontSize: 40,
    color: "#fff",
    fontWeight: "bold",
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
    fontFamily: "Inder",
  },
  modalMessage: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 25,
    lineHeight: 22,
    fontFamily: "Inder",
  },
  modalButton: {
    backgroundColor: "#335C67",
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 30,
    minWidth: 100,
  },
  modalButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
    fontFamily: "Inder",
  },
  // Image Picker Modal styles
  imagePickerIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#335C67",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  cameraIcon: {
    fontSize: 40,
    color: "#fff",
  },
  imagePickerButtons: {
    flexDirection: "row",
    gap: 15,
    marginBottom: 15,
  },
  imagePickerButton: {
    backgroundColor: "#335C67",
    flex: 1,
  },
  cancelModalButton: {
    backgroundColor: "#FF6B6B",
    minWidth: 120,
  },
  cancelModalButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
    fontFamily: "Inder",
  },
  // Loading and Error styles
  disabledButton: {
    opacity: 0.6,
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  loadingContainer: {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 20,
    alignItems: "center",
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#335C67",
    fontFamily: "Inder",
  },
  errorContainer: {
    position: "absolute",
    top: 100,
    left: 20,
    right: 20,
    backgroundColor: "#FF6B6B",
    borderRadius: 10,
    padding: 15,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 999,
  },
  errorText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inder",
    flex: 1,
  },
  errorButton: {
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    borderRadius: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  errorButtonText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inder",
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
    fontSize: 16,
    fontFamily: "Inder",
    marginBottom: 15,
    marginTop: -25,
  },
  counterValue: {
    fontSize: 24,
    fontWeight: "bold",
    fontFamily: "Inder",
  },
});

export default ProfileScreen;
