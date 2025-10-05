import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import ViewShot from "react-native-view-shot";
import { useAuth } from "../contexts/AuthContext";
import { useMetric } from "../contexts/MetricContext";
import { useTheme } from "../contexts/ThemeContext";
import { CommunityAPI } from "../lib/communityAPI";
import { HorseAPI } from "../lib/horseAPI";
import { convertImageToBase64 } from "../lib/imageUtils";

// Media item interface - same as session-details.tsx
interface MediaItem {
  id: string;
  uri: string;
  type: "photo" | "video";
  timestamp: number;
  location?: {
    latitude: number;
    longitude: number;
  };
}

interface TrackingPoint {
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy?: number;
  speed?: number;
}

interface TrainingSession {
  id: string;
  userId: string;
  horseId: string;
  horseName: string;
  trainingType: string;
  duration?: number;
  distance?: number;
  startTime: number;
  endTime?: number;
  averageSpeed?: number;
  maxSpeed?: number;
  media?: MediaItem[]; // Photos and videos taken during session
  path: TrackingPoint[]; // GPS tracking data (changed from trackingPoints)
}

interface Horse {
  id: string;
  name: string;
  image_url?: string;
  breed?: string;
  age?: number;
  color?: string;
}

const { width } = Dimensions.get("window");

export default function SessionShareScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const { currentTheme } = useTheme();
  const { formatDistance, formatSpeed } = useMetric();
  const theme = currentTheme.colors;

  // Add initialization guard to prevent multiple renders
  const [isInitialized, setIsInitialized] = useState(false);

  // Ref for capturing Instagram story view with ViewShot
  const instagramViewRef = useRef<ViewShot>(null);
  const [mapReady, setMapReady] = useState(false);

  // Get sessionId from params - this is the key piece of data we need
  const sessionId = Array.isArray(params.sessionId)
    ? params.sessionId[0]
    : (params.sessionId as string);

  // State for loaded data
  const [session, setSession] = useState<TrainingSession | null>(null);
  const [horse, setHorse] = useState<Horse | null>(null);
  const [loading, setLoading] = useState(true);
  const [postText, setPostText] = useState("");
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [sharePathEnabled, setSharePathEnabled] = useState(false);

  // Load session data on component mount
  useEffect(() => {
    if (sessionId && !session && !isInitialized) {
      setIsInitialized(true);
      loadSessionData();
    } else if (!sessionId) {
      setLoading(false);
    }
  }, [sessionId]);

  // Debug session state changes
  useEffect(() => {
    console.log("🔍 Session state changed:", {
      hasSession: !!session,
      sessionId: session?.id,
      duration: session?.duration,
      distance: session?.distance,
      averageSpeed: session?.averageSpeed,
      horseName: session?.horseName,
      loading: loading,
    });
  }, [session, loading]);

  const loadSessionData = async () => {
    try {
      setLoading(true);

      const savedSessions = await AsyncStorage.getItem("training_sessions");

      if (!savedSessions) {
        setSession(null);
        setLoading(false);
        return;
      }

      const sessions: TrainingSession[] = JSON.parse(savedSessions);

      const found = sessions.find((s) => s.id === sessionId);

      if (!found) {
        setSession(null);
        setLoading(false);
        return;
      }

      // Found session - setting state
      setSession(found);

      // Debug logging for session data
      console.log("📊 Session data loaded:", {
        id: found.id,
        horseName: found.horseName,
        duration: found.duration,
        distance: found.distance,
        averageSpeed: found.averageSpeed,
        hasPath: found.path?.length > 0,
        pathLength: found.path?.length,
        pathFirstPoint: found.path?.[0],
        pathLastPoint: found.path?.[found.path?.length - 1],
        durationCheck: !!found.duration,
        distanceCheck: !!found.distance,
        avgSpeedCheck: !!found.averageSpeed,
        durationType: typeof found.duration,
        distanceType: typeof found.distance,
        avgSpeedType: typeof found.averageSpeed,
      });

      if (found) {
        // Set default post text with horse name
        setPostText(`Amazing training session with ${found.horseName}! 🐴`);

        // Load horse data if session is found
        if (found.horseId) {
          try {
            const horses = await HorseAPI.getHorses(found.userId);

            if (horses && horses.length > 0) {
              const sessionHorse = horses.find((h) => h.id === found.horseId);

              if (sessionHorse) {
                // Found matching horse - setting state
                setHorse(sessionHorse);
              } else {
                setHorse(null);
              }
            } else {
              setHorse(null);
            }
          } catch (error) {
            console.error("Error loading horse data:", error);
            setHorse(null);
          }
        } else {
          setHorse(null);
        }
      }
    } catch (error) {
      console.error("Error loading session:", error);
      setSession(null);
      setHorse(null);
    } finally {
      setLoading(false);
    }
  };

  // Format duration helper function
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${remainingSeconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${remainingSeconds}s`;
    }
  };

  // Get map region from tracking points
  const getMapRegion = () => {
    if (!session?.path || session.path.length === 0) {
      // Default region (you can adjust this to your preferred location)
      return {
        latitude: 37.78825,
        longitude: -122.4324,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      };
    }

    const points = session.path;
    const latitudes = points.map((p: TrackingPoint) => p.latitude);
    const longitudes = points.map((p: TrackingPoint) => p.longitude);

    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLng = Math.min(...longitudes);
    const maxLng = Math.max(...longitudes);

    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;

    const latDelta = Math.max(maxLat - minLat, 0.01) * 1.3; // Add padding
    const lngDelta = Math.max(maxLng - minLng, 0.01) * 1.3; // Add padding

    return {
      latitude: centerLat,
      longitude: centerLng,
      latitudeDelta: latDelta,
      longitudeDelta: lngDelta,
    };
  };

  // Get media items from session - filter to only photos
  const mediaItems =
    session?.media?.filter((item) => item.type === "photo") || [];

  const toggleMediaSelection = (mediaId: string) => {
    setSelectedMedia((prev) => {
      // If the same media is selected, deselect it
      if (prev === mediaId) {
        return null;
      }
      // Otherwise, select this media (replacing any previous selection)
      return mediaId;
    });
  };

  const sharePost = async () => {
    if (!user) {
      Alert.alert("Error", "Please log in to share your session.");
      return;
    }

    if (!postText.trim()) {
      Alert.alert("Error", "Please add some text to your post.");
      return;
    }

    // Validate that we have something meaningful to share
    const hasSelectedMedia = selectedMedia !== null;
    const hasHorseImage = !!horse?.image_url;

    if (!hasSelectedMedia && !hasHorseImage) {
      Alert.alert(
        "No Images Selected",
        "Your post will be shared without any images. Would you like to continue?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Continue",
            onPress: () => {
              // Continue with the sharing process
              performSharing();
            },
          },
        ]
      );
      return;
    }

    // If we have media or horse image, proceed directly
    await performSharing();
  };

  const performSharing = async () => {
    if (!user) {
      Alert.alert("Error", "Please log in to share your session.");
      return;
    }

    // Enhanced validation for session data
    if (!sessionId || !session) {
      Alert.alert("Error", "Missing session information. Please try again.");
      return;
    }

    // Validate that we have meaningful session data
    if (!session.horseName && !session.duration && !session.distance) {
      Alert.alert(
        "Incomplete Session",
        "This session appears to be incomplete. Please ensure your session has recorded data before sharing."
      );
      return;
    }

    try {
      setIsSharing(true);

      // Add delay to show loading state
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Enhanced session data preparation with better formatting
      const sessionData = {
        horse_name: session.horseName || "Unknown Horse",
        duration: session.duration
          ? formatDuration(session.duration)
          : "Not recorded",
        distance: session.distance
          ? formatDistance(session.distance)
          : "Not recorded",
        avg_speed: session.averageSpeed
          ? formatSpeed(session.averageSpeed)
          : "Not recorded",
        session_id: sessionId,
        training_type: session.trainingType || "Training Session",
        session_date: new Date(session.startTime).toLocaleDateString(),
        // Include path data if user enabled path sharing
        ...(sharePathEnabled && session.path && session.path.length > 0
          ? {
              path: session.path,
              path_enabled: true,
            }
          : { path_enabled: false }),
      };

      // Get selected media item (single selection)
      const selectedMediaItem = selectedMedia
        ? mediaItems.find((item) => item.id === selectedMedia)
        : null;

      let imageBase64: string | undefined;

      // Convert selected image to base64 if available (uploaded session photo)
      if (selectedMediaItem?.uri) {
        try {
          console.log("Converting selected image to base64...");
          imageBase64 = await convertImageToBase64(selectedMediaItem.uri);
          console.log("Image converted to base64 successfully");
        } catch (error) {
          console.error(
            "❌ [SessionShare] Failed to convert image to base64:",
            error
          );
          Alert.alert(
            "Image Processing",
            "Failed to process selected image. Continuing without image."
          );
          // Continue without base64 if conversion fails
        }
      }

      // Enhanced media info tracking
      const mediaInfo = selectedMediaItem
        ? {
            selected_media_id: selectedMediaItem.id,
            selected_media_type: selectedMediaItem.type,
            has_base64: !!imageBase64,
            media_timestamp: selectedMediaItem.timestamp,
          }
        : {};

      console.log("Creating post with enhanced data:", {
        sessionData,
        hasSelectedMedia: !!selectedMediaItem,
        hasBase64: !!imageBase64,
        hasHorseImage: !!horse?.image_url,
        mediaInfo,
        contentLength: postText.trim().length,
        sharePathEnabled,
        pathPointsCount: sharePathEnabled ? session.path?.length : 0,
      });

      // Create post in database with core session data
      const result = await CommunityAPI.createPost(user.id, {
        content: postText.trim(),
        image_url: horse?.image_url || undefined, // ONLY horse profile picture
        image_base64: imageBase64, // ONLY uploaded session photo
        session_data: {
          ...sessionData,
          horse_image_url: horse?.image_url || undefined,
        },
      });

      console.log("Post created with additional media info:", mediaInfo);

      // Enhanced error handling for post creation
      const { post, error } = result;

      if (error) {
        console.error("Post creation failed:", error);
        Alert.alert(
          "Sharing Failed",
          `Unable to share your session: ${error}. Please try again.`
        );
        return;
      }

      if (!post) {
        console.error("Post creation returned no post");
        Alert.alert(
          "Sharing Failed",
          "Failed to create post. Please check your connection and try again."
        );
        return;
      }

      // Success feedback with enhanced options
      Alert.alert(
        "Success! 🎉",
        "Your training session has been shared with the EquiHub community!",
        [
          {
            text: "View in Community",
            onPress: () => {
              router.push("/(tabs)/community");
            },
          },
          {
            text: "Share Another",
            onPress: () => {
              // Reset form for another share
              setPostText(
                `Amazing training session with ${session.horseName}! 🐴`
              );
              setSelectedMedia(null);
            },
          },
          {
            text: "Done",
            onPress: () => {
              router.back();
            },
            style: "default",
          },
        ]
      );
    } catch (error) {
      console.error("Error sharing session:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      Alert.alert(
        "Sharing Failed",
        `Failed to share your session: ${errorMessage}. Please check your connection and try again.`
      );
    } finally {
      setIsSharing(false);
    }
  };

  const shareToInstagramStory = async () => {
    try {
      setIsSharing(true);

      // Validate session data
      if (!session) {
        Alert.alert("Error", "Session data not available for sharing.");
        return;
      }

      // Check if Instagram sharing is available
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert("Error", "Sharing is not available on this device.");
        return;
      }

      console.log("Creating Instagram story image using ViewShot...");

      // Log path data for Instagram story
      if (session.path && session.path.length > 0) {
        console.log(
          "📍 Instagram story will include GPS path with",
          session.path.length,
          "points"
        );
      } else {
        console.log(
          "⚠️ Instagram story will use fallback design - no GPS path available"
        );
      }

      // Validate ViewShot ref
      if (!instagramViewRef.current) {
        Alert.alert(
          "Error",
          "Instagram view not ready. Please try again in a moment."
        );
        return;
      }

      // Wait for view to be fully rendered
      await new Promise((resolve) => setTimeout(resolve, 1000));

      try {
        console.log("Attempting to capture Instagram view...");

        // Capture the view using ViewShot
        if (!instagramViewRef.current?.capture) {
          throw new Error("ViewShot capture method not available");
        }

        const imageUri = await instagramViewRef.current.capture();
        console.log("Instagram view captured successfully:", imageUri);

        // Enhanced sharing with better metadata
        await Sharing.shareAsync(imageUri, {
          mimeType: "image/jpeg",
          dialogTitle: "Share Training Session to Instagram Story",
          UTI: "public.jpeg",
        });

        Alert.alert(
          "Shared Successfully! 🎉",
          "Your training session has been shared to Instagram Story!",
          [{ text: "OK", style: "default" }]
        );

        // Clean up the temporary file
        try {
          await FileSystem.deleteAsync(imageUri, { idempotent: true });
          console.log("Temporary Instagram image cleaned up");
        } catch (cleanupError) {
          console.warn(
            "Failed to clean up temporary Instagram file:",
            cleanupError
          );
        }
      } catch (captureError) {
        console.error("Error capturing Instagram view:", captureError);

        const errorMessage =
          captureError instanceof Error
            ? captureError.message
            : "Unknown error";

        Alert.alert(
          "Capture Failed",
          `Failed to create Instagram story image: ${errorMessage}. Please try again.`
        );
        return;
      }
    } catch (error) {
      console.error("Error sharing to Instagram Story:", error);
      Alert.alert(
        "Error",
        "Failed to share to Instagram Story. Please try again."
      );
    } finally {
      setIsSharing(false);
    }
  };

  // Show loading screen while session data is being loaded
  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.primary }]}>
        <SafeAreaView
          style={[styles.safeArea, { backgroundColor: theme.primary }]}
        >
          <View style={styles.headerContainer}>
            <Text style={styles.header}>Share Session</Text>
          </View>
        </SafeAreaView>
        <View
          style={[
            styles.loadingScreenContainer,
            { backgroundColor: theme.background },
          ]}
        >
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={[styles.loadingScreenText, { color: theme.text }]}>
            Loading session data...
          </Text>
        </View>
      </View>
    );
  }

  // Show error screen if session not found
  if (!session) {
    return (
      <View style={[styles.container, { backgroundColor: theme.primary }]}>
        <SafeAreaView
          style={[styles.safeArea, { backgroundColor: theme.primary }]}
        >
          <View style={styles.headerContainer}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Image
                style={{ width: 24, height: 24 }}
                source={require("../assets/in_app_icons/back.png")}
              />
            </TouchableOpacity>
            <Text style={styles.header}>Share Session</Text>
            <View style={styles.backButton} /> {/* Spacer for centering */}
          </View>
        </SafeAreaView>
        <View
          style={[
            styles.errorScreenContainer,
            { backgroundColor: theme.background },
          ]}
        >
          <Text style={[styles.errorText, { color: theme.error }]}>
            Session not found
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[
              styles.backToSessionButton,
              { backgroundColor: theme.accent },
            ]}
          >
            <Text
              style={[
                styles.backToSessionButtonText,
                { color: theme.background },
              ]}
            >
              Go Back
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.primary }]}>
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: theme.primary }]}
      >
        <View style={styles.headerContainer}>
          <TouchableOpacity
            onPress={() => {
              router.back();
            }}
            style={styles.backButton}
            disabled={isSharing}
          >
            <Image
              style={{ width: 24, height: 24 }}
              source={require("../assets/in_app_icons/back.png")}
            />
          </TouchableOpacity>
          <Text style={[styles.header, { color: "#FFFFFF" }]}>
            Share Session
          </Text>
          <View style={styles.backButton} /> {/* Spacer for centering */}
        </View>
      </SafeAreaView>

      <ScrollView
        style={[
          styles.viewPort,
          { backgroundColor: theme.background },
          isSharing && styles.disabledContent,
        ]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!isSharing}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 }]}
      >
        {/* Session Stats Cards */}
        <View style={styles.statsGrid}>
          <View
            style={[
              styles.statCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <View
              style={[
                styles.statIconContainer,
                { backgroundColor: theme.accent + "20" },
              ]}
            >
              <Ionicons name="time-outline" size={24} color={theme.primary} />
            </View>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {session?.duration !== undefined && session?.duration !== null
                ? formatDuration(session.duration)
                : "N/A"}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
              Duration
            </Text>
          </View>

          <View
            style={[
              styles.statCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <View
              style={[
                styles.statIconContainer,
                { backgroundColor: theme.accent + "20" },
              ]}
            >
              <Ionicons
                name="navigate-outline"
                size={24}
                color={theme.primary}
              />
            </View>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {session?.distance !== undefined && session?.distance !== null
                ? formatDistance(session.distance)
                : "N/A"}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
              Distance
            </Text>
          </View>

          <View
            style={[
              styles.statCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <View
              style={[
                styles.statIconContainer,
                { backgroundColor: theme.accent + "20" },
              ]}
            >
              <Ionicons
                name="speedometer-outline"
                size={24}
                color={theme.primary}
              />
            </View>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {session?.averageSpeed !== undefined &&
              session?.averageSpeed !== null
                ? formatSpeed(session.averageSpeed)
                : "N/A"}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
              Avg Speed
            </Text>
          </View>

          <View
            style={[
              styles.statCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <View
              style={[
                styles.statIconContainer,
                { backgroundColor: theme.accent + "20" },
              ]}
            >
              <Ionicons name="person-outline" size={24} color={theme.primary} />
            </View>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {session?.horseName || "N/A"}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
              Horse
            </Text>
          </View>
        </View>

        {/* Post Content Card */}
        <View
          style={[
            styles.postContentCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <View style={styles.postContentHeader}>
            <View
              style={[
                styles.postIconContainer,
                { backgroundColor: theme.accent + "20" },
              ]}
            >
              <Ionicons name="create-outline" size={24} color={theme.primary} />
            </View>
            <Text style={[styles.postContentTitle, { color: theme.text }]}>
              Post Content
            </Text>
          </View>
          <TextInput
            style={[
              styles.postTextInput,
              {
                backgroundColor: "transparent",
                color: theme.text,
                borderWidth: 0,
              },
            ]}
            value={postText}
            onChangeText={(text) => {
              // Count lines by splitting on newlines
              const lines = text.split("\n");

              // Limit to 10 lines and 500 characters
              if (lines.length <= 10 && text.length <= 500) {
                setPostText(text);
              } else if (lines.length > 10) {
                // If too many lines, take only first 10 lines
                const limitedText = lines.slice(0, 10).join("\n");
                if (limitedText.length <= 500) {
                  setPostText(limitedText);
                }
              } else if (text.length > 500) {
                // If too many characters, truncate but respect line limit
                const truncatedText = text.substring(0, 500);
                const truncatedLines = truncatedText.split("\n");
                if (truncatedLines.length <= 10) {
                  setPostText(truncatedText);
                }
              }
            }}
            placeholder="Share your thoughts about this training session..."
            placeholderTextColor={theme.textSecondary}
            multiline
            numberOfLines={4}
            maxLength={500}
            editable={!isSharing}
          />
          <View style={styles.postContentFooter}>
            <Text
              style={[
                styles.postCharacterCount,
                { color: theme.textSecondary },
              ]}
            >
              {postText.split("\n").length}/10 lines • {postText.length}/500
              characters
            </Text>
          </View>

          {/* Share Path Checkbox */}
          {session?.path && session.path.length > 0 && (
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => setSharePathEnabled(!sharePathEnabled)}
              disabled={isSharing}
            >
              <View
                style={[
                  styles.checkbox,
                  {
                    backgroundColor: sharePathEnabled
                      ? theme.primary
                      : "transparent",
                    borderColor: theme.primary,
                  },
                ]}
              >
                {sharePathEnabled && (
                  <Ionicons name="checkmark" size={18} color="#fff" />
                )}
              </View>
              <Text style={[styles.checkboxLabel, { color: theme.text }]}>
                Share path ({session.path.length} points)
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Session Media Card */}
        {mediaItems.length > 0 && (
          <View
            style={[
              styles.mediaContentCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <View style={styles.mediaContentHeader}>
              <View
                style={[
                  styles.mediaIconContainer,
                  { backgroundColor: theme.accent + "20" },
                ]}
              >
                <Ionicons
                  name="images-outline"
                  size={24}
                  color={theme.primary}
                />
              </View>
              <Text style={[styles.mediaContentTitle, { color: theme.text }]}>
                Session Media ({mediaItems.length})
              </Text>
            </View>
            {selectedMedia && (
              <View
                style={[
                  styles.selectedCountContainer,
                  { backgroundColor: theme.accent + "20" },
                ]}
              >
                <Ionicons
                  name="checkmark-circle"
                  size={16}
                  color={theme.primary}
                />
                <Text
                  style={[styles.selectedCountText, { color: theme.primary }]}
                >
                  1 photo selected
                </Text>
              </View>
            )}
            <ScrollView
              horizontal
              style={styles.mediaScrollView}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.mediaScrollContent}
            >
              {mediaItems.map((item, index) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.mediaItemContainer,
                    selectedMedia === item.id && styles.selectedMediaContainer,
                  ]}
                  onPress={() => toggleMediaSelection(item.id)}
                  disabled={isSharing}
                  activeOpacity={0.8}
                >
                  <View style={styles.mediaThumbnailWrapper}>
                    <Image
                      source={{ uri: item.uri }}
                      style={styles.mediaThumbnail}
                      resizeMode="cover"
                    />

                    {/* Media Type Badge */}
                    <View
                      style={[
                        styles.mediaTypeBadge,
                        item.type === "video"
                          ? styles.videoBadge
                          : styles.photoBadge,
                      ]}
                    >
                      <Ionicons
                        name={item.type === "photo" ? "camera" : "videocam"}
                        size={12}
                        color="#FFFFFF"
                      />
                    </View>

                    {/* Selection Indicator */}
                    <View
                      style={[
                        styles.selectionIndicator,
                        selectedMedia === item.id && [
                          styles.selectedIndicator,
                          {
                            backgroundColor: theme.accent,
                            borderColor: theme.accent,
                          },
                        ],
                      ]}
                    >
                      {selectedMedia === item.id ? (
                        <Ionicons
                          name="checkmark"
                          size={16}
                          color={theme.background}
                        />
                      ) : (
                        <View
                          style={[
                            styles.unselectedCircle,
                            { borderColor: theme.textSecondary },
                          ]}
                        />
                      )}
                    </View>

                    {/* Selected Overlay */}
                    {selectedMedia === item.id && (
                      <View
                        style={[
                          styles.selectedOverlayNew,
                          {
                            borderColor: theme.accent,
                            backgroundColor: theme.accent + "33",
                          },
                        ]}
                      />
                    )}
                  </View>

                  {/* Timestamp */}
                  <Text
                    style={[
                      styles.mediaTimeNew,
                      {
                        color: theme.textSecondary,
                        backgroundColor: theme.surface,
                      },
                    ]}
                  >
                    {new Date(item.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Selection Hint */}
            {!selectedMedia && (
              <View
                style={[
                  styles.selectionHint,
                  { backgroundColor: theme.surface },
                ]}
              >
                <Ionicons
                  name="information-circle"
                  size={16}
                  color={theme.textSecondary}
                />
                <Text style={[styles.hintText, { color: theme.textSecondary }]}>
                  Tap a photo to include it in your post (photos only)
                </Text>
              </View>
            )}
            {selectedMedia && (
              <View
                style={[
                  styles.selectionHint,
                  { backgroundColor: theme.surface },
                ]}
              >
                <Ionicons name="image" size={16} color={theme.success} />
                <Text style={[styles.hintText, { color: theme.textSecondary }]}>
                  This photo will be shown as the main image in your post
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Instagram Story View - Map + Data Hybrid */}
        <View style={styles.mapContainer}>
          <View style={styles.mapTitleContainer}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Instagram Story Preview
            </Text>
          </View>
          <ViewShot
            ref={instagramViewRef}
            style={styles.instagramMapView}
            options={{
              format: "jpg",
              quality: 0.9,
              result: "tmpfile",
            }}
          >
            {/* Map Background */}
            {(() => {
              // Debug path data
              if (session?.path && session.path.length > 0) {
                console.log(
                  "🗺️ Rendering polyline with",
                  session.path.length,
                  "coordinates"
                );
                console.log("📍 Sample path points:", session.path.slice(0, 3));
                console.log("📍 Map region:", getMapRegion());
              } else {
                console.log(
                  "⚠️ No path data available - using fallback. Session path:",
                  session?.path
                );
              }

              return session?.path && session.path.length > 0 ? (
                <MapView
                  style={styles.hybridMapBackground}
                  provider={PROVIDER_GOOGLE}
                  initialRegion={getMapRegion()}
                  scrollEnabled={false}
                  zoomEnabled={false}
                  rotateEnabled={false}
                  pitchEnabled={false}
                  showsUserLocation={false}
                  showsMyLocationButton={false}
                  showsCompass={false}
                  showsScale={false}
                  showsBuildings={true}
                  showsTraffic={false}
                  showsIndoors={false}
                  showsPointsOfInterest={false}
                  loadingEnabled={false}
                  onMapReady={() => {
                    setMapReady(true);
                    console.log(
                      "📍 Map ready for Instagram story with path:",
                      session.path.length,
                      "points"
                    );
                  }}
                >
                  {/* Route Polyline - Show the complete path */}
                  <Polyline
                    coordinates={session.path.map((point: TrackingPoint) => {
                      console.log("📍 Processing point:", point);
                      return {
                        latitude: point.latitude,
                        longitude: point.longitude,
                      };
                    })}
                    strokeColor="#FF6B6B"
                    strokeWidth={8}
                    lineJoin="round"
                    lineCap="round"
                    geodesic={true}
                  />
                </MapView>
              ) : (
                <View
                  style={[
                    styles.hybridMapBackground,
                    styles.hybridFallbackBackground,
                    { backgroundColor: theme.primary },
                  ]}
                >
                  <View
                    style={[
                      styles.hybridGradientOverlay,
                      { backgroundColor: theme.accent + "30" },
                    ]}
                  />
                  {/* Fallback content when no GPS data */}
                  <View style={styles.noPathFallback}>
                    <Ionicons
                      name="location-outline"
                      size={48}
                      color="#FFFFFF"
                    />
                    <Text style={styles.noPathText}>Training Session</Text>
                    <Text style={styles.noPathSubtext}>
                      No GPS tracking available
                    </Text>
                  </View>
                </View>
              );
            })()}

            {/* Content Overlay - Part of Main View */}
            <View style={styles.hybridContentOverlay}>
              {/* Header Section */}
              <View style={styles.hybridHeader}>
                <View style={styles.hybridBrandContainer}>
                  <Ionicons name="logo-buffer" size={18} color="#FFFFFF" />
                  <Text style={styles.hybridBrandText}>EquiHub</Text>
                </View>
                <Text style={styles.hybridTitle}>Training Session</Text>
              </View>

              {/* Horse Section */}
              <View style={styles.hybridHorseSection}>
                <Image
                  source={
                    horse?.image_url
                      ? { uri: horse.image_url }
                      : require("../assets/images/horses/pony.jpg")
                  }
                  style={styles.hybridHorseImage}
                />
                <Text style={styles.hybridHorseName}>
                  {session.horseName || "Unknown Horse"}
                </Text>
              </View>

              {/* Spacer to push stats to bottom */}
              <View style={styles.hybridSpacer} />

              {/* Stats Section - Compact Layout */}
              <View style={styles.hybridStatsContainer}>
                <View style={styles.hybridStatsGrid}>
                  <View style={styles.hybridStatItem}>
                    <Ionicons name="time-outline" size={24} color="#FFFFFF" />
                    <Text style={styles.hybridStatValue}>
                      {session?.duration !== undefined &&
                      session?.duration !== null
                        ? formatDuration(session.duration)
                        : "N/A"}
                    </Text>
                    <Text style={styles.hybridStatLabel}>Duration</Text>
                  </View>

                  <View style={styles.hybridStatItem}>
                    <Ionicons
                      name="navigate-outline"
                      size={24}
                      color="#FFFFFF"
                    />
                    <Text style={styles.hybridStatValue}>
                      {session?.distance !== undefined &&
                      session?.distance !== null
                        ? formatDistance(session.distance)
                        : "N/A"}
                    </Text>
                    <Text style={styles.hybridStatLabel}>Distance</Text>
                  </View>

                  <View style={styles.hybridStatItem}>
                    <Ionicons
                      name="speedometer-outline"
                      size={24}
                      color="#FFFFFF"
                    />
                    <Text style={styles.hybridStatValue}>
                      {session?.averageSpeed !== undefined &&
                      session?.averageSpeed !== null
                        ? formatSpeed(session.averageSpeed)
                        : "N/A"}
                    </Text>
                    <Text style={styles.hybridStatLabel}>Avg Speed</Text>
                  </View>
                </View>

                {/* Date Footer */}
                <View style={styles.hybridDateFooter}>
                  <Text style={styles.hybridDateText}>
                    {new Date().toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </Text>
                </View>
              </View>
            </View>
          </ViewShot>
        </View>
      </ScrollView>

      {/* Fixed Bottom Share Section */}
      <View
        style={[
          styles.bottomShareContainer,
          { backgroundColor: theme.surface },
        ]}
      >
        <View style={styles.shareHeader}>
          <Text style={[styles.shareTitle, { color: theme.text }]}>
            Share Your Session
          </Text>
          <Text style={[styles.shareSubtitle, { color: theme.textSecondary }]}>
            Choose how you'd like to share your training
          </Text>
        </View>

        <View style={styles.shareButtonsRow}>
          {/* Instagram Story Button */}
          <TouchableOpacity
            onPress={shareToInstagramStory}
            style={[
              styles.shareButton,
              styles.instagramShareButton,
              { backgroundColor: "#E1306C", borderColor: "#E1306C" },
              isSharing && styles.disabledButton,
            ]}
            disabled={isSharing}
          >
            <View style={styles.shareButtonContent}>
              <Ionicons name="logo-instagram" size={24} color="#FFFFFF" />
              <View style={styles.shareButtonText}>
                <Text style={[styles.shareButtonTitle, { color: "#FFFFFF" }]}>
                  Instagram
                </Text>
                <Text
                  style={[
                    styles.shareButtonDesc,
                    { color: "rgba(255,255,255,0.8)" },
                  ]}
                >
                  Story
                </Text>
              </View>
            </View>
            {isSharing && (
              <View style={styles.shareButtonLoading}>
                <ActivityIndicator size="small" color="#FFFFFF" />
              </View>
            )}
          </TouchableOpacity>

          {/* Community Feed Button */}
          <TouchableOpacity
            onPress={sharePost}
            style={[
              styles.shareButton,
              styles.communityShareButton,
              { backgroundColor: theme.accent, borderColor: theme.accent },
              isSharing && styles.disabledButton,
            ]}
            disabled={isSharing}
          >
            <View style={styles.shareButtonContent}>
              <Ionicons name="people" size={24} color="#FFFFFF" />
              <View style={styles.shareButtonText}>
                <Text style={[styles.shareButtonTitle, { color: "#FFFFFF" }]}>
                  Community
                </Text>
                <Text
                  style={[
                    styles.shareButtonDesc,
                    { color: "rgba(255,255,255,0.8)" },
                  ]}
                >
                  Feed
                </Text>
              </View>
            </View>
            {isSharing && (
              <View style={styles.shareButtonLoading}>
                <ActivityIndicator size="small" color="#FFFFFF" />
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Full Screen Loading Overlay */}
      {isSharing && (
        <View
          style={[
            styles.loadingOverlay,
            { backgroundColor: theme.background + "CC" },
          ]}
        >
          <View
            style={[
              styles.loadingContainer,
              { backgroundColor: theme.surface },
            ]}
          >
            <ActivityIndicator size="large" color={theme.accent} />
            <Text style={[styles.loadingText, { color: theme.text }]}>
              Preparing your session...
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    // backgroundColor applied dynamically
  },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    position: "relative",
    marginBottom: -45,
    marginTop: -5,
  },
  header: {
    fontSize: 24,
    fontFamily: "Inder",
    fontWeight: "600",
    flex: 1,
    textAlign: "center",
  },
  backButton: {
    padding: 8,
    zIndex: 1,
  },
  viewPort: {
    backgroundColor: "#FFFFFF",
    flex: 1,
    borderTopLeftRadius: 50,
    borderTopRightRadius: 50,
    marginTop: -8,
    paddingTop: 0,
    marginBottom: 100,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  disabledContent: {
    opacity: 0.6,
  },
  disabledButton: {
    opacity: 0.6,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
    fontFamily: "Inder",
  },
  mediaSection: {
    marginBottom: 20,
  },
  mediaScroll: {
    flexDirection: "row",
  },
  mediaItem: {
    marginRight: 12,
    position: "relative",
    borderRadius: 12,
    overflow: "hidden",
  },
  mediaImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: "rgba(248, 249, 250, 0.5)",
  },
  videoIcon: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 12,
    padding: 4,
  },
  selectionOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  loadingContainer: {
    borderRadius: 20,
    padding: 30,
    alignItems: "center",
    minWidth: 200,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  loadingScreenContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderTopLeftRadius: 50,
    borderTopRightRadius: 50,
    marginTop: 5,
  },
  loadingScreenText: {
    marginTop: 15,
    fontSize: 16,
    fontWeight: "500",
    textAlign: "center",
  },
  errorScreenContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderTopLeftRadius: 50,
    borderTopRightRadius: 50,
    marginTop: 5,
  },
  errorText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FF6B6B",
    textAlign: "center",
    marginBottom: 20,
  },
  backToSessionButton: {
    backgroundColor: "#FFD700",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
  },
  backToSessionButtonText: {
    color: "#000000",
    fontWeight: "600",
    fontSize: 16,
  },

  // Bottom Share Buttons
  bottomButtonsContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
    borderTopWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    marginBottom: 35,
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
  },

  // New Bottom Container Styles
  bottomContainerNew: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  actionHeader: {
    alignItems: "center",
    marginBottom: 24,
  },
  actionTitle: {
    fontSize: 20,
    fontWeight: "700",
    fontFamily: "Inder",
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 14,
    textAlign: "center",
    opacity: 0.8,
  },
  shareOptionsContainer: {
    gap: 12,
    marginBottom: 20,
  },
  shareOptionCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
  },
  primaryShareCard: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  shareOptionContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
  },
  shareIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  shareOptionText: {
    flex: 1,
  },
  shareOptionTitle: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inder",
    marginBottom: 2,
  },
  shareOptionDesc: {
    fontSize: 13,
    opacity: 0.8,
  },
  shareArrow: {
    marginLeft: 8,
  },
  loadingOverlayCard: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255,255,255,0.9)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 16,
  },
  quickStatsSummary: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  quickStatsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  quickStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  quickStatText: {
    fontSize: 12,
    fontWeight: "500",
  },
  instagramButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 25,
    gap: 8,
  },
  instagramButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
  communityButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 25,
    gap: 8,
  },
  communityButtonText: {
    fontWeight: "600",
    fontSize: 16,
  },

  // Enhanced Media Gallery Styles
  mediaCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
  },
  selectedCountContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 15,
    alignSelf: "flex-start",
  },
  selectedCountText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: "600",
  },
  mediaScrollView: {
    paddingVertical: 5,
  },
  mediaScrollContent: {
    paddingHorizontal: 5,
  },
  mediaItemContainer: {
    marginHorizontal: 8,
    alignItems: "center",
  },
  selectedMediaContainer: {
    transform: [{ scale: 0.95 }],
  },
  mediaThumbnailWrapper: {
    position: "relative",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  mediaThumbnail: {
    width: 120,
    height: 120,
    borderRadius: 16,
  },
  mediaTypeBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
  },
  videoBadge: {
    backgroundColor: "rgba(220, 53, 69, 0.9)",
  },
  photoBadge: {
    backgroundColor: "rgba(40, 167, 69, 0.9)",
  },
  selectionIndicator: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
  },
  selectedIndicator: {
    // Colors applied dynamically
  },
  unselectedCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    backgroundColor: "transparent",
  },
  selectedOverlayNew: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
    borderWidth: 2,
  },
  mediaTimeNew: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "500",
    textAlign: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: "hidden",
  },
  selectionHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  hintText: {
    marginLeft: 6,
    fontSize: 13,
    fontStyle: "italic",
  },

  // Keep existing media styles for compatibility
  selectedMediaItem: {
    transform: [{ scale: 0.95 }],
    opacity: 0.8,
  },
  mediaOverlay: {
    position: "absolute",
    top: 5,
    right: 5,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 12,
    padding: 4,
  },
  selectedOverlay: {
    backgroundColor: "rgba(255,215,0,0.3)",
    borderWidth: 2,
    borderColor: "#FFD700",
  },
  mediaTypeIcon: {
    fontSize: 16,
  },
  mediaTime: {
    fontSize: 12,
    fontFamily: "Inder",
    textAlign: "center",
  },

  // Instagram Map View Styles
  mapContainer: {
    marginBottom: 20,
  },
  mapTitleContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  readyIndicator: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  readyText: {
    fontSize: 12,
    fontWeight: "600",
  },
  hiddenMapContainer: {
    position: "absolute",
    top: -10000, // Hide the map view off-screen
    left: 0,
    width: width,
    height: width, // Square aspect ratio
  },
  instagramMapView: {
    width: width,
    height: width, // Square aspect ratio (1:1)
    position: "relative",
  },
  mapBackground: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  fallbackBackground: {
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    backgroundColor: "#f8f9fa",
  },
  gradientLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  fallbackContent: {
    alignItems: "center",
    zIndex: 1,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  fallbackTitle: {
    fontSize: 24,
    fontWeight: "bold",
    fontFamily: "Inder",
    textAlign: "center",
    marginBottom: 8,
  },
  fallbackSubtitle: {
    fontSize: 14,
    textAlign: "center",
    opacity: 0.8,
  },
  noMapText: {
    fontSize: 16,
    fontWeight: "500",
    marginTop: 10,
    textAlign: "center",
  },
  mapOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "space-between",
  },
  mapTopLeft: {
    position: "absolute",
    top: 16,
    left: 16,
  },
  mapTopRight: {
    position: "absolute",
    top: 16,
    right: 16,
  },
  mapBrandingContainer: {
    backgroundColor: "rgba(128, 128, 128, 0.5)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },

  // New Redesigned Map Overlay Styles
  mapBrandingContainerNew: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  mapBrandIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  mapBrandTextNew: {
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Inder",
    color: "#FFFFFF",
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  mapHorseContainerNew: {
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    minWidth: 80,
  },
  mapHorseImageNew: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginBottom: 4,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  mapHorseNameNew: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  mapSessionStatsContainer: {
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    borderRadius: 20,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  mapSessionHeader: {
    alignItems: "center",
    marginBottom: 12,
  },
  mapSessionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    fontFamily: "Inder",
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  mapSessionStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  mapSessionStatItem: {
    alignItems: "center",
    flex: 1,
  },
  mapStatIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  mapSessionStatLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 2,
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
    opacity: 0.9,
  },
  mapSessionStatValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    fontFamily: "Inder",
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  mapHorseContainer: {
    backgroundColor: "rgba(128, 128, 128, 0.5)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
    minWidth: 80,
    marginRight: 16,
  },
  mapHorseImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginBottom: 4,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  mapHorseName: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  mapCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  mapBottom: {
    position: "relative",
    marginLeft: "auto",
    marginRight: "auto",
    alignItems: "center",
    width: "75%",
  },
  mapStatsContainer: {
    backgroundColor: "rgba(128, 128, 128, 0.5)",
    borderRadius: 12,
    padding: 2,
  },
  mapHeader: {
    alignItems: "center",
  },
  mapTitle: {
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    fontFamily: "Inder",
    color: "#FFFFFF",
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  mapSubtitle: {
    fontSize: 24,
    textAlign: "center",
    marginTop: 4,
    color: "#FFFFFF",
    fontWeight: "bold",
    fontFamily: "Inder",
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  mapStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  mapStatItem: {
    alignItems: "center",
    flex: 1,
  },
  mapStatLabel: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 6,
    textAlign: "center",
    color: "#FFFFFF",
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  mapStatValue: {
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 2,
    textAlign: "center",
    fontFamily: "Inder",
    color: "#FFFFFF",
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  mapBranding: {
    alignItems: "center",
  },
  mapBrandText: {
    fontSize: 18,
    fontWeight: "bold",
    fontFamily: "Inder",
    color: "#FFFFFF",
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  // Stats Cards Grid
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginVertical: 20,
    gap: 12,
  },
  statCard: {
    borderRadius: 16,
    padding: 16,
    width: "48%",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 4,
    fontFamily: "Inder",
  },
  statLabel: {
    fontSize: 12,
    textAlign: "center",
    fontWeight: "500",
  },
  // Post Content Card Styles
  postContentCard: {
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 16,
    marginVertical: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
  },
  postContentHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  postIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  postContentTitle: {
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "Inder",
  },
  postTextInput: {
    fontSize: 16,
    textAlignVertical: "top",
    minHeight: 100,
    padding: 0,
  },
  postContentFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 8,
  },
  postCharacterCount: {
    fontSize: 12,
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  checkboxLabel: {
    fontSize: 15,
    fontFamily: "Inder",
    fontWeight: "500",
  },
  // Media Content Card Styles
  mediaContentCard: {
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 16,
    marginVertical: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
  },
  mediaContentHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  mediaIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  mediaContentTitle: {
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "Inder",
  },

  // Simple Instagram View Styles - Flat Design
  simpleBackgroundGradient: {
    flex: 1,
    position: "relative",
  },
  simpleBackgroundOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  simpleHeader: {
    paddingTop: 40,
    paddingHorizontal: 24,
    alignItems: "center",
    marginBottom: 20,
  },
  simpleBrandContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  simpleBrandText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    marginLeft: 8,
    fontFamily: "Inder",
  },
  simpleTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    fontFamily: "Inder",
  },
  simpleHorseSection: {
    alignItems: "center",
    marginBottom: 30,
    paddingHorizontal: 24,
  },
  simpleHorseImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: "#FFFFFF",
    marginBottom: 12,
  },
  simpleHorseName: {
    fontSize: 20,
    fontWeight: "600",
    color: "#FFFFFF",
    textAlign: "center",
    fontFamily: "Inder",
  },
  simpleStatsSection: {
    paddingHorizontal: 24,
    marginBottom: 30,
  },
  simpleStatCard: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  simpleStatValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    marginTop: 8,
    fontFamily: "Inder",
  },
  simpleStatLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#FFFFFF",
    textAlign: "center",
    marginTop: 4,
    opacity: 0.9,
  },
  simpleRouteSection: {
    alignItems: "center",
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  simpleRouteIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  simpleRouteText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#FFFFFF",
    textAlign: "center",
    opacity: 0.9,
  },
  simpleDateSection: {
    paddingHorizontal: 24,
    paddingBottom: 30,
    alignItems: "center",
  },
  simpleDateText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#FFFFFF",
    textAlign: "center",
    opacity: 0.8,
  },

  // Hybrid Instagram View Styles - Map + Data Combined
  hybridMapBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  hybridFallbackBackground: {
    position: "relative",
  },
  hybridGradientOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  hybridContentOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "space-between",
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  hybridHeader: {
    alignItems: "center",
    marginBottom: 10,
  },
  hybridBrandContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  hybridBrandText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    marginLeft: 6,
    fontFamily: "Inder",
  },
  hybridTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    fontFamily: "Inder",
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  hybridHorseSection: {
    alignItems: "center",
    marginTop: 10,
  },
  hybridHorseImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    marginBottom: 8,
  },
  hybridHorseName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    textAlign: "center",
    fontFamily: "Inder",
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  hybridSpacer: {
    flex: 1,
  },
  hybridStatsContainer: {
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 16,
    padding: 16,
  },
  hybridStatsGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 12,
  },
  hybridStatItem: {
    alignItems: "center",
    flex: 1,
  },
  hybridStatValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    marginTop: 6,
    fontFamily: "Inder",
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  hybridStatLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: "#FFFFFF",
    textAlign: "center",
    marginTop: 2,
    opacity: 0.9,
  },
  hybridDateFooter: {
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.2)",
  },
  hybridDateText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#FFFFFF",
    textAlign: "center",
    opacity: 0.8,
  },

  // Redesigned Bottom Share Section
  bottomShareContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  shareHeader: {
    alignItems: "center",
    marginBottom: 20,
  },
  shareTitle: {
    fontSize: 20,
    fontWeight: "700",
    fontFamily: "Inder",
    marginBottom: 4,
  },
  shareSubtitle: {
    fontSize: 14,
    textAlign: "center",
    opacity: 0.8,
  },
  shareButtonsRow: {
    flexDirection: "row",
    gap: 12,
  },
  shareButton: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 2,
    overflow: "hidden",
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  instagramShareButton: {
    // Instagram-specific styles applied via backgroundColor prop
  },
  communityShareButton: {
    // Community-specific styles applied via backgroundColor prop
  },
  shareButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  shareButtonText: {
    marginLeft: 12,
    flex: 1,
  },
  shareButtonTitle: {
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Inder",
    marginBottom: 2,
  },
  shareButtonDesc: {
    fontSize: 12,
    fontWeight: "500",
    opacity: 0.9,
  },
  shareButtonLoading: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 16,
  },

  // No Path Fallback Styles
  noPathFallback: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: [{ translateX: -75 }, { translateY: -75 }],
    alignItems: "center",
    justifyContent: "center",
    width: 150,
    height: 150,
  },
  noPathText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    marginTop: 12,
    fontFamily: "Inder",
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  noPathSubtext: {
    fontSize: 14,
    fontWeight: "500",
    color: "#FFFFFF",
    textAlign: "center",
    marginTop: 4,
    opacity: 0.8,
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
});
