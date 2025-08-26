import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
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
import { useAuth } from "../contexts/AuthContext";
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

  // Add initialization guard to prevent multiple renders
  const [isInitialized, setIsInitialized] = useState(false);

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

  // Show loading screen while session data is being loaded
  if (loading) {
    return (
      <View style={[styles.container, styles.loadingScreen]}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={styles.loadingScreenText}>Loading session data...</Text>
      </View>
    );
  }

  // Show error screen if session not found
  if (!session) {
    return (
      <View style={[styles.container, styles.loadingScreen]}>
        <Text style={styles.errorText}>Session not found</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backToSessionButton}
        >
          <Text style={styles.backToSessionButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            router.back();
          }}
          style={styles.backButton}
          disabled={isSharing}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Share Session</Text>
        <TouchableOpacity
          onPress={() => {
            sharePost();
          }}
          style={[styles.shareButton, isSharing && styles.disabledButton]}
          disabled={isSharing}
        >
          {isSharing ? (
            <ActivityIndicator size="small" color="#000000" />
          ) : (
            <Text style={styles.shareButtonText}>Share</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={[styles.content, isSharing && styles.disabledContent]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!isSharing}
      >
        {/* Session Summary */}
        <View style={styles.sessionSummary}>
          <View style={styles.summaryRow}>
            <Ionicons name="person" size={16} color="#335C67" />
            <Text style={styles.summaryText}>{session.horseName}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Ionicons name="time" size={16} color="#335C67" />
            <Text style={styles.summaryText}>
              {session.duration ? formatDuration(session.duration) : "Unknown"}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Ionicons name="location" size={16} color="#335C67" />
            <Text style={styles.summaryText}>
              {session.distance
                ? `${(session.distance / 1000).toFixed(1)} km`
                : "Unknown"}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Ionicons name="speedometer" size={16} color="#335C67" />
            <Text style={styles.summaryText}>
              {session.averageSpeed
                ? `${(session.averageSpeed * 3.6).toFixed(1)} km/h`
                : "Unknown"}
            </Text>
          </View>
        </View>

        {/* Text Input */}
        <View style={styles.textInputContainer}>
          <Text style={styles.sectionTitle}>Post Content</Text>
          <TextInput
            style={styles.textInput}
            value={postText}
            onChangeText={(text) => {
              setPostText(text);
            }}
            placeholder="Share your thoughts about this training session..."
            placeholderTextColor="#6C757D"
            multiline
            numberOfLines={4}
            maxLength={500}
            editable={!isSharing}
          />
          <Text style={styles.characterCount}>{postText.length}/500</Text>
        </View>

        {/* Media Gallery - Enhanced styling */}
        {mediaItems.length > 0 && (
          <View style={styles.mediaCard}>
            <Text style={styles.sectionTitle}>
              Session Media ({mediaItems.length})
            </Text>
            {selectedMedia && (
              <View style={styles.selectedCountContainer}>
                <Ionicons name="checkmark-circle" size={16} color="#FFD700" />
                <Text style={styles.selectedCountText}>1 photo selected</Text>
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
                        selectedMedia === item.id && styles.selectedIndicator,
                      ]}
                    >
                      {selectedMedia === item.id ? (
                        <Ionicons name="checkmark" size={16} color="#000000" />
                      ) : (
                        <View style={styles.unselectedCircle} />
                      )}
                    </View>

                    {/* Selected Overlay */}
                    {selectedMedia === item.id && (
                      <View style={styles.selectedOverlayNew} />
                    )}
                  </View>

                  {/* Timestamp */}
                  <Text style={styles.mediaTimeNew}>
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
              <View style={styles.selectionHint}>
                <Ionicons name="information-circle" size={16} color="#6C757D" />
                <Text style={styles.hintText}>
                  Tap a photo to include it in your post (photos only)
                </Text>
              </View>
            )}
            {selectedMedia && (
              <View style={styles.selectionHint}>
                <Ionicons name="image" size={16} color="#28A745" />
                <Text style={styles.hintText}>
                  This photo will be shown as the main image in your post
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Horse Image Preview */}
        <View style={styles.horseImageSection}>
          <Text style={styles.sectionTitle}>Horse Image</Text>
          {horse?.image_url ? (
            <Image
              source={{ uri: horse.image_url }}
              style={styles.horseImage}
            />
          ) : (
            <Image
              source={require("../assets/images/horses/pony.jpg")}
              style={styles.horseImage}
            />
          )}
        </View>
      </ScrollView>

      {/* Full Screen Loading Overlay */}
      {(() => {
        if (isSharing) {
          return (
            <View style={styles.loadingOverlay}>
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FFD700" />
                <Text style={styles.loadingText}>Sharing to Community...</Text>
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
    backgroundColor: "#335C67",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 50,
    backgroundColor: "#335C67",
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: "Inder",
    fontWeight: "600",
    color: "#FFFFFF",
  },
  shareButton: {
    backgroundColor: "#FFD700",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 60,
    alignItems: "center",
  },
  disabledButton: {
    opacity: 0.6,
  },
  shareButtonText: {
    color: "#000000",
    fontWeight: "600",
    fontSize: 14,
  },
  content: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 50,
    borderTopRightRadius: 50,
    paddingTop: 20,
    paddingHorizontal: 16,
  },
  disabledContent: {
    opacity: 0.6,
  },
  sessionSummary: {
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E9ECEF",
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  summaryText: {
    color: "#335C67",
    fontSize: 14,
    marginLeft: 8,
    fontWeight: "500",
  },
  textInputContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: "#335C67",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
    fontFamily: "Inder",
  },
  textInput: {
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    padding: 16,
    color: "#335C67",
    fontSize: 16,
    textAlignVertical: "top",
    minHeight: 100,
    borderWidth: 1,
    borderColor: "#E9ECEF",
  },
  characterCount: {
    color: "#6C757D",
    fontSize: 12,
    textAlign: "right",
    marginTop: 4,
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
  horseImageSection: {
    marginBottom: 20,
  },
  horseImage: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    backgroundColor: "#F8F9FA",
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  loadingContainer: {
    backgroundColor: "#FFFFFF",
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
    color: "#335C67",
    textAlign: "center",
  },
  loadingScreen: {
    justifyContent: "center",
    alignItems: "center",
  },
  loadingScreenText: {
    marginTop: 15,
    fontSize: 16,
    fontWeight: "500",
    color: "#FFFFFF",
    textAlign: "center",
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

  // Enhanced Media Gallery Styles
  mediaCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  selectedCountContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF9E6",
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
    color: "#B8860B",
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
    backgroundColor: "#FFD700",
    borderColor: "#FFD700",
  },
  unselectedCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#6C757D",
    backgroundColor: "transparent",
  },
  selectedOverlayNew: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 215, 0, 0.2)",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#FFD700",
  },
  mediaTimeNew: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "500",
    color: "#6C757D",
    textAlign: "center",
    backgroundColor: "#F8F9FA",
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
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
  },
  hintText: {
    marginLeft: 6,
    fontSize: 13,
    color: "#6C757D",
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
    color: "#6C757D",
  },
});
