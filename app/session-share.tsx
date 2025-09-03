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
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import { captureRef } from "react-native-view-shot";
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

  // Ref for capturing map view
  const mapViewRef = useRef<View>(null);
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

  // Load session data on component mount
  useEffect(() => {
    if (sessionId && !session && !isInitialized) {
      setIsInitialized(true);
      loadSessionData();
    } else if (!sessionId) {
      setLoading(false);
    }
  }, [sessionId]);

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

    // Validate required session data
    if (!sessionId || !session) {
      Alert.alert("Error", "Missing session information. Please try again.");
      return;
    }

    try {
      setIsSharing(true);

      // Add delay to show loading state
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Prepare session data with validation using session object
      const sessionData = {
        horse_name: session.horseName || "Unknown Horse",
        duration: session.duration
          ? formatDuration(session.duration)
          : "Unknown",
        distance: session.distance
          ? `${(session.distance / 1000).toFixed(1)} km`
          : "Unknown",
        avg_speed: session.averageSpeed
          ? `${(session.averageSpeed * 3.6).toFixed(1)} km/h`
          : "Unknown",
        session_id: sessionId,
      };

      // Get selected media item (single selection)
      const selectedMediaItem = selectedMedia
        ? mediaItems.find((item) => item.id === selectedMedia)
        : null;

      // Use the best available image for the post
      // NOTE: We should NOT mix uploaded session images with horse profile images
      // - image_base64: Only for uploaded session photos
      // - image_url: Only for horse profile pictures
      let imageBase64: string | undefined;

      // Convert selected image to base64 if available (uploaded session photo)
      if (selectedMediaItem?.uri) {
        try {
          // Converting selected image to base64
          imageBase64 = await convertImageToBase64(selectedMediaItem.uri);
          // Image converted to base64 successfully
        } catch (error) {
          console.error(
            "❌ [SessionShare] Failed to convert image to base64:",
            error
          );
          // Continue without base64 if conversion fails
        }
      }

      // Store selected media info in session_data for future use
      const mediaInfo = selectedMediaItem
        ? {
            selected_media_id: selectedMediaItem.id,
            selected_media_type: selectedMediaItem.type,
            has_base64: !!imageBase64,
          }
        : {};

      console.log("Creating post with data:", {
        sessionData,
        hasSelectedMedia: !!selectedMediaItem,
        hasBase64: !!imageBase64,
        horseImageUrl: !!horse?.image_url, // Log boolean instead of full URL
        mediaInfo,
        contentLength: postText.trim().length, // Log length instead of full content
      });

      // Create post in database with separated image logic:
      // - image_url: ONLY horse profile picture (never uploaded session images)
      // - image_base64: ONLY uploaded session photos
      const result = await CommunityAPI.createPost(user.id, {
        content: postText.trim(),
        image_url: horse?.image_url || undefined, // ONLY horse profile picture
        image_base64: imageBase64, // ONLY uploaded session photo
        session_data: {
          ...sessionData,
          ...mediaInfo, // Include media info in session data
          horse_image_url: horse?.image_url || undefined, // Add horse image URL
        },
      });

      // Post creation completed - check for errors

      const { post, error } = result;

      if (error) {
        console.error("Post creation failed:", error);
        Alert.alert("Error", error);
        return;
      }

      if (!post) {
        console.error("Post creation returned no post");
        Alert.alert("Error", "Failed to create post. Please try again.");
        return;
      }

      Alert.alert(
        "Success! 🎉",
        "Your training session has been shared to the community feed!",
        [
          {
            text: "View in Community",
            onPress: () => {
              router.push("/(tabs)/community");
            },
          },
          {
            text: "OK",
            onPress: () => {
              router.back();
            },
          },
        ]
      );
    } catch (error) {
      console.error("Error sharing session:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      Alert.alert("Error", `Failed to share your session: ${errorMessage}`);
    } finally {
      setIsSharing(false);
    }
  };

  const shareToInstagramStory = async () => {
    try {
      setIsSharing(true);

      // Check if Instagram is available for sharing
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert("Error", "Sharing is not available on this device.");
        return;
      }

      // Check if we have session data
      if (!session) {
        Alert.alert("Error", "Session data not available for sharing.");
        return;
      }

      console.log("Creating map view for Instagram sharing...");

      // Check if map view ref is available
      if (!mapViewRef.current) {
        Alert.alert(
          "Error",
          "Map view not ready. Please try again in a moment."
        );
        return;
      }

      // Wait a moment for the view to be fully rendered
      await new Promise((resolve) => setTimeout(resolve, 1000));

      try {
        console.log("Attempting to capture map view...");

        // Capture the map view as an image with explicit options
        const imageUri = await captureRef(mapViewRef.current, {
          format: "jpg",
          quality: 0.9,
          result: "tmpfile",
          height: width, // Square aspect ratio
          width: width,
        });

        console.log("Map view captured successfully:", imageUri);

        // Share the captured image
        await Sharing.shareAsync(imageUri, {
          mimeType: "image/jpeg",
          dialogTitle: "Share to Instagram Story",
          UTI: "public.jpeg",
        });

        // Show success message with copyable stats
        const sessionStats =
          `🐴 ${session?.horseName || "Training Session"}\n` +
          `⏱️ ${
            session?.duration ? formatDuration(session.duration) : "Unknown"
          }\n` +
          `📍 ${
            session?.distance
              ? `${(session.distance / 1000).toFixed(1)} km`
              : "Unknown"
          }\n` +
          `🏃 ${
            session?.averageSpeed
              ? `${(session.averageSpeed * 3.6).toFixed(1)} km/h`
              : "Unknown"
          }`;

        Alert.alert(
          "Shared Successfully! 📱",
          `Map shared to Instagram! You can copy these stats to add to your story:\n\n${sessionStats}`,
          [{ text: "OK", style: "default" }]
        );

        // Clean up the temporary file
        try {
          await FileSystem.deleteAsync(imageUri, { idempotent: true });
          console.log("Temporary map image cleaned up");
        } catch (cleanupError) {
          console.warn("Failed to clean up temporary map file:", cleanupError);
        }
      } catch (captureError) {
        console.error("Error capturing map view:", captureError);

        // Provide more specific error message
        const errorMessage =
          captureError instanceof Error
            ? captureError.message
            : "Unknown error";

        if (
          errorMessage.includes("reactTag") ||
          errorMessage.includes("No view found")
        ) {
          Alert.alert(
            "Capture Failed",
            "The map view is not ready for capture. Please scroll down to see the map preview, then try again."
          );
        } else {
          Alert.alert(
            "Capture Failed",
            "Failed to create map image. Please try again."
          );
        }
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
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
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
            style={[
              styles.backButton,
              { backgroundColor: "rgba(255, 255, 255, 0.1)", borderRadius: 25 },
            ]}
            disabled={isSharing}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.header}>Share Session</Text>
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
        contentContainerStyle={styles.scrollContent}
      >
        {/* Session Stats Cards */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={styles.statIconContainer}>
              <Ionicons name="time-outline" size={24} color="#007AFF" />
            </View>
            <Text style={styles.statValue}>
              {session.duration ? formatDuration(session.duration) : "Unknown"}
            </Text>
            <Text style={styles.statLabel}>Duration</Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statIconContainer}>
              <Ionicons name="navigate-outline" size={24} color="#007AFF" />
            </View>
            <Text style={styles.statValue}>
              {session.distance ? formatDistance(session.distance) : "Unknown"}
            </Text>
            <Text style={styles.statLabel}>Distance</Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statIconContainer}>
              <Ionicons name="speedometer-outline" size={24} color="#007AFF" />
            </View>
            <Text style={styles.statValue}>
              {session.averageSpeed
                ? formatSpeed(session.averageSpeed)
                : "Unknown"}
            </Text>
            <Text style={styles.statLabel}>Avg Speed</Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statIconContainer}>
              <Ionicons name="person-outline" size={24} color="#007AFF" />
            </View>
            <Text style={styles.statValue}>{session.horseName}</Text>
            <Text style={styles.statLabel}>Horse</Text>
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
            <View style={styles.postIconContainer}>
              <Ionicons name="create-outline" size={24} color="#007AFF" />
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
              setPostText(text);
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
              {postText.length}/500
            </Text>
          </View>
        </View>

        {/* Media Gallery - Enhanced styling */}
        {mediaItems.length > 0 && (
          <View
            style={[
              styles.mediaCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Session Media ({mediaItems.length})
            </Text>
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
                  color={theme.accent}
                />
                <Text
                  style={[styles.selectedCountText, { color: theme.accent }]}
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

        {/* Map View for Instagram Story Capture */}
        <View style={styles.mapContainer}>
          <View style={styles.mapTitleContainer}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Instagram Story Preview
            </Text>
            {mapReady && (
              <View
                style={[
                  styles.readyIndicator,
                  { backgroundColor: theme.success },
                ]}
              >
                <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
                <Text style={[styles.readyText, { color: "#FFFFFF" }]}>
                  Ready
                </Text>
              </View>
            )}
          </View>
          <View
            ref={mapViewRef}
            style={styles.instagramMapView}
            collapsable={false}
            renderToHardwareTextureAndroid={true}
          >
            {/* Map Background */}
            {session?.path && session.path.length > 0 ? (
              <MapView
                style={styles.mapBackground}
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
                showsBuildings={false}
                showsTraffic={false}
                showsIndoors={false}
                showsPointsOfInterest={false}
                loadingEnabled={false}
                onMapReady={() => {
                  console.log("Map is ready for capture");
                  setMapReady(true);
                }}
                onLayout={() => {
                  console.log("Map layout complete");
                }}
              >
                {/* Route Polyline */}
                <Polyline
                  coordinates={session.path.map((point: TrackingPoint) => ({
                    latitude: point.latitude,
                    longitude: point.longitude,
                  }))}
                  strokeColor="#FFD700"
                  strokeWidth={4}
                  lineJoin="round"
                  lineCap="round"
                />

                {/* Start Point Marker */}
                {session.path.length > 0 && (
                  <Marker
                    coordinate={{
                      latitude: session.path[0].latitude,
                      longitude: session.path[0].longitude,
                    }}
                    anchor={{ x: 0.5, y: 0.5 }}
                  >
                    <View style={styles.startMarker}>
                      <Ionicons name="play-circle" size={24} color="#00C851" />
                    </View>
                  </Marker>
                )}

                {/* End Point Marker */}
                {session.path.length > 1 && (
                  <Marker
                    coordinate={{
                      latitude: session.path[session.path.length - 1].latitude,
                      longitude:
                        session.path[session.path.length - 1].longitude,
                    }}
                    anchor={{ x: 0.5, y: 0.5 }}
                  >
                    <View style={styles.endMarker}>
                      <Ionicons
                        name="checkmark-circle"
                        size={24}
                        color="#FF4444"
                      />
                    </View>
                  </Marker>
                )}
              </MapView>
            ) : (
              <View
                style={[styles.mapBackground, styles.fallbackBackground]}
                onLayout={() => {
                  console.log("Placeholder view layout complete");
                  setMapReady(true);
                }}
              >
                {/* Gradient-like background using overlapping colored views */}
                <View
                  style={[
                    styles.gradientLayer,
                    { backgroundColor: theme.primary + "40" },
                  ]}
                />
                <View
                  style={[
                    styles.gradientLayer,
                    { backgroundColor: theme.accent + "20" },
                  ]}
                />

                {/* Central content */}
                <View style={styles.fallbackContent}>
                  <View
                    style={[
                      styles.iconContainer,
                      { backgroundColor: theme.accent + "20" },
                    ]}
                  >
                    <Ionicons name="location" size={60} color={theme.accent} />
                  </View>
                  <Text style={[styles.fallbackTitle, { color: theme.accent }]}>
                    Training Session
                  </Text>
                  <Text
                    style={[
                      styles.fallbackSubtitle,
                      { color: theme.textSecondary },
                    ]}
                  >
                    Session completed without GPS tracking
                  </Text>
                </View>
              </View>
            )}

            {/* Overlay with Session Stats */}
            <View style={styles.mapOverlay}>
              {/* Top Left - App Branding */}
              <View style={styles.mapTopLeft}>
                <View style={styles.mapBrandingContainer}>
                  <Text style={styles.mapBrandText}>EquiHub</Text>
                </View>
              </View>

              {/* Top Right - Horse Info */}
              <View style={styles.mapTopRight}>
                <View style={styles.mapHorseContainer}>
                  <Image
                    source={
                      horse?.image_url
                        ? { uri: horse.image_url }
                        : require("../assets/images/horses/pony.jpg")
                    }
                    style={styles.mapHorseImage}
                  />
                  <Text style={styles.mapHorseName}>{session.horseName}</Text>
                </View>
              </View>

              {/* Center - Training Session Text */}
              <View style={styles.mapCenter}>
                <Text style={styles.mapSubtitle}>Training Session</Text>
              </View>

              {/* Bottom - Stats Container */}
              <View style={styles.mapBottom}>
                <View style={styles.mapStatsContainer}>
                  <View style={styles.mapStats}>
                    <View style={styles.mapStatItem}>
                      <Ionicons name="time" size={20} color="#FFFFFF" />
                      <Text style={styles.mapStatLabel}>Duration</Text>
                      <Text style={styles.mapStatValue}>
                        {session.duration
                          ? formatDuration(session.duration)
                          : "Unknown"}
                      </Text>
                    </View>

                    <View style={styles.mapStatItem}>
                      <Ionicons name="location" size={20} color="#FFFFFF" />
                      <Text style={styles.mapStatLabel}>Distance</Text>
                      <Text style={styles.mapStatValue}>
                        {session.distance
                          ? formatDistance(session.distance)
                          : "Unknown"}
                      </Text>
                    </View>

                    <View style={styles.mapStatItem}>
                      <Ionicons name="speedometer" size={20} color="#FFFFFF" />
                      <Text style={styles.mapStatLabel}>Avg Speed</Text>
                      <Text style={styles.mapStatValue}>
                        {session.averageSpeed
                          ? formatSpeed(session.averageSpeed)
                          : "Unknown"}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Share Buttons */}
      <View
        style={[
          styles.bottomButtonsContainer,
          { backgroundColor: theme.surface, borderTopColor: theme.border },
        ]}
      >
        <TouchableOpacity
          onPress={shareToInstagramStory}
          style={[
            styles.instagramButton,
            { backgroundColor: "#E1306C" },
            isSharing && styles.disabledButton,
          ]}
          disabled={isSharing}
        >
          {isSharing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="logo-instagram" size={20} color="#FFFFFF" />
              <Text style={styles.instagramButtonText}>Share Map View</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={sharePost}
          style={[
            styles.communityButton,
            { backgroundColor: theme.accent },
            isSharing && styles.disabledButton,
          ]}
          disabled={isSharing}
        >
          {isSharing ? (
            <ActivityIndicator size="small" color={theme.background} />
          ) : (
            <>
              <Ionicons name="people" size={20} color={theme.background} />
              <Text
                style={[
                  styles.communityButtonText,
                  { color: theme.background },
                ]}
              >
                Share to Community
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Full Screen Loading Overlay */}
      {(() => {
        if (isSharing) {
          return (
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
                  Sharing to Community...
                </Text>
              </View>
            </View>
          );
        }
        return null;
      })()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    backgroundColor: "#335C67",
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
    color: "#FFFFFF",
    flex: 1,
    textAlign: "center",
  },
  backButton: {
    padding: 8,
    zIndex: 1,
  },
  viewPort: {
    flex: 1,
    borderTopLeftRadius: 50,
    borderTopRightRadius: 50,
    marginTop: 5,
    paddingTop: 20,
    paddingHorizontal: 16,
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
    backgroundColor: "#F8F9FA",
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
    paddingVertical: 12,
    gap: 12,
    borderTopWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
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
  mapHorseContainer: {
    backgroundColor: "rgba(128, 128, 128, 0.5)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
    minWidth: 80,
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
    paddingHorizontal: 100, // Add padding to avoid overlap with top corners
  },
  mapBottom: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 16,
  },
  mapStatsContainer: {
    backgroundColor: "rgba(128, 128, 128, 0.5)",
    borderRadius: 12,
    padding: 16,
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
  // Start and End Marker Styles
  startMarker: {
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 20,
    padding: 4,
    borderWidth: 2,
    borderColor: "#00C851",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  endMarker: {
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 20,
    padding: 4,
    borderWidth: 2,
    borderColor: "#FF4444",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
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
    backgroundColor: "#FFFFFF",
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
    borderColor: "rgba(0, 0, 0, 0.05)",
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0, 122, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1a1a1a",
    textAlign: "center",
    marginBottom: 4,
    fontFamily: "Inder",
  },
  statLabel: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
    fontWeight: "500",
  },
  // Post Content Card Styles
  postContentCard: {
    backgroundColor: "#FFFFFF",
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
    borderColor: "rgba(0, 0, 0, 0.05)",
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
    backgroundColor: "rgba(0, 122, 255, 0.1)",
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
});
