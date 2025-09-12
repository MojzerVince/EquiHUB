import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as MediaLibrary from "expo-media-library";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import * as TaskManager from "expo-task-manager";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, {
  Marker,
  PROVIDER_GOOGLE,
  Polyline,
  Region,
} from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import { useDialog } from "../../contexts/DialogContext";
import { useMetric } from "../../contexts/MetricContext";
import { useTheme } from "../../contexts/ThemeContext";
import { ChallengeStorageService } from "../../lib/challengeStorage";
import {
  FallDetectionAPI,
  FallDetectionConfig,
  FallEvent,
} from "../../lib/fallDetectionAPI";
import { HorseAPI } from "../../lib/horseAPI";
import { ProfileAPIBase64 } from "../../lib/profileAPIBase64";
import { StableChallengeAPI } from "../../lib/stableChallengeAPI";
import { Horse, Profile } from "../../lib/supabase";
import { ChallengeSession } from "../../types/challengeTypes";

// Types for tracking sessions
interface TrackingPoint {
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy?: number;
  speed?: number;
}

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

interface GaitSegment {
  gait: "walk" | "trot" | "canter" | "gallop" | "halt";
  startTime: number;
  endTime: number;
  duration: number; // in seconds
  distance: number; // in meters
  averageSpeed: number; // in m/s
  startIndex: number; // index in path array
  endIndex: number; // index in path array
}

interface GaitAnalysis {
  totalDuration: number;
  gaitDurations: {
    walk: number;
    trot: number;
    canter: number;
    gallop: number;
    halt: number;
  };
  gaitPercentages: {
    walk: number;
    trot: number;
    canter: number;
    gallop: number;
    halt: number;
  };
  segments: GaitSegment[];
  transitionCount: number;
  predominantGait: "walk" | "trot" | "canter" | "gallop" | "halt";
}

interface TrainingSession {
  id: string;
  userId: string;
  horseId: string;
  horseName: string;
  trainingType: string;
  startTime: number;
  endTime?: number;
  duration?: number; // in seconds
  distance?: number; // in meters
  path: TrackingPoint[];
  averageSpeed?: number; // in m/s
  maxSpeed?: number; // in m/s
  media?: MediaItem[]; // Photos and videos taken during session
  gaitAnalysis?: GaitAnalysis; // Horse gait analysis
}

interface PublishedTrail {
  id: string;
  name: string;
  description?: string;
  userId: string;
  userName: string;
  path: TrackingPoint[];
  difficulty: "easy" | "moderate" | "difficult";
  distance: number; // in meters
  duration: number; // in seconds
  trainingType: string;
  rating: number; // 1-5 stars
  reviewsCount: number;
  isPublic: boolean;
  createdAt: number;
}

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Background location tracking task
const LOCATION_TASK_NAME = "background-location-task";
const TRACKING_NOTIFICATION_IDENTIFIER = "gps-tracking-notification";

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error("Background location task error:", error);
    return;
  }
  if (data) {
    const { locations } = data as any;

    // Check if tracking is currently active before processing locations
    try {
      const trackingStatus = await AsyncStorage.getItem("is_tracking_active");
      const isTrackingActive = trackingStatus === "true";
      
      if (!isTrackingActive) {
        console.log("🚫 Tracking not active - skipping background location processing");
        return;
      }
    } catch (error) {
      console.error("Error checking tracking status:", error);
      // If we can't check status, don't process to be safe
      return;
    }

    // Process all location updates, not just the first one
    if (locations && locations.length > 0) {
      console.log(`🔄 Processing ${locations.length} background location(s) - tracking is active`);

      const trackingPoints = locations.map((location: any, index: number) => ({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        timestamp: location.timestamp || Date.now() + index, // Use actual timestamp when available
        accuracy: location.coords.accuracy,
        speed: location.coords.speed || 0,
        altitude: location.coords.altitude,
        heading: location.coords.heading,
      }));

      try {
        // Get existing points
        const existingData = await AsyncStorage.getItem(
          "current_tracking_points"
        );
        const existingPoints = existingData ? JSON.parse(existingData) : [];

        // Enhanced filtering for GPS drift and accuracy
        const filteredPoints = [];
        
        for (const point of trackingPoints) {
          // Filter by accuracy first (reject points with accuracy > 30m)
          if (point.accuracy && point.accuracy > 30) {
            continue; // Skip this point due to poor accuracy
          }
          
          // Check movement threshold against last existing point
          if (existingPoints.length > 0) {
            const lastPoint = existingPoints[existingPoints.length - 1];
            const timeDiff = point.timestamp - lastPoint.timestamp;
            
            // Calculate distance from last point using Haversine formula
            const R = 6371e3; // Earth's radius in meters
            const φ1 = (lastPoint.latitude * Math.PI) / 180;
            const φ2 = (point.latitude * Math.PI) / 180;
            const Δφ = ((point.latitude - lastPoint.latitude) * Math.PI) / 180;
            const Δλ = ((point.longitude - lastPoint.longitude) * Math.PI) / 180;
            
            const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                      Math.cos(φ1) * Math.cos(φ2) * 
                      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            const distance = R * c; // Distance in meters
            
            // Enhanced movement threshold based on accuracy
            const accuracyThreshold = Math.max(
              3, // Minimum 3m threshold
              (point.accuracy || 10) * 0.5 // Use half of GPS accuracy as threshold
            );
            
            // Speed-based threshold adjustment
            const speedBasedThreshold = (point.speed && point.speed > 1.5) ? 
              Math.max(2, accuracyThreshold * 0.7) : accuracyThreshold;
            
            // Require significant time AND movement to reduce GPS drift
            if (timeDiff >= 3000 || (timeDiff >= 2000 && distance >= speedBasedThreshold)) {
              filteredPoints.push(point);
            }
            // Skip point if it's too close or too recent (likely GPS drift)
          } else {
            // First point, always add it
            filteredPoints.push(point);
          }
        }

        if (filteredPoints.length > 0) {
          // Add filtered points
          const updatedPoints = [...existingPoints, ...filteredPoints];

          // Limit stored points to prevent memory issues (keep last 2000 points for longer rides)
          const limitedPoints = updatedPoints.slice(-2000);

          await AsyncStorage.setItem(
            "current_tracking_points",
            JSON.stringify(limitedPoints)
          );

          console.log(
            `📊 Background locations saved: ${filteredPoints.length}/${trackingPoints.length} (after GPS drift filtering), total: ${limitedPoints.length}`
          );

          // Update last known location timestamp for debugging
          await AsyncStorage.setItem(
            "last_background_update",
            Date.now().toString()
          );
        } else {
          console.log(
            "⚠️ All background locations filtered out due to GPS drift or poor accuracy"
          );
        }
      } catch (error) {
        console.error("Error saving background location:", error);
      }
    }
  }
});

const MapScreen = () => {
  const { currentTheme } = useTheme();
  const { formatDistance, formatSpeed } = useMetric();
  const { showError, showDialog } = useDialog();
  const { user } = useAuth();
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [region, setRegion] = useState<Region>({
    latitude: 0, // Start at center of world map
    longitude: 0,
    latitudeDelta: 180, // Wide view to show the world
    longitudeDelta: 180,
  });
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [locationPermission, setLocationPermission] = useState<boolean | null>(
    null
  );
  const [mapType, setMapType] = useState<"standard" | "satellite">("standard");
  const [gpsStrength, setGpsStrength] = useState<number>(0); // 0-5 scale
  const [selectedHorse, setSelectedHorse] = useState<string>("");
  const [selectedTrainingType, setSelectedTrainingType] = useState<string>("");
  const [userHorses, setUserHorses] = useState<Horse[]>([]);
  const [horsesLoading, setHorsesLoading] = useState<boolean>(false);
  const [lastHorsesRefreshTimestamp, setLastHorsesRefreshTimestamp] =
    useState<string>("");
  const [favoriteTrainingTypes, setFavoriteTrainingTypes] = useState<string[]>(
    []
  );
  const [trainingDropdownVisible, setTrainingDropdownVisible] =
    useState<boolean>(false);

  // Tracking state
  const [isTracking, setIsTracking] = useState<boolean>(false);
  const [currentSession, setCurrentSession] = useState<TrainingSession | null>(
    null
  );
  const [trackingPoints, setTrackingPoints] = useState<TrackingPoint[]>([]);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  const [highAccuracyMode, setHighAccuracyMode] = useState<boolean>(false);
  const [showBatteryInfoModal, setShowBatteryInfoModal] =
    useState<boolean>(false);

  // Media capture state
  const [sessionMedia, setSessionMedia] = useState<MediaItem[]>([]);
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(
    null
  );
  const [mediaLibraryPermission, setMediaLibraryPermission] = useState<
    boolean | null
  >(null);

  // Notification state
  const [notificationId, setNotificationId] = useState<string | null>(null);
  const notificationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );

  // Published trails state
  const [showPublishedTrails, setShowPublishedTrails] =
    useState<boolean>(false);
  const [publishedTrails, setPublishedTrails] = useState<PublishedTrail[]>([]);
  const [trailsLoading, setTrailsLoading] = useState<boolean>(false);

  // Real-time gait detection state
  const [currentGait, setCurrentGait] = useState<
    "walk" | "trot" | "canter" | "gallop" | "halt"
  >("halt");

  // Real-time gait segments for path coloring
  const [realTimeGaitSegments, setRealTimeGaitSegments] = useState<
    Array<{
      coordinates: Array<{ latitude: number; longitude: number }>;
      color: string;
      gait: string;
    }>
  >([]);

  // App state tracking for coordinating foreground/background location
  const [appState, setAppState] = useState(AppState.currentState);
  const [isUsingBackgroundLocation, setIsUsingBackgroundLocation] =
    useState(false);

  // Fall detection state
  const [fallDetectionEnabled, setFallDetectionEnabled] = useState(false);
  const [fallDetectionConfig, setFallDetectionConfig] =
    useState<FallDetectionConfig>({
      accelerationThreshold: 5.0, // Increased from 3.0 to reduce false positives when dismounting
      highSpeedThreshold: 20.0, // Increased from 15.0g for high-speed impacts
      lowSpeedThreshold: 8.0, // Increased from 5.0g for low-speed impacts
      speedDetectionThreshold: 5.0, // Increased from 3.0 m/s to determine high vs low speed
      gyroscopeThreshold: 5.0, // Increased from 3.0 to 5.0 for less sensitivity to normal movement
      impactDuration: 800, // Increased from 500 to 800ms for more reliable detection
      recoveryTimeout: 20000, // Keep at 20000ms (20 seconds)
      isEnabled: true,
    });
  const [recentFallEvents, setRecentFallEvents] = useState<FallEvent[]>([]);
  const [showFallDetectionModal, setShowFallDetectionModal] = useState(false);
  const [showFallDetectionDisclaimer, setShowFallDetectionDisclaimer] =
    useState(false);
  const [fallDisclaimerAccepted, setFallDisclaimerAccepted] = useState(false);
  const [pendingFallConfirmation, setPendingFallConfirmation] = useState<{
    event: FallEvent;
    timestamp: number;
  } | null>(null);
  const fallConfirmationTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  const trackingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );
  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(
    null
  );

  // Load user profile
  const loadUserProfile = async () => {
    if (user?.id) {
      try {
        const profile = await ProfileAPIBase64.getProfile(user.id);
        setUserProfile(profile);
      } catch (error) {
        console.error("Error loading user profile:", error);
      }
    }
  };

  useEffect(() => {
    requestLocationPermission();
    // Start watching for location immediately when component mounts
    startLocationWatcher();
    // Request camera and media library permissions
    requestCameraPermissions();
    // Initialize fall detection
    initializeFallDetection();
    // Load user profile
    loadUserProfile();
    // Load fall detection disclaimer acceptance status
    loadFallDisclaimerStatus();
    // Initialize tracking status as inactive
    initializeTrackingStatus();
  }, []);

  // Load fall detection disclaimer acceptance status
  const loadFallDisclaimerStatus = async () => {
    try {
      const accepted = await AsyncStorage.getItem("fall_disclaimer_accepted");
      setFallDisclaimerAccepted(accepted === "true");
    } catch (error) {
      console.error("Error loading fall disclaimer status:", error);
    }
  };

  // Initialize tracking status in AsyncStorage
  const initializeTrackingStatus = async () => {
    try {
      // Set initial tracking status to false (inactive) unless already set
      const currentStatus = await AsyncStorage.getItem("is_tracking_active");
      if (currentStatus === null) {
        await AsyncStorage.setItem("is_tracking_active", "false");
        console.log("🔄 Initialized tracking status as inactive");
      } else {
        console.log(`🔄 Current tracking status: ${currentStatus}`);
      }
    } catch (error) {
      console.error("Error initializing tracking status:", error);
    }
  };

  // Save fall detection disclaimer acceptance
  const saveFallDisclaimerAcceptance = async () => {
    try {
      await AsyncStorage.setItem("fall_disclaimer_accepted", "true");
      setFallDisclaimerAccepted(true);
      setFallDetectionEnabled(true);
      setShowFallDetectionDisclaimer(false);
    } catch (error) {
      console.error("Error saving fall disclaimer acceptance:", error);
      // Still proceed with enabling fall detection even if save fails
      setFallDetectionEnabled(true);
      setShowFallDetectionDisclaimer(false);
    }
  };

  // Utility function to reset disclaimer acceptance (for testing/debugging)
  // const resetFallDisclaimerAcceptance = async () => {
  //   try {
  //     await AsyncStorage.removeItem("fall_disclaimer_accepted");
  //     setFallDisclaimerAccepted(false);
  //     console.log("Fall disclaimer acceptance reset");
  //   } catch (error) {
  //     console.error("Error resetting fall disclaimer acceptance:", error);
  //   }
  // };

  // Cleanup fall confirmation timeout on unmount
  useEffect(() => {
    return () => {
      if (fallConfirmationTimeoutRef.current) {
        clearTimeout(fallConfirmationTimeoutRef.current);
        fallConfirmationTimeoutRef.current = null;
      }
    };
  }, []);

  // App state change handler for coordinating foreground/background location tracking
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: string) => {
      console.log(`🔄 App state changed from ${appState} to ${nextAppState}`);
      console.log(
        `📍 Current tracking state: isTracking=${isTracking}, backgroundMode=${isUsingBackgroundLocation}`
      );

      if (isTracking) {
        if (nextAppState === "background" && appState === "active") {
          console.log(
            "📱 App going to background - switching to background location tracking"
          );
          await switchToBackgroundLocation();
        } else if (nextAppState === "active" && appState === "background") {
          console.log(
            "📱 App coming to foreground - switching to foreground location tracking"
          );
          await switchToForegroundLocation();
        }
      } else {
        console.log("📍 Not tracking, skipping location mode switch");
      }

      setAppState(nextAppState as any);
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange
    );

    return () => {
      subscription?.remove();
    };
  }, [appState, isTracking]);

  // Fall detection effect - start/stop monitoring based on tracking state
  useEffect(() => {
    const handleFallDetection = async () => {
      console.log(
        `🔍 Fall Detection Effect - Tracking: ${isTracking}, Enabled: ${fallDetectionEnabled}, User: ${user?.id}`
      );

      if (isTracking && fallDetectionEnabled && user?.id) {
        console.log(
          "🔍 Starting fall detection monitoring (foreground + background)"
        );
        console.log("📊 Fall detection config:", fallDetectionConfig);

        const started = await FallDetectionAPI.startMonitoring(user.id, true); // Enable background
        if (!started) {
          console.warn(
            "⚠️ Failed to start fall detection - sensors not available"
          );
          showError("Fall detection failed to start - sensors not available");
        } else {
          console.log("✅ Fall detection monitoring started successfully");
        }
      } else if (fallDetectionEnabled && user?.id && !isTracking) {
        // Allow fall detection even when not tracking (for testing)
        console.log("🔍 Starting fall detection monitoring (testing mode)");
        console.log("📊 Fall detection config:", fallDetectionConfig);

        const started = await FallDetectionAPI.startMonitoring(user.id, false); // No background when not tracking
        if (!started) {
          console.warn(
            "⚠️ Failed to start fall detection - sensors not available"
          );
          showError("Fall detection failed to start - sensors not available");
        } else {
          console.log(
            "✅ Fall detection monitoring started successfully (testing mode)"
          );
        }
      } else {
        console.log("🔍 Stopping fall detection monitoring");
        await FallDetectionAPI.stopMonitoring(); // Now async to handle background cleanup
      }
    };

    handleFallDetection();

    return () => {
      // Cleanup fall detection when component unmounts
      FallDetectionAPI.stopMonitoring();
    };
  }, [isTracking, fallDetectionEnabled, user?.id, fallDetectionConfig]);

  // Background data sync effect - only when using background location
  useEffect(() => {
    let syncInterval: ReturnType<typeof setInterval> | null = null;

    if (isTracking && isUsingBackgroundLocation) {
      console.log("🔄 Starting background data sync timer");
      syncInterval = setInterval(
        async () => {
          await syncBackgroundData();
        },
        highAccuracyMode ? 500 : 2000
      ); // Sync every 500ms in high accuracy, 2s in normal
    }

    return () => {
      if (syncInterval) {
        clearInterval(syncInterval);
        console.log("⏹️ Stopped background data sync timer");
      }
    };
  }, [isTracking, isUsingBackgroundLocation, highAccuracyMode]);

  // Request camera, media library, and notification permissions
  const requestCameraPermissions = async () => {
    try {
      // Request camera permission
      const { status: cameraStatus } =
        await ImagePicker.requestCameraPermissionsAsync();
      setCameraPermission(cameraStatus === "granted");

      // Request media library permission
      const { status: mediaStatus } =
        await MediaLibrary.requestPermissionsAsync();
      setMediaLibraryPermission(mediaStatus === "granted");

      // Request notification permissions for fall detection alerts
      const { status: notificationStatus } =
        await Notifications.requestPermissionsAsync();
      if (notificationStatus !== "granted") {
        console.warn("Notification permissions not granted");
      } else {
        console.log("✅ Notification permissions granted");
      }
    } catch (error) {
      console.error("Error requesting permissions:", error);
      setCameraPermission(false);
      setMediaLibraryPermission(false);
    }
  };

  // Initialize fall detection system
  // Handle fall confirmation response
  const handleFallConfirmation = async (
    sendSMS: boolean,
    isTimeout: boolean = false
  ) => {
    try {
      // Clear timeout if it exists
      if (fallConfirmationTimeoutRef.current) {
        clearTimeout(fallConfirmationTimeoutRef.current);
        fallConfirmationTimeoutRef.current = null;
      }

      if (!pendingFallConfirmation) return;

      const { event: fallEvent } = pendingFallConfirmation;

      if (sendSMS) {
        console.log(
          isTimeout
            ? "⏰ Auto-sending SMS due to timeout"
            : "📱 Sending SMS per user confirmation"
        );

        // Add to recent events
        setRecentFallEvents((prev) => [fallEvent, ...prev.slice(0, 9)]);

        // Send alert using the new confirmed fall alert method
        if (user?.id) {
          await FallDetectionAPI.sendConfirmedFallAlert(
            user.id,
            fallEvent,
            userProfile?.name
          );

          // Send notification AFTER SMS is sent
          await Notifications.scheduleNotificationAsync({
            content: {
              title: "Emergency Alert Sent",
              body: `SMS sent to emergency contacts for fall at ${new Date(
                fallEvent.timestamp
              ).toLocaleTimeString()}`,
              sound: true,
            },
            trigger: null, // Send immediately
          });
        }

        Alert.alert(
          "Emergency Alert Sent",
          isTimeout
            ? "No response detected. Emergency contact has been notified automatically."
            : "Emergency contact has been notified.",
          [{ text: "OK" }]
        );
      } else {
        console.log("✅ User confirmed they are okay - no SMS sent");
        Alert.alert("Good to hear!", "No emergency alert will be sent.", [
          { text: "OK" },
        ]);
      }

      // Clear pending confirmation and reset fall detection state
      setPendingFallConfirmation(null);
      FallDetectionAPI.resetFallDetectionState();

      console.log("🔄 Fall detection state reset - ready for new detections");
    } catch (error) {
      console.error("❌ Error handling fall confirmation:", error);
      setPendingFallConfirmation(null);
      FallDetectionAPI.resetFallDetectionState();
    }
  };

  const initializeFallDetection = async () => {
    try {
      // Reset fall detection state on initialization
      FallDetectionAPI.resetFallDetectionState();

      // Load existing fall events (including background ones)
      const allFallEvents = await FallDetectionAPI.getAllFallEvents();
      setRecentFallEvents(allFallEvents.slice(0, 10)); // Keep last 10 events

      // Set up fall event listener
      const handleFallEvent = (fallEvent: FallEvent) => {
        console.log("🚨 Fall event detected:", fallEvent);

        // Prevent multiple fall confirmations
        if (pendingFallConfirmation) {
          console.log(
            "⚠️ Fall confirmation already pending, ignoring new event"
          );
          return;
        }

        // Set pending fall confirmation
        setPendingFallConfirmation({
          event: fallEvent,
          timestamp: Date.now(),
        });

        // Show confirmation dialog
        Alert.alert(
          "Fall Detected",
          `Are you okay? SMS will be sent to your emergency contact if you don't respond within 20 seconds.\n\nTime: ${new Date(
            fallEvent.timestamp
          ).toLocaleTimeString()}\nImpact: ${fallEvent.accelerationMagnitude.toFixed(
            1
          )}g`,
          [
            {
              text: "I'm Okay",
              onPress: () => handleFallConfirmation(false),
              style: "default",
            },
            {
              text: "I Fell - Send SMS",
              onPress: () => handleFallConfirmation(true),
              style: "destructive",
            },
          ],
          {
            cancelable: false, // User must choose an option
          }
        );

        // Set timeout to auto-send SMS if no response
        fallConfirmationTimeoutRef.current = setTimeout(() => {
          console.log("⏰ Fall confirmation timeout - auto-sending SMS");
          handleFallConfirmation(true, true); // true for auto-send due to timeout
        }, 20000); // 20 seconds
      };

      FallDetectionAPI.addFallEventListener(handleFallEvent);

      // Update configuration
      FallDetectionAPI.updateConfig(fallDetectionConfig);

      console.log("✅ Fall detection initialized");
    } catch (error) {
      console.error("❌ Error initializing fall detection:", error);
    }
  };

  // Update fall detection configuration
  const updateFallDetectionConfig = (
    newConfig: Partial<FallDetectionConfig>
  ) => {
    const updatedConfig = { ...fallDetectionConfig, ...newConfig };
    setFallDetectionConfig(updatedConfig);
    FallDetectionAPI.updateConfig(updatedConfig);
  };

  // Test fall detection (for debugging)
  const testFallDetection = async () => {
    if (!user?.id) return;

    Alert.alert(
      "Test Fall Detection",
      "Choose a test method:\n\n• Sensor Test: Simulates fall with sensor data\n• Real Test: Use actual device motion (drop carefully!)",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sensor Test",
          onPress: async () => {
            try {
              console.log("🧪 Triggering sensor-based test fall");
              await FallDetectionAPI.triggerTestFall(
                user.id,
                userProfile?.name
              );
              Alert.alert(
                "Test Alert Sent",
                "A simulated fall detection alert has been sent to your emergency contacts."
              );
            } catch (error) {
              console.error("Error sending test fall alert:", error);
              showError(
                "Failed to send test alert. Please check your emergency contacts configuration."
              );
            }
          },
        },
        {
          text: "Real Test",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Real Motion Test",
              "Instructions for testing:\n\n1. Enable fall detection first\n2. Hold phone firmly\n3. Make a sudden downward motion (like dropping but catch it)\n4. Or simulate a tumbling motion\n\n⚠️ Be careful not to drop your device!",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Start Real Test",
                  onPress: () => {
                    // Enable fall detection temporarily for testing
                    setFallDetectionEnabled(true);
                    Alert.alert(
                      "Test Active",
                      "Fall detection is now active. Perform the motion test within 30 seconds.\n\nFall detection will automatically disable after 30 seconds."
                    );

                    // Auto-disable after 30 seconds to prevent accidental triggers
                    setTimeout(() => {
                      setFallDetectionEnabled(false);
                      Alert.alert(
                        "Test Ended",
                        "Fall detection test has ended."
                      );
                    }, 30000);
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  // Add location watcher for continuous updates
  const startLocationWatcher = async () => {
    try {
      // Check if we have permission first
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === "granted") {
        // Start watching location immediately with optimized settings
        const subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 2000, // Update every 2s to reduce GPS noise
            distanceInterval: 3, // Update only after 3m movement to reduce drift
          },
          (location) => {
            const { latitude, longitude, accuracy, speed } = location.coords;

            // Update user location
            setUserLocation({ latitude, longitude });

            // Update region if this is the first location fix or if we're still showing world view
            if (!userLocation || region.latitudeDelta > 1) {
              const newRegion = {
                latitude,
                longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              };
              setRegion(newRegion);
            }

            // Update GPS strength
            const strength = calculateGpsStrength(accuracy);
            setGpsStrength(strength);

            // If actively tracking, add point only if accuracy is good enough
            if (isTracking) {
              // Skip points with poor accuracy to prevent GPS drift inflation
              if (accuracy && accuracy > 25) {
                console.log(`🚫 Skipping location update due to poor accuracy: ${accuracy.toFixed(1)}m`);
                return; // Skip this location update
              }

              const trackingPoint: TrackingPoint = {
                latitude,
                longitude,
                timestamp: Date.now(),
                accuracy: accuracy || undefined,
                speed: speed || undefined,
              };

              setTrackingPoints((prev) => {
                // Check if this point is significantly different from the last one
                if (prev.length > 0) {
                  const lastPoint = prev[prev.length - 1];
                  const timeDiff =
                    trackingPoint.timestamp - lastPoint.timestamp;
                  const distance = calculateDistance(
                    lastPoint.latitude,
                    lastPoint.longitude,
                    latitude,
                    longitude
                  );

                  // Enhanced movement threshold to filter GPS drift
                  // Calculate dynamic threshold based on GPS accuracy
                  const accuracyThreshold = Math.max(
                    3, // Minimum 3m threshold
                    (accuracy || 10) * 0.5 // Use half of GPS accuracy as threshold, default 5m if no accuracy
                  );
                  
                  // Require both time AND significant movement to reduce GPS drift
                  // Also consider speed - if moving fast, allow smaller distance threshold
                  const speedBasedThreshold = (speed && speed > 1.5) ? Math.max(2, accuracyThreshold * 0.7) : accuracyThreshold;
                  
                  if (timeDiff >= 2000 || (timeDiff >= 1000 && distance >= speedBasedThreshold)) {
                    const newPoints = [...prev, trackingPoint];

                    // Update real-time gait segments with new path
                    setRealTimeGaitSegments(
                      generateGaitColoredSegments(newPoints)
                    );

                    // Update current gait based on speed
                    if (trackingPoint.speed !== undefined) {
                      const detectedGait = detectGaitFromSpeed(
                        trackingPoint.speed
                      );
                      setCurrentGait(detectedGait);
                    }

                    return newPoints;
                  }
                  return prev;
                } else {
                  // First tracking point
                  const newPoints = [trackingPoint];
                  setRealTimeGaitSegments(
                    generateGaitColoredSegments(newPoints)
                  );
                  if (trackingPoint.speed !== undefined) {
                    const detectedGait = detectGaitFromSpeed(
                      trackingPoint.speed
                    );
                    setCurrentGait(detectedGait);
                  }
                  return newPoints;
                }
              });
            }
          }
        );

        locationSubscriptionRef.current = subscription;
      }
    } catch (error) {
      console.log("Location watcher failed:", error);
    }
  };

  // Load user's horses from AsyncStorage (with fallback to API)
  useEffect(() => {
    const loadUserHorses = async () => {
      if (user?.id) {
        setHorsesLoading(true);
        try {
          // First try to load horses from AsyncStorage
          const cachedHorses = await AsyncStorage.getItem(
            `user_horses_${user.id}`
          );

          if (cachedHorses) {
            const horses = JSON.parse(cachedHorses);

            // Load images separately for each horse
            const horsesWithImages = await Promise.all(
              horses.map(async (horse: Horse) => {
                try {
                  const cachedImage = await AsyncStorage.getItem(
                    `horse_image_${horse.id}`
                  );
                  if (cachedImage) {
                    const imageData = JSON.parse(cachedImage);
                    return {
                      ...horse,
                      image_url: imageData.image_url,
                      image_base64: imageData.image_base64,
                    };
                  }
                  return horse;
                } catch (imageError) {
                  console.warn(
                    `⚠️ Failed to load image for horse ${horse.name}:`,
                    imageError
                  );
                  return horse; // Return horse without image if image loading fails
                }
              })
            );

            setUserHorses(horsesWithImages || []);
            console.log(
              "✅ Loaded horses from AsyncStorage:",
              horsesWithImages.length,
              "horses with images"
            );
          } else {
            // Fallback to API call if no cached data (first time user or cache cleared)
            console.log("⚠️ No cached horses found, falling back to API call");
            await loadHorsesFromAPI();
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          console.error("❌ Error loading horses:", errorMessage);

          // Handle specific SQLite cursor window error
          if (
            errorMessage.includes("CursorWindow") ||
            errorMessage.includes("Row too big")
          ) {
            console.log(
              "⚠️ Large data detected, trying API with image optimization..."
            );
            await loadHorsesFromAPI();
          } else if (
            errorMessage.includes("JSON") ||
            errorMessage.includes("parse")
          ) {
            console.log("⚠️ Cached data corrupted, falling back to API call");
            await loadHorsesFromAPI();
          } else {
            // For other errors, show error message
            showError(`Failed to load your horses\n\nError: ${errorMessage}`);
          }
        } finally {
          setHorsesLoading(false);
        }
      }
    };

    loadUserHorses();
  }, [user]);

  // Helper function to load horses from API (with caching and optimization)
  const loadHorsesFromAPI = async () => {
    if (!user?.id) return;

    try {
      const horses = await HorseAPI.getHorses(user.id);
      setUserHorses(horses || []);

      // Cache with separate image storage for optimization
      if (horses && horses.length > 0) {
        try {
          await cacheHorsesWithSeparateImages(horses);
        } catch (storageError) {
          console.warn(
            "⚠️ Failed to cache horses (data too large):",
            storageError
          );
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Handle cursor window error specifically
      if (
        errorMessage.includes("CursorWindow") ||
        errorMessage.includes("Row too big")
      ) {
        showError(
          "Unable to load horse data - images too large.\n\nPlease try reducing image sizes in your horse profiles or contact support."
        );
      } else {
        showError(`Failed to load your horses\n\nError: ${errorMessage}`);
      }
      throw error; // Re-throw to handle in calling function
    }
  };

  // Helper function to cache horses with separate image storage
  const cacheHorsesWithSeparateImages = async (horses: Horse[]) => {
    try {
      // Store metadata without images
      const lightweightHorses = horses.map((horse) => ({
        ...horse,
        image_url: undefined,
        image_base64: undefined,
      }));

      await AsyncStorage.setItem(
        `user_horses_${user?.id}`,
        JSON.stringify(lightweightHorses)
      );
      console.log("✅ Horses metadata cached successfully");

      // Store images separately
      for (const horse of horses) {
        if (horse.image_url || horse.image_base64) {
          try {
            const imageData = {
              image_url: horse.image_url,
              image_base64: horse.image_base64,
              cached_at: Date.now(),
            };
            await AsyncStorage.setItem(
              `horse_image_${horse.id}`,
              JSON.stringify(imageData)
            );
            console.log(`✅ Image cached for horse: ${horse.name}`);
          } catch (imageError) {
            console.warn(
              `⚠️ Failed to cache image for horse ${horse.name}:`,
              imageError
            );
            // Continue with other horses even if one image fails
          }
        }
      }
    } catch (storageError) {
      console.warn("⚠️ Failed to cache horses:", storageError);
    }
  };

  // Helper function to get horse image from cache
  const getHorseImageFromCache = async (
    horseId: string
  ): Promise<{ image_url?: string; image_base64?: string } | null> => {
    try {
      const cachedImage = await AsyncStorage.getItem(`horse_image_${horseId}`);
      if (cachedImage) {
        const imageData = JSON.parse(cachedImage);
        return {
          image_url: imageData.image_url,
          image_base64: imageData.image_base64,
        };
      }
      return null;
    } catch (error) {
      console.warn(
        `⚠️ Failed to get cached image for horse ${horseId}:`,
        error
      );
      return null;
    }
  };

  // Function to refresh horses from API (can be called manually if needed)
  const refreshHorsesFromAPI = async () => {
    if (!user?.id) return;

    setHorsesLoading(true);
    try {
      console.log("🔄 Refreshing horses from API...");
      await loadHorsesFromAPI();
      console.log("✅ Horses refreshed and cached");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Handle cursor window error specifically
      if (
        errorMessage.includes("CursorWindow") ||
        errorMessage.includes("Row too big")
      ) {
        console.log(
          "⚠️ Large data detected during refresh, trying optimization..."
        );
        try {
          await loadHorsesFromAPI();
          console.log("✅ Horses refreshed with optimization");
        } catch (optimizedError) {
          showError(
            "Unable to load horse data - images too large.\n\nPlease try reducing image sizes in your horse profiles."
          );
        }
      } else {
        showError(`Failed to refresh horses\n\nError: ${errorMessage}`);
      }
    } finally {
      setHorsesLoading(false);
    }
  };

  // Function to clear horses cache (for debugging/development)
  const clearHorsesCache = async () => {
    if (!user?.id) return;

    try {
      // Clear main horses cache
      await AsyncStorage.removeItem(`user_horses_${user.id}`);

      // Clear individual horse image caches
      const allKeys = await AsyncStorage.getAllKeys();
      const horseImageKeys = allKeys.filter((key) =>
        key.startsWith("horse_image_")
      );
      if (horseImageKeys.length > 0) {
        await AsyncStorage.multiRemove(horseImageKeys);
        console.log(`🗑️ Cleared ${horseImageKeys.length} horse image caches`);
      }

      console.log("🗑️ All horses cache cleared");

      // Clear user horses from state
      setUserHorses([]);

      // Show user that cache was cleared
      showDialog({
        title: "Cache Cleared",
        message:
          "Horse cache and images have been cleared. The app will reload fresh data from the server.",
        buttons: [
          {
            text: "Reload Data",
            style: "default",
            onPress: async () => {
              // Reload horses from API
              try {
                await loadHorsesFromAPI();
              } catch (error) {
                console.error("Failed to reload after cache clear:", error);
              }
            },
          },
          {
            text: "OK",
            style: "cancel",
            onPress: () => {},
          },
        ],
      });
    } catch (error) {
      console.error("❌ Failed to clear horses cache:", error);
      showError("Failed to clear cache");
    }
  };

  // Load favorite training types from storage
  useEffect(() => {
    const loadFavorites = async () => {
      try {
        const savedFavorites = await AsyncStorage.getItem(
          "favorite_training_types"
        );
        if (savedFavorites) {
          setFavoriteTrainingTypes(JSON.parse(savedFavorites));
        }
      } catch (error) {
        // Error loading favorites - continue with empty array
      }
    };
    loadFavorites();
  }, []);

  // Check for horse data refresh when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      const checkForHorseRefresh = async () => {
        try {
          const refreshTimestamp = await AsyncStorage.getItem(
            "horses_refresh_timestamp"
          );
          if (
            refreshTimestamp &&
            refreshTimestamp !== lastHorsesRefreshTimestamp &&
            user?.id
          ) {
            console.log(
              "🔄 Horses were refreshed on another screen, updating map horses..."
            );
            setLastHorsesRefreshTimestamp(refreshTimestamp);

            // Reload horses from API to get fresh data
            setHorsesLoading(true);
            try {
              await loadHorsesFromAPI();
              console.log(
                "✅ Map horses updated after refresh from another screen"
              );
            } catch (error) {
              console.error(
                "❌ Error updating map horses after refresh:",
                error
              );
            } finally {
              setHorsesLoading(false);
            }
          }
        } catch (error) {
          console.error("Error checking for horse refresh:", error);
        }
      };

      checkForHorseRefresh();
    }, [lastHorsesRefreshTimestamp, user?.id])
  );

  // Save favorite training types to storage
  const saveFavoritesToStorage = async (favorites: string[]) => {
    try {
      await AsyncStorage.setItem(
        "favorite_training_types",
        JSON.stringify(favorites)
      );
    } catch (error) {
      // Error saving favorites - continue silently
    }
  };

  // Cleanup effect for background tasks
  useEffect(() => {
    return () => {
      // Cleanup on component unmount
      if (trackingIntervalRef.current) {
        clearInterval(trackingIntervalRef.current);
      }

      // Cleanup notification interval
      if (notificationIntervalRef.current) {
        clearInterval(notificationIntervalRef.current);
      }

      // Cleanup location subscription
      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove();
      }

      // Dismiss any active tracking notification
      if (notificationId) {
        Notifications.dismissNotificationAsync(notificationId);
      }
      Notifications.dismissNotificationAsync(TRACKING_NOTIFICATION_IDENTIFIER);

      // Stop background location tracking if still running
      Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME)
        .then((isRunning) => {
          if (isRunning) {
            return Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
          }
          return Promise.resolve();
        })
        .then(() => {
          // Background location tracking cleaned up
          // Reset tracking status to inactive
          return AsyncStorage.setItem("is_tracking_active", "false");
        })
        .catch((error) => {
          console.error(
            "Error cleaning up background location tracking:",
            error
          );
        });
    };
  }, []);

  // GPS monitoring effect
  useEffect(() => {
    let gpsMonitoringInterval: ReturnType<typeof setInterval>;

    const startGpsMonitoring = () => {
      if (locationPermission) {
        gpsMonitoringInterval = setInterval(async () => {
          try {
            const location = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.High,
            });

            const { accuracy } = location.coords;

            // Calculate GPS strength based on accuracy
            const strength = calculateGpsStrength(accuracy);
            setGpsStrength(strength);
          } catch (error) {
            setGpsStrength(0);
          }
        }, 3000); // Update every 3 seconds
      }
    };

    if (locationPermission && userLocation) {
      startGpsMonitoring();
    }

    return () => {
      if (gpsMonitoringInterval) {
        clearInterval(gpsMonitoringInterval);
      }
    };
  }, [locationPermission, userLocation]);

  // Real-time timer update for tracking
  useEffect(() => {
    let timerInterval: ReturnType<typeof setInterval>;

    if (isTracking && sessionStartTime) {
      timerInterval = setInterval(() => {
        setCurrentTime(Date.now());
      }, 1000);
    }

    return () => {
      if (timerInterval) {
        clearInterval(timerInterval);
      }
    };
  }, [isTracking, sessionStartTime]);

  // Cleanup GPS monitoring when component unmounts
  useEffect(() => {
    return () => {
      setGpsStrength(0);

      // Cleanup tracking subscription
      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove();
      }

      // Cleanup tracking interval
      if (trackingIntervalRef.current) {
        clearInterval(trackingIntervalRef.current);
      }
    };
  }, []);

  // Sample data - these could come from API or context in real app
  const trainingTypes = [
    { id: "dressage", name: "Dressage" },
    { id: "show_jumping", name: "Show Jumping" },
    { id: "trail", name: "Trail Riding" },
    { id: "endurance", name: "Endurance" },
    { id: "western", name: "Western" },
    { id: "leisure", name: "Leisure Ride" },
    { id: "groundwork", name: "Groundwork" },
    { id: "liberty", name: "Liberty Training" },
    { id: "endurance_riding", name: "Endurance Riding" },
  ];

  // Helper function to calculate GPS strength
  const calculateGpsStrength = (accuracy: number | null): number => {
    if (!accuracy) return 0;
    if (accuracy <= 5) return 5;
    if (accuracy <= 10) return 4;
    if (accuracy <= 20) return 3;
    if (accuracy <= 50) return 2;
    if (accuracy <= 100) return 1;
    return 0;
  };

  // Calculate distance between two points using Haversine formula
  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Calculate total distance from tracking points
  const calculateTotalDistance = (points: TrackingPoint[]): number => {
    if (points.length < 2) return 0;
    let totalDistance = 0;
    for (let i = 1; i < points.length; i++) {
      totalDistance += calculateDistance(
        points[i - 1].latitude,
        points[i - 1].longitude,
        points[i].latitude,
        points[i].longitude
      );
    }
    return totalDistance;
  };

  // Horse gait detection based on speed
  const detectGaitFromSpeed = (
    speedMs: number
  ): "walk" | "trot" | "canter" | "gallop" | "halt" => {
    // Convert m/s to km/h for easier understanding
    const speedKmh = speedMs * 3.6;

    // Horse gait speed ranges (in km/h):
    // Halt: 0-2 km/h
    // Walk: 2-8 km/h
    // Trot: 8-16 km/h
    // Canter: 16-25 km/h
    // Gallop: 25+ km/h

    if (speedKmh < 2) return "halt";
    if (speedKmh < 8) return "walk";
    if (speedKmh < 16) return "trot";
    if (speedKmh < 25) return "canter";
    return "gallop";
  };

  // Smooth speed data to reduce GPS noise
  const smoothSpeeds = (
    points: TrackingPoint[],
    windowSize: number = 5
  ): number[] => {
    const speeds: number[] = [];

    for (let i = 0; i < points.length; i++) {
      if (i === 0) {
        speeds.push(points[i].speed || 0);
        continue;
      }

      // Calculate speed from GPS points if not provided
      let speed = points[i].speed;
      if (!speed) {
        const distance = calculateDistance(
          points[i - 1].latitude,
          points[i - 1].longitude,
          points[i].latitude,
          points[i].longitude
        );
        const timeDiff = (points[i].timestamp - points[i - 1].timestamp) / 1000; // seconds
        speed = timeDiff > 0 ? distance / timeDiff : 0;
      }

      // Apply moving average smoothing
      const startIdx = Math.max(0, i - Math.floor(windowSize / 2));
      const endIdx = Math.min(
        points.length - 1,
        i + Math.floor(windowSize / 2)
      );
      let sumSpeed = 0;
      let count = 0;

      for (let j = startIdx; j <= endIdx; j++) {
        const pointSpeed = j === 0 ? points[j].speed || 0 : speeds[j] || speed;
        sumSpeed += pointSpeed;
        count++;
      }

      speeds.push(count > 0 ? sumSpeed / count : speed);
    }

    return speeds;
  };

  // Analyze horse gaits from tracking data
  const analyzeGaits = (points: TrackingPoint[]): GaitAnalysis => {
    if (points.length < 2) {
      return {
        totalDuration: 0,
        gaitDurations: { walk: 0, trot: 0, canter: 0, gallop: 0, halt: 0 },
        gaitPercentages: { walk: 0, trot: 0, canter: 0, gallop: 0, halt: 0 },
        segments: [],
        transitionCount: 0,
        predominantGait: "halt",
      };
    }

    const smoothedSpeeds = smoothSpeeds(points);
    const segments: GaitSegment[] = [];
    const gaitDurations = { walk: 0, trot: 0, canter: 0, gallop: 0, halt: 0 };

    let currentGait = detectGaitFromSpeed(smoothedSpeeds[0]);
    let segmentStartIndex = 0;
    let segmentStartTime = points[0].timestamp;
    let transitionCount = 0;

    // Minimum segment duration (3 seconds) to filter out noise
    const minSegmentDuration = 3000; // milliseconds

    for (let i = 1; i < points.length; i++) {
      const detectedGait = detectGaitFromSpeed(smoothedSpeeds[i]);

      // Check for gait change
      if (detectedGait !== currentGait) {
        const segmentDuration = points[i].timestamp - segmentStartTime;

        // Only create segment if it meets minimum duration
        if (segmentDuration >= minSegmentDuration) {
          const segmentDistance = calculateTotalDistance(
            points.slice(segmentStartIndex, i + 1)
          );
          const avgSpeed =
            segmentDuration > 0
              ? segmentDistance / (segmentDuration / 1000)
              : 0;

          segments.push({
            gait: currentGait,
            startTime: segmentStartTime,
            endTime: points[i].timestamp,
            duration: segmentDuration / 1000, // convert to seconds
            distance: segmentDistance,
            averageSpeed: avgSpeed,
            startIndex: segmentStartIndex,
            endIndex: i,
          });

          gaitDurations[currentGait] += segmentDuration / 1000;
          transitionCount++;

          // Start new segment
          currentGait = detectedGait;
          segmentStartIndex = i;
          segmentStartTime = points[i].timestamp;
        } else {
          // Segment too short, continue with current gait
          currentGait = detectedGait;
        }
      }
    }

    // Add final segment
    const finalDuration =
      points[points.length - 1].timestamp - segmentStartTime;
    if (finalDuration >= minSegmentDuration) {
      const segmentDistance = calculateTotalDistance(
        points.slice(segmentStartIndex)
      );
      const avgSpeed =
        finalDuration > 0 ? segmentDistance / (finalDuration / 1000) : 0;

      segments.push({
        gait: currentGait,
        startTime: segmentStartTime,
        endTime: points[points.length - 1].timestamp,
        duration: finalDuration / 1000,
        distance: segmentDistance,
        averageSpeed: avgSpeed,
        startIndex: segmentStartIndex,
        endIndex: points.length - 1,
      });

      gaitDurations[currentGait] += finalDuration / 1000;
    }

    const totalDuration = Object.values(gaitDurations).reduce(
      (sum, duration) => sum + duration,
      0
    );

    // Calculate percentages
    const gaitPercentages = {
      walk: totalDuration > 0 ? (gaitDurations.walk / totalDuration) * 100 : 0,
      trot: totalDuration > 0 ? (gaitDurations.trot / totalDuration) * 100 : 0,
      canter:
        totalDuration > 0 ? (gaitDurations.canter / totalDuration) * 100 : 0,
      gallop:
        totalDuration > 0 ? (gaitDurations.gallop / totalDuration) * 100 : 0,
      halt: totalDuration > 0 ? (gaitDurations.halt / totalDuration) * 100 : 0,
    };

    // Find predominant gait
    const predominantGait = Object.entries(gaitDurations).reduce((a, b) =>
      gaitDurations[a[0] as keyof typeof gaitDurations] >
      gaitDurations[b[0] as keyof typeof gaitDurations]
        ? a
        : b
    )[0] as "walk" | "trot" | "canter" | "gallop" | "halt";

    return {
      totalDuration,
      gaitDurations,
      gaitPercentages,
      segments,
      transitionCount: Math.max(0, transitionCount - 1), // Subtract 1 as we count segment starts
      predominantGait,
    };
  };

  // Update current gait based on latest tracking point
  const updateCurrentGait = (newPoint: TrackingPoint) => {
    if (isTracking && newPoint.speed !== undefined) {
      const detectedGait = detectGaitFromSpeed(newPoint.speed);
      setCurrentGait(detectedGait);
    }
  };

  // Get gait emoji for display
  const getGaitEmoji = (gait: string): string => {
    switch (gait) {
      case "walk":
        return "🚶";
      case "trot":
        return "🏃";
      case "canter":
        return "🏇";
      case "gallop":
        return "🏇💨";
      case "halt":
        return "⏹️";
      default:
        return "🐎";
    }
  };

  // Save session to AsyncStorage
  const saveSessionToStorage = async (session: TrainingSession) => {
    try {
      const existingSessions = await AsyncStorage.getItem("training_sessions");
      const sessions: TrainingSession[] = existingSessions
        ? JSON.parse(existingSessions)
        : [];

      sessions.push(session);
      await AsyncStorage.setItem("training_sessions", JSON.stringify(sessions));

      // Automatically contribute to stable challenge if user is in a stable
      if (user?.id && session.distance && session.distance > 0) {
        try {
          // Convert meters to kilometers for stable challenge
          const distanceInKm = session.distance / 1000;
          await StableChallengeAPI.addDistanceToStableChallenge(
            user.id,
            distanceInKm
          );
          console.log(`Added ${distanceInKm.toFixed(2)}km to stable challenge`);
        } catch (error) {
          console.error("Error adding distance to stable challenge:", error);
          // Don't throw error as session saving should still succeed
        }
      }
    } catch (error) {
      throw error;
    }
  };

  // Setup tracking notification channel
  const setupTrackingNotificationChannel = async () => {
    try {
      await Notifications.setNotificationChannelAsync("tracking", {
        name: "GPS Tracking",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0], // No vibration
        lightColor: "#4A90E2",
        sound: null, // Silent notifications
        enableLights: true,
        enableVibrate: false,
        showBadge: false,
        lockscreenVisibility:
          Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    } catch (error) {
      console.error("Error setting up notification channel:", error);
    }
  };

  // Request notification permissions
  const requestNotificationPermissions = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted") {
        console.warn("Notification permissions not granted");
        return false;
      }
      return true;
    } catch (error) {
      console.error("Error requesting notification permissions:", error);
      return false;
    }
  };

  // Create or update tracking notification with elapsed time
  const updateTrackingNotification = async (
    startTime: number,
    horseName: string,
    trainingType: string
  ) => {
    try {
      const now = Date.now();
      const elapsedSeconds = Math.floor((now - startTime) / 1000);
      const hours = Math.floor(elapsedSeconds / 3600);
      const minutes = Math.floor((elapsedSeconds % 3600) / 60);
      const seconds = elapsedSeconds % 60;

      const timeString =
        hours > 0
          ? `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
              .toString()
              .padStart(2, "0")}`
          : `${minutes}:${seconds.toString().padStart(2, "0")}`;

      // Use scheduleNotificationAsync with the same identifier to update in place
      // The channel settings will make it silent
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "🐎 GPS Tracking Active",
          body: `${horseName} • ${trainingType}\nElapsed time: ${timeString}`,
          data: {
            type: "tracking",
            startTime,
            horseName,
            trainingType,
          },
          sound: false,
          priority: Notifications.AndroidNotificationPriority.MAX,
          sticky: true,
        },
        trigger: null,
        identifier: TRACKING_NOTIFICATION_IDENTIFIER, // Always same identifier
      });

      // Only set notificationId if it's not already set
      if (!notificationId) {
        setNotificationId(TRACKING_NOTIFICATION_IDENTIFIER);
      }
      return TRACKING_NOTIFICATION_IDENTIFIER;
    } catch (error) {
      console.error("Error updating tracking notification:", error);
      // Show user-facing error for notification issues
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      showError(
        `Failed to update tracking notification\n\nError: ${errorMessage}`
      );
      return null;
    }
  };

  // Start notification timer for tracking
  const startTrackingNotification = async (
    startTime: number,
    horseName: string,
    trainingType: string
  ) => {
    // Request permissions first
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.warn("Cannot show tracking notifications - permissions denied");
      return;
    }

    // Setup notification channel for silent, persistent notifications
    await setupTrackingNotificationChannel();

    // Show initial notification
    const initialNotificationId = await updateTrackingNotification(
      startTime,
      horseName,
      trainingType
    );
    setNotificationId(initialNotificationId);

    // Set up interval to update notification every second
    const interval = setInterval(async () => {
      await updateTrackingNotification(startTime, horseName, trainingType);
    }, 1000);

    notificationIntervalRef.current = interval;
  };

  // Stop tracking notification
  const stopTrackingNotification = async () => {
    try {
      // Clear interval
      if (notificationIntervalRef.current) {
        clearInterval(notificationIntervalRef.current);
        notificationIntervalRef.current = null;
      }

      // Dismiss notification
      if (notificationId) {
        await Notifications.dismissNotificationAsync(notificationId);
        setNotificationId(null);
      }

      // Also dismiss by identifier as backup
      await Notifications.dismissNotificationAsync(
        TRACKING_NOTIFICATION_IDENTIFIER
      );
    } catch (error) {
      console.error("Error stopping tracking notification:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      showError(
        `Failed to stop tracking notification\n\nError: ${errorMessage}`
      );
    }
  };

  const requestLocationPermission = async () => {
    try {
      setLoading(true);

      // First request foreground permission
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationPermission(false);
        showError(
          "Location permission is required to show your position on the map."
        );
        return;
      }

      // For tracking functionality, also request background permission upfront
      const backgroundStatus = await Location.getBackgroundPermissionsAsync();
      if (backgroundStatus.status !== "granted") {
        console.log(
          "Background location permission not granted, will request when needed"
        );
      }

      setLocationPermission(true);
      getCurrentLocation();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      showError(
        `Failed to request location permission\n\nError: ${errorMessage}`
      );
      setLocationPermission(false);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentLocation = async () => {
    try {
      setLoading(true);

      // Try high accuracy first
      let location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const { latitude, longitude, accuracy } = location.coords;

      // Calculate GPS strength based on accuracy (lower accuracy = better signal)
      const strength = calculateGpsStrength(accuracy);
      setGpsStrength(strength);

      const newRegion = {
        latitude,
        longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      setRegion(newRegion);
      setUserLocation({ latitude, longitude });
    } catch (error) {
      try {
        // If high accuracy fails, try balanced accuracy
        let location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        const { latitude, longitude, accuracy } = location.coords;
        const strength = calculateGpsStrength(accuracy);
        setGpsStrength(strength);

        const newRegion = {
          latitude,
          longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        };
        setRegion(newRegion);
        setUserLocation({ latitude, longitude });
      } catch (secondError) {
        const errorMessage =
          secondError instanceof Error
            ? secondError.message
            : String(secondError);
        showError(
          `Unable to get your location. Please check GPS settings.\n\nError: ${errorMessage}`
        );
        setGpsStrength(0);
      }
    } finally {
      setLoading(false);
    }
  };

  const onRegionChange = (newRegion: Region) => {
    setRegion(newRegion);
  };

  // Camera and media functions
  const takePhoto = async () => {
    if (!cameraPermission) {
      showError("Camera permission is required to take photos");
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: "images",
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];

        // Save to device gallery
        if (mediaLibraryPermission) {
          await MediaLibrary.saveToLibraryAsync(asset.uri);
        }

        // Create media item
        const mediaItem: MediaItem = {
          id: `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          uri: asset.uri,
          type: "photo",
          timestamp: Date.now(),
          location: userLocation || undefined,
        };

        // Add to session media
        setSessionMedia((prev) => [...prev, mediaItem]);

        // Show success message
        Alert.alert(
          "Photo Captured",
          "Photo saved to gallery and will be included in session summary"
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      showError(`Failed to take photo: ${errorMessage}`);
    }
  };

  const takeVideo = async () => {
    if (!cameraPermission) {
      showError("Camera permission is required to record videos");
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: "videos",
        allowsEditing: false,
        quality: ImagePicker.UIImagePickerControllerQualityType.Medium,
        videoMaxDuration: 60, // 60 seconds max
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];

        // Save to device gallery
        if (mediaLibraryPermission) {
          await MediaLibrary.saveToLibraryAsync(asset.uri);
        }

        // Create media item
        const mediaItem: MediaItem = {
          id: `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          uri: asset.uri,
          type: "video",
          timestamp: Date.now(),
          location: userLocation || undefined,
        };

        // Add to session media
        setSessionMedia((prev) => [...prev, mediaItem]);

        // Show success message
        Alert.alert(
          "Video Recorded",
          "Video saved to gallery and will be included in session summary"
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      showError(`Failed to record video: ${errorMessage}`);
    }
  };

  const toggleMapType = () => {
    setMapType(mapType === "standard" ? "satellite" : "standard");
  };

  const centerToCurrentLocation = async () => {
    if (userLocation) {
      const newRegion = {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      setRegion(newRegion);
    } else {
      // If no location, try multiple times with increasing accuracy
      setLoading(true);
      try {
        // First try high accuracy
        let location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        const { latitude, longitude, accuracy } = location.coords;
        const strength = calculateGpsStrength(accuracy);
        setGpsStrength(strength);

        const newRegion = {
          latitude,
          longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        };
        setRegion(newRegion);
        setUserLocation({ latitude, longitude });
      } catch (error) {
        try {
          // If high accuracy fails, try balanced accuracy
          let location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });

          const { latitude, longitude, accuracy } = location.coords;
          const strength = calculateGpsStrength(accuracy);
          setGpsStrength(strength);

          const newRegion = {
            latitude,
            longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          };
          setRegion(newRegion);
          setUserLocation({ latitude, longitude });
        } catch (secondError) {
          const errorMessage =
            secondError instanceof Error
              ? secondError.message
              : String(secondError);
          showError(
            `Unable to get your location. Please check GPS settings.\n\nError: ${errorMessage}`
          );
        }
      } finally {
        setLoading(false);
      }
    }
  };

  const renderGpsStrengthBar = () => {
    const bars = [];
    for (let i = 1; i <= 5; i++) {
      bars.push(
        <View
          key={i}
          style={[
            styles.gpsBar,
            {
              backgroundColor:
                i <= gpsStrength ? "#4CAF50" : "rgba(255,255,255,0.3)",
              height: 4 + i * 2, // Progressive height
            },
          ]}
        />
      );
    }
    return (
      <View style={styles.gpsContainer}>
        <View style={styles.gpsStrengthBars}>{bars}</View>
        <Text style={styles.gpsText}>GPS</Text>
      </View>
    );
  };

  // Switch to background location tracking (when app goes to background)
  const switchToBackgroundLocation = async () => {
    try {
      console.log("🔄 Switching to background location tracking...");

      // Stop foreground location watcher
      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove();
        locationSubscriptionRef.current = null;
        console.log("⏹️ Stopped foreground location watcher");
      }

      // Check if background location is already running
      const isAlreadyRunning = await Location.hasStartedLocationUpdatesAsync(
        LOCATION_TASK_NAME
      );

      if (isAlreadyRunning) {
        console.log(
          "✅ Background location service already running, switching mode"
        );
      } else {
        console.log(
          "⚠️ Background location service not running, app may have killed it"
        );
        // If somehow the background service was stopped, log it but don't try to restart
        // as we can't start foreground services from background state
      }

      setIsUsingBackgroundLocation(true);
      console.log("� Switched to background location mode");
    } catch (error) {
      console.error("❌ Error switching to background location:", error);

      // Don't show alert as this is less critical - just log the error
      console.log("🔄 Continuing with whatever location tracking is available");
      setIsUsingBackgroundLocation(true);
    }
  };

  // Debug function to check background tracking status
  const checkBackgroundTrackingStatus = async () => {
    try {
      const isRunning = await Location.hasStartedLocationUpdatesAsync(
        LOCATION_TASK_NAME
      );
      const lastUpdate = await AsyncStorage.getItem("last_background_update");
      const backgroundPoints = await AsyncStorage.getItem(
        "current_tracking_points"
      );

      const pointsCount = backgroundPoints
        ? JSON.parse(backgroundPoints).length
        : 0;
      const lastUpdateTime = lastUpdate
        ? new Date(parseInt(lastUpdate)).toLocaleTimeString()
        : "Never";

      console.log(`🔍 Background Tracking Status:
        - Task Running: ${isRunning}
        - Using Background: ${isUsingBackgroundLocation}
        - Points Stored: ${pointsCount}
        - Last Update: ${lastUpdateTime}
        - App State: ${AppState.currentState}
      `);

      // Show status to user in development
      if (__DEV__) {
        Alert.alert(
          "Background Tracking Status",
          `Task Running: ${isRunning}\nBackground Mode: ${isUsingBackgroundLocation}\nPoints: ${pointsCount}\nLast Update: ${lastUpdateTime}`,
          [{ text: "OK" }]
        );
      }
    } catch (error) {
      console.error("Error checking background status:", error);
    }
  };

  // Switch to foreground location tracking (when app comes to foreground)
  const switchToForegroundLocation = async () => {
    try {
      console.log("🔄 Switching to foreground location tracking...");

      // Sync any background data first
      await syncBackgroundData();

      // Keep background location service running for seamless transitions
      // Don't stop it since we'll need it again when app goes back to background
      console.log(
        "✅ Keeping background location service running for seamless transitions"
      );

      // Start foreground location watcher
      await restartLocationWatcherForTracking();
      console.log("🚀 Started foreground location tracking");

      setIsUsingBackgroundLocation(false);
    } catch (error) {
      console.error("❌ Error switching to foreground location:", error);
    }
  };

  // Sync background data with app state
  const syncBackgroundData = async () => {
    try {
      const backgroundData = await AsyncStorage.getItem(
        "current_tracking_points"
      );
      if (backgroundData) {
        const backgroundPoints = JSON.parse(backgroundData);
        if (backgroundPoints.length > 0) {
          setTrackingPoints((prev) => {
            const existingTimestamps = new Set(prev.map((p) => p.timestamp));
            const newPoints = backgroundPoints.filter(
              (p: TrackingPoint) => !existingTimestamps.has(p.timestamp)
            );

            if (newPoints.length > 0) {
              console.log(`📊 Syncing ${newPoints.length} background points`);

              // Update current location to the most recent point
              const latestPoint = newPoints[newPoints.length - 1];
              setUserLocation({
                latitude: latestPoint.latitude,
                longitude: latestPoint.longitude,
              });

              // Update current gait based on latest point
              updateCurrentGait(latestPoint);

              // Update GPS strength
              const strength = calculateGpsStrength(latestPoint.accuracy);
              setGpsStrength(strength);

              // Clear processed background data
              AsyncStorage.removeItem("current_tracking_points");
            }

            const updatedPoints = [...prev, ...newPoints];

            // Update real-time gait segments with new points
            setRealTimeGaitSegments(generateGaitColoredSegments(updatedPoints));

            return updatedPoints;
          });
        }
      }
    } catch (error) {
      console.error("❌ Error syncing background data:", error);
    }
  };

  // Start GPS tracking
  const startTracking = async () => {
    if (horsesLoading) {
      showError("Please wait for horses to load");
      return;
    }
    if (userHorses.length === 0) {
      showError("No horses available. Please add horses in your profile first");
      return;
    }
    if (!selectedHorse) {
      showError("Please select a horse before starting tracking");
      return;
    }
    if (!selectedTrainingType) {
      showError("Please select a training type before starting tracking");
      return;
    }
    if (!userLocation) {
      showError("Location not available. Please wait for GPS signal");
      return;
    }

    try {
      // Request background location permission for continuous tracking
      const { status } = await Location.requestBackgroundPermissionsAsync();

      if (status !== "granted") {
        showError(
          "Background location permission is required for continuous tracking when screen is off"
        );
        return;
      }

      const selectedHorseData = userHorses.find((h) => h.id === selectedHorse);
      const selectedTrainingData = trainingTypes.find(
        (t) => t.id === selectedTrainingType
      );

      const sessionId = `session_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      const startTime = Date.now();

      const newSession: TrainingSession = {
        id: sessionId,
        userId: user?.id || "",
        horseId: selectedHorse,
        horseName: selectedHorseData?.name || "Unknown Horse",
        trainingType: selectedTrainingData?.name || "Unknown Training",
        startTime,
        path: [],
      };

      setCurrentSession(newSession);
      setIsTracking(true);
      setSessionStartTime(startTime);
      setCurrentTime(startTime); // Initialize currentTime to the same value as startTime
      setTrackingPoints([]);
      setRealTimeGaitSegments([]); // Reset gait segments
      setSessionMedia([]); // Initialize empty media array for the session
      setCurrentGait("halt"); // Reset gait to halt at session start

      // Clear any existing tracking points in storage
      await AsyncStorage.removeItem("current_tracking_points");
      
      // Set tracking status in AsyncStorage for background task
      await AsyncStorage.setItem("is_tracking_active", "true");

      // Ensure any background task is stopped first
      const isAlreadyRunning = await Location.hasStartedLocationUpdatesAsync(
        LOCATION_TASK_NAME
      );
      if (isAlreadyRunning) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      }

      // Start both foreground and background location tracking from the beginning
      console.log(
        `🚀 Starting both foreground and background tracking with highAccuracyMode: ${highAccuracyMode}`
      );

      // Start foreground location tracking
      await restartLocationWatcherForTracking();

      // Start background location tracking immediately (while app is still in foreground)
      // This ensures the service is ready when app goes to background
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 1000, // Always update every 1 second for consistent tracking
        distanceInterval: 0, // Set to 0 to get updates even without movement
        deferredUpdatesInterval: 1000, // Process updates every 1 second
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: "🐎 EquiHUB GPS Tracking",
          notificationBody: "Recording your ride in the background",
          notificationColor: "#4A90E2",
          killServiceOnDestroy: false,
        },
        pausesUpdatesAutomatically: false,
        activityType: Location.LocationActivityType.Fitness,
      });
      console.log(
        "🚀 Started background location service (ready for background mode)"
      );

      // Set state to indicate we're using foreground tracking (background is ready but not active)
      setIsUsingBackgroundLocation(false);

      // Start tracking notification
      await startTrackingNotification(
        startTime,
        selectedHorseData?.name || "Unknown Horse",
        selectedTrainingData?.name || "Unknown Training"
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      showError(
        `Failed to start tracking. Please try again.\n\nError: ${errorMessage}`
      );
    }
  };

  // Stop GPS tracking and save session
  const stopTracking = async () => {
    if (!isTracking || !currentSession || !sessionStartTime) {
      return;
    }

    try {
      // Stop tracking notification first
      await stopTrackingNotification();

      // Stop foreground location tracking
      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove();
        locationSubscriptionRef.current = null;
        console.log("⏹️ Stopped foreground location tracking");
      }

      // Stop background location tracking if running
      const isTaskRunning = await Location.hasStartedLocationUpdatesAsync(
        LOCATION_TASK_NAME
      );
      if (isTaskRunning) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        console.log("⏹️ Stopped background location tracking");
      }

      // Get any remaining background data before cleanup
      const finalBackgroundData = await AsyncStorage.getItem(
        "current_tracking_points"
      );
      if (finalBackgroundData) {
        const finalBackgroundPoints = JSON.parse(finalBackgroundData);
        if (finalBackgroundPoints.length > 0) {
          setTrackingPoints((prev) => {
            const existingTimestamps = new Set(prev.map((p) => p.timestamp));
            const newPoints = finalBackgroundPoints.filter(
              (p: TrackingPoint) => !existingTimestamps.has(p.timestamp)
            );
            console.log(
              `📊 Adding ${newPoints.length} final background points`
            );

            const updatedPoints = [...prev, ...newPoints];

            // Update real-time gait segments with final points
            setRealTimeGaitSegments(generateGaitColoredSegments(updatedPoints));

            return updatedPoints;
          });
        }
      }

      // Clean up storage
      await AsyncStorage.removeItem("current_tracking_points");
      
      // Set tracking status to inactive in AsyncStorage
      await AsyncStorage.setItem("is_tracking_active", "false");

      // Reset app state tracking
      setIsUsingBackgroundLocation(false);

      const endTime = Date.now();
      const duration = Math.floor((endTime - sessionStartTime) / 1000); // Duration in seconds
      const totalDistance = calculateTotalDistance(trackingPoints);

      // Calculate speed statistics
      const speeds = trackingPoints
        .map((point) => point.speed)
        .filter((speed) => speed !== undefined && speed > 0) as number[];

      const averageSpeed =
        speeds.length > 0
          ? speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length
          : 0;

      const maxSpeed = speeds.length > 0 ? Math.max(...speeds) : 0;

      // Analyze horse gaits from tracking data
      const gaitAnalysis = analyzeGaits(trackingPoints);

      const completedSession: TrainingSession = {
        ...currentSession,
        endTime,
        duration,
        distance: totalDistance,
        path: trackingPoints,
        averageSpeed,
        maxSpeed,
        media: sessionMedia, // Include captured media
        gaitAnalysis, // Include gait analysis
      };

      // Save session to storage
      await saveSessionToStorage(completedSession);

      // Update active challenge if user has one
      if (user?.id) {
        try {
          const activeChallenge =
            await ChallengeStorageService.getActiveChallenge(user.id);

          if (activeChallenge) {
            // Create a challenge session from the completed training session
            const challengeSession: ChallengeSession = {
              id: completedSession.id,
              distance: totalDistance / 1000, // Convert to kilometers
              duration: duration / 60, // Convert to minutes
              date: new Date().toISOString(),
              horseName: completedSession.horseName,
            };

            // Add session to active challenge
            const success = await ChallengeStorageService.addChallengeSession(
              user.id,
              challengeSession
            );

            if (success) {
              // Check if challenge was completed
              const updatedChallenge =
                await ChallengeStorageService.getActiveChallenge(user.id);

              if (updatedChallenge?.isCompleted) {
                // Show challenge completion notification
                setTimeout(() => {
                  Alert.alert(
                    "🏆 Challenge Completed!",
                    `Congratulations! You've completed your ${
                      updatedChallenge.target
                    }${
                      updatedChallenge.unit
                    } challenge!\n\nTotal Progress: ${updatedChallenge.progress.toFixed(
                      1
                    )}${updatedChallenge.unit}`,
                    [{ text: "Amazing!" }]
                  );
                }, 1000); // Show after session completion dialog
              } else if (updatedChallenge) {
                // Show progress update
                const progressPercentage = (
                  (updatedChallenge.progress / updatedChallenge.target) *
                  100
                ).toFixed(1);
                console.log(
                  `📊 Challenge progress updated: ${updatedChallenge.progress.toFixed(
                    1
                  )}/${updatedChallenge.target}${
                    updatedChallenge.unit
                  } (${progressPercentage}%)`
                );
              }
            }
          }
        } catch (error) {
          console.error("Error updating challenge progress:", error);
          // Don't show error to user as this is not critical to session completion
        }
      }

      // Reset tracking state
      setIsTracking(false);
      setCurrentSession(null);
      setSessionStartTime(null);
      setTrackingPoints([]);
      setRealTimeGaitSegments([]); // Reset gait segments
      setSessionMedia([]); // Reset media array
      setCurrentGait("halt"); // Reset gait when tracking stops

      // Restart location watcher with normal settings
      await startLocationWatcher();

      // Show custom completion dialog
      const durationMinutes = Math.floor(duration / 60);
      const durationSeconds = duration % 60;
      const formattedDistance = formatDistance(totalDistance);
      const formattedSpeed = formatSpeed(averageSpeed);
      const predominantGaitName =
        gaitAnalysis.predominantGait.charAt(0).toUpperCase() +
        gaitAnalysis.predominantGait.slice(1);

      showDialog({
        title: "🎉 Session Completed!",
        message: `Congratulations! Your training session with ${completedSession.horseName} has been successfully completed.\n\n📊 Session Summary:\n• Duration: ${durationMinutes}m ${durationSeconds}s\n• Distance: ${formattedDistance}\n• Average Speed: ${formattedSpeed}\n• Predominant Gait: ${predominantGaitName}\n• Gait Transitions: ${gaitAnalysis.transitionCount}`,
        buttons: [
          {
            text: "View Details",
            style: "default",
            onPress: () => {
              router.push({
                pathname: "/session-details",
                params: { sessionId: completedSession.id },
              });
            },
          },
          {
            text: "Back to Map",
            style: "cancel",
            onPress: () => {
              // Just close the dialog
            },
          },
        ],
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      showError(
        `Failed to save session. Please try again.\n\nError: ${errorMessage}`
      );
    }
  };

  // Toggle favorite training type
  const toggleFavoriteTraining = (trainingId: string) => {
    setFavoriteTrainingTypes((prev) => {
      const newFavorites = prev.includes(trainingId)
        ? prev.filter((id) => id !== trainingId)
        : [...prev, trainingId];

      // Save to storage
      saveFavoritesToStorage(newFavorites);

      return newFavorites;
    });
  };

  // Sort training types with favorites first
  const getSortedTrainingTypes = () => {
    return [...trainingTypes].sort((a, b) => {
      const aIsFavorite = favoriteTrainingTypes.includes(a.id);
      const bIsFavorite = favoriteTrainingTypes.includes(b.id);

      if (aIsFavorite && !bIsFavorite) return -1;
      if (!aIsFavorite && bIsFavorite) return 1;
      return 0;
    });
  };

  // Load published trails from storage or API
  const loadPublishedTrails = async () => {
    setTrailsLoading(true);
    try {
      // For now, we'll use sample data stored in AsyncStorage
      // In a real app, this would be an API call
      const storedTrails = await AsyncStorage.getItem("published_trails");
      if (storedTrails) {
        const trails = JSON.parse(storedTrails);
        setPublishedTrails(trails);
      } else {
        // Sample trails data - in a real app this would come from your backend
        const sampleTrails: PublishedTrail[] = [
          {
            id: "trail_1",
            name: "Peaceful Valley Loop",
            description:
              "A scenic trail through the valley with gentle terrain",
            userId: "user_1",
            userName: "Sarah Johnson",
            path: [
              {
                latitude: userLocation?.latitude || 0,
                longitude: userLocation?.longitude || 0,
                timestamp: Date.now(),
              },
              {
                latitude: (userLocation?.latitude || 0) + 0.001,
                longitude: (userLocation?.longitude || 0) + 0.002,
                timestamp: Date.now() + 1000,
              },
              {
                latitude: (userLocation?.latitude || 0) + 0.003,
                longitude: (userLocation?.longitude || 0) + 0.001,
                timestamp: Date.now() + 2000,
              },
              {
                latitude: (userLocation?.latitude || 0) + 0.002,
                longitude: (userLocation?.longitude || 0) - 0.001,
                timestamp: Date.now() + 3000,
              },
            ],
            difficulty: "easy",
            distance: 2500,
            duration: 1800,
            trainingType: "Trail Riding",
            rating: 4.5,
            reviewsCount: 12,
            isPublic: true,
            createdAt: Date.now() - 86400000,
          },
          {
            id: "trail_2",
            name: "Mountain Ridge Challenge",
            description:
              "Challenging trail with steep climbs and stunning views",
            userId: "user_2",
            userName: "Mike Thompson",
            path: [
              {
                latitude: (userLocation?.latitude || 0) + 0.005,
                longitude: (userLocation?.longitude || 0) + 0.003,
                timestamp: Date.now(),
              },
              {
                latitude: (userLocation?.latitude || 0) + 0.007,
                longitude: (userLocation?.longitude || 0) + 0.005,
                timestamp: Date.now() + 1000,
              },
              {
                latitude: (userLocation?.latitude || 0) + 0.009,
                longitude: (userLocation?.longitude || 0) + 0.004,
                timestamp: Date.now() + 2000,
              },
              {
                latitude: (userLocation?.latitude || 0) + 0.006,
                longitude: (userLocation?.longitude || 0) + 0.002,
                timestamp: Date.now() + 3000,
              },
            ],
            difficulty: "difficult",
            distance: 4200,
            duration: 3600,
            trainingType: "Endurance",
            rating: 4.8,
            reviewsCount: 8,
            isPublic: true,
            createdAt: Date.now() - 172800000,
          },
        ];
        setPublishedTrails(sampleTrails);
        // Save sample data for future use
        await AsyncStorage.setItem(
          "published_trails",
          JSON.stringify(sampleTrails)
        );
      }
    } catch (error) {
      console.error("Error loading published trails:", error);
      showError("Failed to load published trails");
    } finally {
      setTrailsLoading(false);
    }
  };

  // Toggle published trails visibility
  const togglePublishedTrails = async () => {
    if (!showPublishedTrails && publishedTrails.length === 0) {
      // Load trails if we don't have them yet
      await loadPublishedTrails();
    }
    setShowPublishedTrails(!showPublishedTrails);
  };

  // Get difficulty color for trails
  const getDifficultyColor = (difficulty: string): string => {
    switch (difficulty) {
      case "easy":
        return "#4CAF50"; // Green
      case "moderate":
        return "#FF9800"; // Orange
      case "difficult":
        return "#F44336"; // Red
      default:
        return "#757575"; // Gray
    }
  };

  // Get gait color for path visualization
  const getGaitColor = (
    gait: "walk" | "trot" | "canter" | "gallop" | "halt"
  ): string => {
    switch (gait) {
      case "halt":
        return "#757575"; // Gray - stationary
      case "walk":
        return "#4CAF50"; // Green - slow and steady
      case "trot":
        return "#2196F3"; // Blue - moderate pace
      case "canter":
        return "#FF9800"; // Orange - faster pace
      case "gallop":
        return "#F44336"; // Red - high speed
      default:
        return "#757575"; // Default gray
    }
  };

  // Create gradient color between two colors for smooth transitions
  const interpolateColor = (
    color1: string,
    color2: string,
    factor: number
  ): string => {
    // Convert hex to RGB
    const hex2rgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result
        ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16),
          }
        : { r: 0, g: 0, b: 0 };
    };

    // Convert RGB to hex
    const rgb2hex = (r: number, g: number, b: number) => {
      return (
        "#" +
        (
          (1 << 24) +
          (Math.round(r) << 16) +
          (Math.round(g) << 8) +
          Math.round(b)
        )
          .toString(16)
          .slice(1)
      );
    };

    const c1 = hex2rgb(color1);
    const c2 = hex2rgb(color2);

    const r = c1.r + factor * (c2.r - c1.r);
    const g = c1.g + factor * (c2.g - c1.g);
    const b = c1.b + factor * (c2.b - c1.b);

    return rgb2hex(r, g, b);
  };

  // Generate colored path segments based on gait analysis
  const generateGaitColoredSegments = (
    points: TrackingPoint[]
  ): Array<{
    coordinates: Array<{ latitude: number; longitude: number }>;
    color: string;
    gait: string;
  }> => {
    if (points.length < 2) return [];

    const gaitAnalysis = analyzeGaits(points);
    const segments: Array<{
      coordinates: Array<{ latitude: number; longitude: number }>;
      color: string;
      gait: string;
    }> = [];

    // If no gait segments found, create a single segment with default color
    if (gaitAnalysis.segments.length === 0) {
      return [
        {
          coordinates: points.map((p) => ({
            latitude: p.latitude,
            longitude: p.longitude,
          })),
          color: getGaitColor("halt"),
          gait: "halt",
        },
      ];
    }

    // Process each gait segment
    for (let i = 0; i < gaitAnalysis.segments.length; i++) {
      const segment = gaitAnalysis.segments[i];
      const segmentPoints = points.slice(
        segment.startIndex,
        segment.endIndex + 1
      );

      if (segmentPoints.length < 2) continue;

      const baseColor = getGaitColor(segment.gait);
      const segmentCoordinates = segmentPoints.map((p) => ({
        latitude: p.latitude,
        longitude: p.longitude,
      }));

      // For smooth transitions, create gradient at segment boundaries
      if (i > 0) {
        const prevSegment = gaitAnalysis.segments[i - 1];
        const prevColor = getGaitColor(prevSegment.gait);

        // Create transition zone (first 30% of segment for smoother blending)
        const transitionLength = Math.max(
          2,
          Math.floor(segmentCoordinates.length * 0.3)
        );

        // Split segment into transition and main parts
        const transitionCoords = segmentCoordinates.slice(0, transitionLength);
        const mainCoords = segmentCoordinates.slice(transitionLength - 1); // -1 for continuity

        // Add transition segment with interpolated color
        if (transitionCoords.length >= 2) {
          segments.push({
            coordinates: transitionCoords,
            color: interpolateColor(prevColor, baseColor, 0.6), // More weighted towards new color
            gait: `${prevSegment.gait} → ${segment.gait}`,
          });
        }

        // Add main segment
        if (mainCoords.length >= 2) {
          segments.push({
            coordinates: mainCoords,
            color: baseColor,
            gait: segment.gait,
          });
        }
      } else {
        // First segment, no transition needed
        segments.push({
          coordinates: segmentCoordinates,
          color: baseColor,
          gait: segment.gait,
        });
      }
    }

    return segments;
  };

  // Update high accuracy mode and restart tracking if active
  const updateHighAccuracyMode = async (newMode: boolean) => {
    const previousMode = highAccuracyMode;
    console.log(
      `🔄 updateHighAccuracyMode called: ${previousMode} → ${newMode}, isTracking: ${isTracking}`
    );
    setHighAccuracyMode(newMode);

    // If tracking is active, restart the current tracking mode with new settings
    if (isTracking) {
      try {
        console.log(
          `🔄 Updating tracking mode: ${previousMode ? "High" : "Normal"} → ${
            newMode ? "High" : "Normal"
          } Accuracy`
        );

        if (isUsingBackgroundLocation) {
          // Restart background tracking with new settings
          console.log(
            "🔄 Restarting background tracking with new accuracy settings"
          );
          await switchToBackgroundLocation();
        } else {
          // Restart foreground tracking with new settings
          console.log(
            "🔄 Restarting foreground tracking with new accuracy settings"
          );
          await restartLocationWatcherForTracking();
        }

        console.log(
          `✅ Successfully updated to ${
            newMode ? "High" : "Normal"
          } Accuracy mode`
        );
      } catch (error) {
        console.error("Error updating tracking mode:", error);
        // Revert the state if update failed
        setHighAccuracyMode(previousMode);
      }
    }

    // Show notification when ultra-fast mode is enabled (whether tracking or not)
    if (newMode && !previousMode) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "⚡ Ultra-Fast GPS Enabled",
          body: isTracking
            ? "Ultra-high precision tracking is now active. Battery usage will increase."
            : "Ultra-fast GPS is ready. Start tracking for maximum precision.",
          sound: false,
          priority: Notifications.AndroidNotificationPriority.DEFAULT,
        },
        trigger: null,
        identifier: "ultra-fast-gps-enabled",
      });
    }
  };

  // Restart location watcher with optimized settings for tracking
  const restartLocationWatcherForTracking = async () => {
    try {
      // Stop current watcher
      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove();
        locationSubscriptionRef.current = null;
      }

      // Start optimized watcher for tracking
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === "granted") {
        const subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: highAccuracyMode ? 500 : 1500, // Optimized updates during tracking to reduce noise
            distanceInterval: 1, // Update every 1 meter during tracking (reduced from 0.5m to minimize GPS drift)
          },
          (location) => {
            const { latitude, longitude, accuracy, speed } = location.coords;

            // Update user location
            setUserLocation({ latitude, longitude });

            // Update GPS strength
            const strength = calculateGpsStrength(accuracy);
            setGpsStrength(strength);

            // Immediately add point to tracking points
            const trackingPoint: TrackingPoint = {
              latitude,
              longitude,
              timestamp: Date.now(),
              accuracy: accuracy || undefined,
              speed: speed || undefined,
            };

            setTrackingPoints((prev) => {
              // For active tracking, be more aggressive about capturing points
              if (prev.length > 0) {
                const lastPoint = prev[prev.length - 1];
                const timeDiff = trackingPoint.timestamp - lastPoint.timestamp;
                const distance = calculateDistance(
                  lastPoint.latitude,
                  lastPoint.longitude,
                  latitude,
                  longitude
                );

                // During tracking, capture more frequent updates
                if (
                  timeDiff >= (highAccuracyMode ? 250 : 500) ||
                  distance >= 0.5
                ) {
                  // Update current gait based on new tracking point
                  updateCurrentGait(trackingPoint);

                  const newPoints = [...prev, trackingPoint];

                  // Update real-time gait segments
                  setRealTimeGaitSegments(
                    generateGaitColoredSegments(newPoints)
                  );

                  return newPoints;
                }
                return prev;
              } else {
                const newPoints = [trackingPoint];
                setRealTimeGaitSegments(generateGaitColoredSegments(newPoints));
                return newPoints;
              }
            });
          }
        );

        locationSubscriptionRef.current = subscription;
      }
    } catch (error) {
      console.error("Failed to restart location watcher for tracking:", error);
    }
  };

  if (loading && !userLocation) {
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
            <TouchableOpacity
              style={styles.statisticsButton}
              onPress={() => router.push("/statistics")}
            >
              <Image
                style={{ width: 36, height: 36 }}
                source={require("../../assets/in_app_icons/trends.png")}
              />
            </TouchableOpacity>
            <Text style={styles.header}>Map</Text>
            <TouchableOpacity
              style={styles.historyButton}
              onPress={() => router.push("/sessions")}
            >
              <Image
                style={{ width: 36, height: 36 }}
                source={require("../../assets/in_app_icons/history.png")}
              />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
        <ScrollView
          style={[
            styles.viewPort,
            { backgroundColor: currentTheme.colors.background },
          ]}
        >
          <View style={styles.loadingContainer}>
            <ActivityIndicator
              size="large"
              color={currentTheme.colors.primary}
            />
            <Text
              style={[styles.loadingText, { color: currentTheme.colors.text }]}
            >
              Getting your location...
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  }

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
          <TouchableOpacity
            style={styles.statisticsButton}
            onPress={() => router.push("/statistics")}
          >
            <Image
              style={{ width: 36, height: 36 }}
              source={require("../../assets/in_app_icons/trends.png")}
            />
          </TouchableOpacity>
          <Text style={styles.header}>Map</Text>
          <TouchableOpacity
            style={styles.historyButton}
            onPress={() => router.push("/sessions")}
          >
            <Image
              style={{ width: 36, height: 36 }}
              source={require("../../assets/in_app_icons/history.png")}
            />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView
        style={[
          styles.viewPort,
          { backgroundColor: currentTheme.colors.surface },
        ]}
      >
        <View style={styles.mapContainer}>
          {locationPermission === false && (
            <View style={styles.permissionContainer}>
              <Text style={styles.permissionEmoji}>🔒</Text>
              <Text
                style={[
                  styles.permissionText,
                  { color: currentTheme.colors.text },
                ]}
              >
                Location Permission Required
              </Text>
              <Text
                style={[
                  styles.permissionSubtext,
                  { color: currentTheme.colors.textSecondary },
                ]}
              >
                Allow location access to see your position and nearby equestrian
                facilities.
              </Text>
              <TouchableOpacity
                style={[
                  styles.permissionButton,
                  {
                    backgroundColor: currentTheme.colors.primary,
                    borderColor: currentTheme.colors.border,
                  },
                ]}
                onPress={requestLocationPermission}
              >
                <Text
                  style={[styles.permissionButtonText, { color: "#FFFFFF" }]}
                >
                  Grant Permission
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.mapViewContainer}>
            {renderGpsStrengthBar()}

            {/* Map control buttons */}
            <View style={styles.mapControlsContainer}>
              {/* Debug button for checking background status (only in development) */}
              {__DEV__ && isTracking && (
                <TouchableOpacity
                  style={[
                    styles.mapControlButton,
                    { backgroundColor: "#FF9500", marginBottom: 10 },
                  ]}
                  onPress={checkBackgroundTrackingStatus}
                  activeOpacity={0.7}
                >
                  <Text style={styles.mapControlButtonText}>🔍</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.mapControlButton}
                onPress={toggleMapType}
                activeOpacity={0.7}
              >
                <Text style={styles.mapControlButtonText}>
                  {mapType === "standard" ? "🛰️" : "🗺️"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.mapControlButton, { marginTop: 10 }]}
                onPress={centerToCurrentLocation}
                activeOpacity={0.7}
              >
                <Text style={styles.mapControlButtonText}>📍</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.mapControlButton,
                  {
                    marginTop: 10,
                    backgroundColor: showPublishedTrails
                      ? currentTheme.colors.primary
                      : "rgba(255, 255, 255, 0.9)",
                  },
                ]}
                onPress={togglePublishedTrails}
                activeOpacity={0.7}
                disabled={trailsLoading}
              >
                {trailsLoading ? (
                  <ActivityIndicator
                    size="small"
                    color={currentTheme.colors.primary}
                  />
                ) : (
                  <Text
                    style={[
                      styles.mapControlButtonText,
                      {
                        color: showPublishedTrails ? "#FFFFFF" : "#333333",
                      },
                    ]}
                  >
                    🗺️
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Coordinates display box */}
            {userLocation && (
              <View style={styles.coordinatesBox}>
                <Text style={styles.coordinatesBoxText}>
                  {userLocation.latitude.toFixed(4)}°
                </Text>
                <Text style={styles.coordinatesBoxText}>
                  {userLocation.longitude.toFixed(4)}°
                </Text>
              </View>
            )}

            <MapView
              style={styles.map}
              provider={PROVIDER_GOOGLE}
              region={region}
              onRegionChangeComplete={onRegionChange}
              showsUserLocation={true}
              showsMyLocationButton={false}
              followsUserLocation={false}
              showsCompass={true}
              showsScale={true}
              zoomEnabled={true}
              scrollEnabled={true}
              pitchEnabled={true}
              rotateEnabled={true}
              mapType={mapType}
            >
              {/* Show tracking path with gait-based colors */}
              {realTimeGaitSegments.length > 0 &&
                realTimeGaitSegments.map((segment, index) => (
                  <Polyline
                    key={`gait-segment-${index}-${trackingPoints.length}`}
                    coordinates={segment.coordinates}
                    strokeColor={segment.color}
                    strokeWidth={4}
                    lineCap="round"
                    lineJoin="round"
                  />
                ))}

              {/* Show published trails */}
              {showPublishedTrails &&
                publishedTrails.map((trail) => (
                  <React.Fragment key={trail.id}>
                    {/* Trail path */}
                    <Polyline
                      coordinates={trail.path.map((point) => ({
                        latitude: point.latitude,
                        longitude: point.longitude,
                      }))}
                      strokeColor={getDifficultyColor(trail.difficulty)}
                      strokeWidth={3}
                    />

                    {/* Trail start marker */}
                    {trail.path.length > 0 && (
                      <Marker
                        coordinate={{
                          latitude: trail.path[0].latitude,
                          longitude: trail.path[0].longitude,
                        }}
                        title={trail.name}
                        description={`${
                          trail.difficulty.charAt(0).toUpperCase() +
                          trail.difficulty.slice(1)
                        } • ${(trail.distance / 1000).toFixed(
                          1
                        )} km • ⭐ ${trail.rating.toFixed(1)}`}
                        pinColor={getDifficultyColor(trail.difficulty)}
                      />
                    )}
                  </React.Fragment>
                ))}
            </MapView>
          </View>

          {/* Start/Stop Tracking Button */}
          <View style={styles.trackingControls}>
            <TouchableOpacity
              style={[
                styles.startTrackingButton,
                {
                  backgroundColor: isTracking
                    ? "#DC3545" // Red color for stop
                    : selectedHorse &&
                      selectedTrainingType &&
                      userLocation &&
                      !horsesLoading &&
                      userHorses.length > 0
                    ? currentTheme.colors.primary
                    : currentTheme.colors.border,
                },
              ]}
              onPress={isTracking ? stopTracking : startTracking}
              disabled={
                !isTracking &&
                (!selectedHorse ||
                  !selectedTrainingType ||
                  !userLocation ||
                  horsesLoading ||
                  userHorses.length === 0)
              }
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.startTrackingButtonText,
                  {
                    color: isTracking
                      ? "#FFFFFF"
                      : selectedHorse && selectedTrainingType && userLocation
                      ? "#FFFFFF"
                      : currentTheme.colors.textSecondary,
                  },
                ]}
              >
                {isTracking ? "Stop Tracking" : "Start Tracking"}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.trackingControls}>
            {/* Horse Selection - Hidden during tracking */}
            {!isTracking && (
              <View style={styles.selectionContainer}>
                <Text
                  style={[
                    styles.selectionTitle,
                    { color: currentTheme.colors.text },
                  ]}
                >
                  Select Horse
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.horizontalScroll}
                >
                  {horsesLoading ? (
                    <View
                      style={[
                        styles.selectionCard,
                        {
                          backgroundColor: currentTheme.colors.background,
                          borderColor: currentTheme.colors.border,
                        },
                      ]}
                    >
                      <ActivityIndicator
                        size="small"
                        color={currentTheme.colors.primary}
                      />
                      <Text
                        style={[
                          styles.selectionCardSubtitle,
                          { color: currentTheme.colors.textSecondary },
                        ]}
                      >
                        Loading horses...
                      </Text>
                    </View>
                  ) : userHorses.length === 0 ? (
                    <View
                      style={[
                        styles.selectionCard,
                        {
                          backgroundColor: currentTheme.colors.background,
                          borderColor: currentTheme.colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.selectionCardTitle,
                          { color: currentTheme.colors.text },
                        ]}
                      >
                        No horses found
                      </Text>
                      <Text
                        style={[
                          styles.selectionCardSubtitle,
                          { color: currentTheme.colors.textSecondary },
                        ]}
                      >
                        Add horses in your profile
                      </Text>
                    </View>
                  ) : (
                    userHorses.map((horse) => (
                      <TouchableOpacity
                        key={horse.id}
                        style={[
                          styles.selectionCard,
                          {
                            backgroundColor:
                              selectedHorse === horse.id
                                ? currentTheme.colors.primary
                                : currentTheme.colors.background,
                            borderColor:
                              selectedHorse === horse.id
                                ? currentTheme.colors.primary
                                : currentTheme.colors.border,
                          },
                        ]}
                        onPress={() => setSelectedHorse(horse.id)}
                        activeOpacity={0.7}
                      >
                        {horse.image_url || horse.image_base64 ? (
                          <Image
                            source={{
                              uri: horse.image_base64
                                ? `data:image/jpeg;base64,${horse.image_base64}`
                                : horse.image_url,
                            }}
                            style={styles.horseImage}
                            resizeMode="cover"
                          />
                        ) : (
                          <View
                            style={[
                              styles.horseImage,
                              {
                                backgroundColor: currentTheme.colors.surface,
                                justifyContent: "center",
                                alignItems: "center",
                              },
                            ]}
                          >
                            <Text style={{ fontSize: 24 }}>🐴</Text>
                          </View>
                        )}
                        <Text
                          style={[
                            styles.selectionCardTitle,
                            {
                              color:
                                selectedHorse === horse.id
                                  ? "#FFFFFF"
                                  : currentTheme.colors.text,
                              textAlign: "center",
                            },
                          ]}
                        >
                          {horse.name}
                        </Text>
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
              </View>
            )}

            {/* Training Type Selection - Hidden during tracking */}
            {!isTracking && (
              <View style={styles.selectionContainer}>
                <Text
                  style={[
                    styles.selectionTitle,
                    { color: currentTheme.colors.text },
                  ]}
                >
                  Training Type
                </Text>

                {/* Training Dropdown */}
                <TouchableOpacity
                  style={[
                    styles.trainingDropdown,
                    {
                      backgroundColor: currentTheme.colors.background,
                      borderColor: currentTheme.colors.border,
                    },
                  ]}
                  onPress={() =>
                    setTrainingDropdownVisible(!trainingDropdownVisible)
                  }
                  activeOpacity={0.7}
                >
                  <View style={styles.trainingDropdownContent}>
                    {selectedTrainingType ? (
                      <View style={styles.selectedTrainingContent}>
                        <Text
                          style={[
                            styles.selectedTrainingText,
                            { color: currentTheme.colors.text },
                          ]}
                        >
                          {
                            trainingTypes.find(
                              (t) => t.id === selectedTrainingType
                            )?.name
                          }
                        </Text>
                      </View>
                    ) : (
                      <Text
                        style={[
                          styles.placeholderText,
                          { color: currentTheme.colors.textSecondary },
                        ]}
                      >
                        Select training type
                      </Text>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.dropdownArrow,
                      { color: currentTheme.colors.text },
                    ]}
                  >
                    {trainingDropdownVisible ? "▲" : "▼"}
                  </Text>
                </TouchableOpacity>

                {/* Training Dropdown List */}
                {trainingDropdownVisible && (
                  <Modal
                    transparent={true}
                    visible={trainingDropdownVisible}
                    animationType="fade"
                    onRequestClose={() => setTrainingDropdownVisible(false)}
                  >
                    <TouchableOpacity
                      style={{
                        flex: 1,
                        backgroundColor: "rgba(0, 0, 0, 0.3)",
                      }}
                      onPress={() => setTrainingDropdownVisible(false)}
                      activeOpacity={1}
                    >
                      <View
                        style={{
                          position: "absolute",
                          top: 400, // Adjust this value based on dropdown position
                          left: 20,
                          right: 20,
                        }}
                      >
                        <View
                          style={[
                            styles.trainingDropdownList,
                            {
                              backgroundColor: currentTheme.colors.background,
                              borderColor: currentTheme.colors.border,
                            },
                          ]}
                        >
                          <ScrollView showsVerticalScrollIndicator={false}>
                            {getSortedTrainingTypes().map((training, index) => {
                              const isFirstNonFavorite =
                                favoriteTrainingTypes.length > 0 &&
                                index === favoriteTrainingTypes.length &&
                                !favoriteTrainingTypes.includes(training.id);

                              return (
                                <View key={training.id}>
                                  {isFirstNonFavorite && (
                                    <View style={styles.favoritesSeparator}>
                                      <Text
                                        style={[
                                          styles.separatorText,
                                          {
                                            color:
                                              currentTheme.colors.textSecondary,
                                          },
                                        ]}
                                      >
                                        Other Training Types
                                      </Text>
                                    </View>
                                  )}
                                  <TouchableOpacity
                                    style={[
                                      styles.trainingDropdownItem,
                                      {
                                        backgroundColor:
                                          selectedTrainingType === training.id
                                            ? currentTheme.colors.primary + "20"
                                            : "transparent",
                                      },
                                    ]}
                                    onPress={() => {
                                      setSelectedTrainingType(training.id);
                                      setTrainingDropdownVisible(false);
                                    }}
                                    activeOpacity={0.7}
                                  >
                                    <View style={styles.trainingItemContent}>
                                      <Text
                                        style={[
                                          styles.trainingItemText,
                                          {
                                            color:
                                              selectedTrainingType ===
                                              training.id
                                                ? currentTheme.colors.primary
                                                : currentTheme.colors.text,
                                            fontWeight:
                                              selectedTrainingType ===
                                              training.id
                                                ? "600"
                                                : "normal",
                                          },
                                        ]}
                                      >
                                        {training.name}
                                      </Text>
                                    </View>
                                    <TouchableOpacity
                                      style={styles.favoriteButton}
                                      onPress={(e) => {
                                        e.stopPropagation();
                                        toggleFavoriteTraining(training.id);
                                      }}
                                      hitSlop={{
                                        top: 10,
                                        bottom: 10,
                                        left: 10,
                                        right: 10,
                                      }}
                                    >
                                      <Text style={styles.favoriteIcon}>
                                        {favoriteTrainingTypes.includes(
                                          training.id
                                        )
                                          ? "★"
                                          : "☆"}
                                      </Text>
                                    </TouchableOpacity>
                                  </TouchableOpacity>
                                </View>
                              );
                            })}
                          </ScrollView>
                        </View>
                      </View>
                    </TouchableOpacity>
                  </Modal>
                )}

                {/* Battery Info Modal */}
                <Modal
                  visible={showBatteryInfoModal}
                  animationType="fade"
                  transparent={true}
                  onRequestClose={() => setShowBatteryInfoModal(false)}
                >
                  <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowBatteryInfoModal(false)}
                  >
                    <TouchableOpacity
                      style={[
                        styles.batteryInfoModal,
                        { backgroundColor: currentTheme.colors.surface },
                      ]}
                      activeOpacity={1}
                      onPress={(e) => e.stopPropagation()}
                    >
                      <View style={styles.batteryInfoHeader}>
                        <Text
                          style={[
                            styles.batteryInfoTitle,
                            { color: currentTheme.colors.text },
                          ]}
                        >
                          Ultra-Fast GPS Tracking
                        </Text>
                        <TouchableOpacity
                          onPress={() => setShowBatteryInfoModal(false)}
                          style={styles.closeModalButton}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.closeModalText,
                              { color: currentTheme.colors.textSecondary },
                            ]}
                          >
                            ✕
                          </Text>
                        </TouchableOpacity>
                      </View>
                      <View style={styles.batteryInfoContent}>
                        <Text
                          style={[
                            styles.batteryInfoText,
                            { color: currentTheme.colors.text },
                          ]}
                        >
                          Ultra-fast GPS tracking provides maximum precision
                          location updates by checking your position every 250ms
                          and capturing movement down to 0.5 meters. Normal mode
                          updates every 500ms with 1-meter precision.
                        </Text>
                        <Text
                          style={[
                            styles.batteryWarningText,
                            { color: "#FF6B35" },
                          ]}
                        >
                          ⚠️ Warning: Ultra-fast mode will significantly
                          increase battery usage due to extremely frequent GPS
                          polling.
                        </Text>
                        <Text
                          style={[
                            styles.batteryRecommendationText,
                            { color: currentTheme.colors.textSecondary },
                          ]}
                        >
                          Recommended for precision training sessions or when
                          using external power source.
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.batteryInfoButton,
                          { backgroundColor: currentTheme.colors.primary },
                        ]}
                        onPress={() => setShowBatteryInfoModal(false)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.batteryInfoButtonText}>Got it</Text>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  </TouchableOpacity>
                </Modal>

                {/* Fall Detection Disclaimer Modal */}
                <Modal
                  visible={showFallDetectionDisclaimer}
                  transparent={true}
                  animationType="slide"
                  onRequestClose={() => setShowFallDetectionDisclaimer(false)}
                >
                  <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowFallDetectionDisclaimer(false)}
                  >
                    <TouchableOpacity
                      style={[
                        styles.batteryInfoModal,
                        { backgroundColor: currentTheme.colors.surface },
                      ]}
                      activeOpacity={1}
                      onPress={() => {}}
                    >
                      <View style={styles.batteryInfoHeader}>
                        <Text
                          style={[
                            styles.batteryInfoTitle,
                            { color: currentTheme.colors.text },
                          ]}
                        >
                          ⚠️ Fall Detection Disclaimer
                        </Text>
                      </View>

                      <View style={styles.batteryInfoContent}>
                        <Text
                          style={[
                            styles.batteryInfoText,
                            { color: currentTheme.colors.textSecondary },
                          ]}
                        >
                          Important: This fall detection feature is designed to
                          assist in emergency situations but has important
                          limitations:
                        </Text>

                        <Text
                          style={[
                            styles.batteryInfoText,
                            {
                              color: currentTheme.colors.textSecondary,
                              fontWeight: "600",
                              marginTop: 10,
                            },
                          ]}
                        >
                          • This function is NOT replacing official emergency
                          services
                        </Text>

                        <Text
                          style={[
                            styles.batteryInfoText,
                            { color: currentTheme.colors.textSecondary },
                          ]}
                        >
                          • False positives and missed detections can occur
                        </Text>

                        <Text
                          style={[
                            styles.batteryInfoText,
                            { color: currentTheme.colors.textSecondary },
                          ]}
                        >
                          • Always carry proper emergency communication devices
                        </Text>

                        <Text
                          style={[
                            styles.batteryInfoText,
                            { color: currentTheme.colors.textSecondary },
                          ]}
                        >
                          • Inform others of your riding plans and expected
                          return
                        </Text>

                        <Text
                          style={[
                            styles.batteryInfoText,
                            {
                              color: currentTheme.colors.textSecondary,
                              marginTop: 10,
                              fontStyle: "italic",
                            },
                          ]}
                        >
                          By enabling this feature, you acknowledge these
                          limitations and understand that fall detection is a
                          supplementary safety tool only.
                        </Text>
                      </View>

                      <View style={styles.modalButtonContainer}>
                        <TouchableOpacity
                          onPress={() => setShowFallDetectionDisclaimer(false)}
                          style={[
                            styles.modalButton,
                            styles.cancelButton,
                            { borderColor: currentTheme.colors.border },
                          ]}
                        >
                          <Text
                            style={[
                              styles.modalButtonText,
                              { color: currentTheme.colors.textSecondary },
                            ]}
                          >
                            Cancel
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={saveFallDisclaimerAcceptance}
                          style={[
                            styles.modalButton,
                            styles.confirmButton,
                            { backgroundColor: currentTheme.colors.primary },
                          ]}
                        >
                          <Text
                            style={[
                              styles.modalButtonText,
                              { color: currentTheme.colors.surface },
                            ]}
                          >
                            I Understand
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  </TouchableOpacity>
                </Modal>
              </View>
            )}

            {/* High Accuracy Toggle - Hidden during tracking */}
            {!isTracking && (
              <View
                style={[
                  styles.highAccuracyContainer,
                  { backgroundColor: currentTheme.colors.surface },
                ]}
              >
                <View style={styles.highAccuracyRow}>
                  <Text
                    style={[
                      styles.highAccuracyLabel,
                      { color: currentTheme.colors.text },
                    ]}
                  >
                    Ultra-Fast GPS Tracking
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowBatteryInfoModal(true)}
                    style={styles.infoButton}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.infoButtonText,
                        { color: currentTheme.colors.primary },
                      ]}
                    >
                      ⓘ
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.toggleSwitch,
                      {
                        backgroundColor: highAccuracyMode
                          ? currentTheme.colors.primary
                          : currentTheme.colors.border,
                      },
                    ]}
                    onPress={() => updateHighAccuracyMode(!highAccuracyMode)}
                    activeOpacity={0.8}
                  >
                    <View
                      style={[
                        styles.toggleKnob,
                        {
                          backgroundColor: "#FFFFFF",
                          transform: [
                            { translateX: highAccuracyMode ? 20 : 0 },
                          ],
                        },
                      ]}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Fall Detection Toggle - Hidden during tracking */}
            {!isTracking && (
              <View
                style={[
                  styles.highAccuracyContainer,
                  { backgroundColor: currentTheme.colors.surface },
                ]}
              >
                <View style={styles.highAccuracyRow}>
                  <Text
                    style={[
                      styles.highAccuracyLabel,
                      { color: currentTheme.colors.text },
                    ]}
                  >
                    🚨 Fall Detection
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowFallDetectionModal(true)}
                    style={styles.infoButton}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.infoButtonText,
                        { color: currentTheme.colors.primary },
                      ]}
                    >
                      ⚙️
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.toggleSwitch,
                      {
                        backgroundColor: fallDetectionEnabled
                          ? currentTheme.colors.primary
                          : currentTheme.colors.border,
                      },
                    ]}
                    onPress={() => {
                      if (!fallDetectionEnabled) {
                        // Check if disclaimer has been accepted before
                        if (fallDisclaimerAccepted) {
                          // Directly enable fall detection if disclaimer already accepted
                          setFallDetectionEnabled(true);
                        } else {
                          // Show disclaimer when enabling fall detection for the first time
                          setShowFallDetectionDisclaimer(true);
                        }
                      } else {
                        // Directly disable if turning off
                        setFallDetectionEnabled(false);
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    <View
                      style={[
                        styles.toggleKnob,
                        {
                          backgroundColor: "#FFFFFF",
                          transform: [
                            { translateX: fallDetectionEnabled ? 20 : 0 },
                          ],
                        },
                      ]}
                    />
                  </TouchableOpacity>
                </View>
                {fallDetectionEnabled && (
                  <Text
                    style={[
                      styles.batteryRecommendationText,
                      {
                        color: currentTheme.colors.textSecondary,
                        marginTop: 8,
                      },
                    ]}
                  >
                    Monitors sensors to detect falls and automatically alerts
                    emergency contacts
                  </Text>
                )}
              </View>
            )}

            {/* Fall Detection Status Indicator - Always visible when enabled */}
            {fallDetectionEnabled && (
              <View
                style={[
                  styles.highAccuracyContainer,
                  {
                    backgroundColor: currentTheme.colors.surface,
                    marginTop: isTracking ? 10 : 0,
                  },
                ]}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Text
                    style={[
                      styles.highAccuracyLabel,
                      {
                        color: currentTheme.colors.text,
                        fontSize: 14,
                      },
                    ]}
                  >
                    🚨 Fall Detection Status
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      padding: 6,
                      backgroundColor: pendingFallConfirmation
                        ? "rgba(255, 193, 7, 0.1)" // Yellow for pending
                        : FallDetectionAPI.isActivelyMonitoring()
                        ? "rgba(76, 175, 80, 0.1)"
                        : "rgba(255, 107, 107, 0.1)",
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: pendingFallConfirmation
                        ? "#FFC107" // Yellow for pending
                        : FallDetectionAPI.isActivelyMonitoring()
                        ? "#4CAF50"
                        : "#FF6B6B",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        color: pendingFallConfirmation
                          ? "#FFC107" // Yellow for pending
                          : FallDetectionAPI.isActivelyMonitoring()
                          ? "#4CAF50"
                          : "#FF6B6B",
                        fontWeight: "700",
                        marginRight: 4,
                      }}
                    >
                      ●
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        color: pendingFallConfirmation
                          ? "#FFC107" // Yellow for pending
                          : FallDetectionAPI.isActivelyMonitoring()
                          ? "#4CAF50"
                          : "#FF6B6B",
                        fontWeight: "600",
                      }}
                    >
                      {pendingFallConfirmation
                        ? "FALL DETECTED - WAITING"
                        : FallDetectionAPI.isActivelyMonitoring()
                        ? "MONITORING"
                        : "INACTIVE"}
                    </Text>
                  </View>
                </View>

                <Text
                  style={{
                    fontSize: 10,
                    color: currentTheme.colors.textSecondary,
                    marginTop: 6,
                    fontFamily: "monospace",
                  }}
                >
                  Threshold: {fallDetectionConfig.accelerationThreshold}g |
                  Gyro: {fallDetectionConfig.gyroscopeThreshold} rad/s |
                  Recovery: {fallDetectionConfig.recoveryTimeout / 1000}s
                </Text>
              </View>
            )}

            {/* Tracking Status Display */}
            {isTracking && sessionStartTime && (
              <View
                style={[
                  styles.trackingStatusContainer,
                  { backgroundColor: currentTheme.colors.surface },
                ]}
              >
                <View style={styles.trackingStatusHeader}>
                  <View style={styles.recordingIndicator}>
                    <View style={styles.recordingDot} />
                    <Text style={[styles.recordingText, { color: "#DC3545" }]}>
                      RECORDING
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.trackingTimer,
                      { color: currentTheme.colors.primary },
                    ]}
                  >
                    {(() => {
                      const elapsed = Math.max(
                        0,
                        currentTime - sessionStartTime
                      );
                      const minutes = Math.floor(elapsed / 60000);
                      const seconds = Math.floor((elapsed % 60000) / 1000);
                      return `${minutes}:${String(seconds).padStart(2, "0")}`;
                    })()}
                  </Text>
                </View>

                <View style={styles.trackingStats}>
                  <View style={styles.trackingStatItem}>
                    <Text
                      style={[
                        styles.trackingStatLabel,
                        { color: currentTheme.colors.textSecondary },
                      ]}
                    >
                      Distance
                    </Text>
                    <Text
                      style={[
                        styles.trackingStatValue,
                        { color: currentTheme.colors.text },
                      ]}
                    >
                      {formatDistance(calculateTotalDistance(trackingPoints))}
                    </Text>
                  </View>
                  <View style={styles.trackingStatItem}>
                    <Text
                      style={[
                        styles.trackingStatLabel,
                        { color: currentTheme.colors.textSecondary },
                      ]}
                    >
                      Gait
                    </Text>
                    <View style={styles.gaitDisplayContainer}>
                      <Text style={styles.gaitDisplayEmoji}>
                        {getGaitEmoji(currentGait)}
                      </Text>
                      <Text
                        style={[
                          styles.trackingStatValue,
                          { color: currentTheme.colors.text },
                        ]}
                      >
                        {currentGait.charAt(0).toUpperCase() +
                          currentGait.slice(1)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.trackingStatItem}>
                    <Text
                      style={[
                        styles.trackingStatLabel,
                        { color: currentTheme.colors.textSecondary },
                      ]}
                    >
                      Safety
                    </Text>
                    <View style={styles.gaitDisplayContainer}>
                      <Text style={styles.gaitDisplayEmoji}>
                        {fallDetectionEnabled ? "🛡️" : "⚠️"}
                      </Text>
                      <Text
                        style={[
                          styles.trackingStatValue,
                          {
                            color: fallDetectionEnabled
                              ? currentTheme.colors.primary
                              : currentTheme.colors.warning,
                          },
                        ]}
                      >
                        {fallDetectionEnabled ? "Active" : "Off"}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.trackingStatItem}>
                    <Text
                      style={[
                        styles.trackingStatLabel,
                        { color: currentTheme.colors.textSecondary },
                      ]}
                    >
                      Points
                    </Text>
                    <Text
                      style={[
                        styles.trackingStatValue,
                        { color: currentTheme.colors.text },
                      ]}
                    >
                      {trackingPoints.length}
                    </Text>
                  </View>
                </View>

                {/* Gait Color Legend */}
                <View style={styles.gaitLegendContainer}>
                  <Text
                    style={[
                      styles.gaitLegendTitle,
                      { color: currentTheme.colors.textSecondary },
                    ]}
                  >
                    Path Colors
                  </Text>
                  <View style={styles.gaitLegendRow}>
                    {[
                      { gait: "halt", label: "Halt" },
                      { gait: "walk", label: "Walk" },
                      { gait: "trot", label: "Trot" },
                      { gait: "canter", label: "Canter" },
                      { gait: "gallop", label: "Gallop" },
                    ].map((item) => (
                      <View key={item.gait} style={styles.gaitLegendItem}>
                        <View
                          style={[
                            styles.gaitColorDot,
                            { backgroundColor: getGaitColor(item.gait as any) },
                          ]}
                        />
                        <Text
                          style={[
                            styles.gaitLegendLabel,
                            { color: currentTheme.colors.textSecondary },
                          ]}
                        >
                          {item.label}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Camera Controls */}
                <View style={styles.cameraControlsContainer}>
                  <Text
                    style={[
                      styles.cameraControlsTitle,
                      { color: currentTheme.colors.text },
                    ]}
                  >
                    Capture Memories
                  </Text>
                  <View style={styles.cameraButtonsRow}>
                    <TouchableOpacity
                      style={[
                        styles.cameraButton,
                        { backgroundColor: currentTheme.colors.primary },
                      ]}
                      onPress={takePhoto}
                      activeOpacity={0.8}
                      disabled={!cameraPermission}
                    >
                      <Text style={styles.cameraButtonIcon}>📸</Text>
                      <Text style={styles.cameraButtonText}>Photo</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.cameraButton,
                        { backgroundColor: currentTheme.colors.primary },
                      ]}
                      onPress={takeVideo}
                      activeOpacity={0.8}
                      disabled={!cameraPermission}
                    >
                      <Text style={styles.cameraButtonIcon}>🎥</Text>
                      <Text style={styles.cameraButtonText}>Video</Text>
                    </TouchableOpacity>
                  </View>

                  {sessionMedia.length > 0 && (
                    <Text
                      style={[
                        styles.mediaCountText,
                        { color: currentTheme.colors.textSecondary },
                      ]}
                    >
                      {sessionMedia.length} item
                      {sessionMedia.length !== 1 ? "s" : ""} captured
                    </Text>
                  )}
                </View>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Loading overlay */}
      {loading && userLocation && (
        <View style={styles.loadingOverlay}>
          <View
            style={[
              styles.loadingModal,
              { backgroundColor: currentTheme.colors.surface },
            ]}
          >
            <ActivityIndicator
              size="large"
              color={currentTheme.colors.primary}
            />
            <Text
              style={[
                styles.loadingModalText,
                { color: currentTheme.colors.text },
              ]}
            >
              Updating location...
            </Text>
          </View>
        </View>
      )}

      {/* Fall Detection Configuration Modal */}
      <Modal
        visible={showFallDetectionModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowFallDetectionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.batteryInfoModal,
              { backgroundColor: currentTheme.colors.background },
            ]}
          >
            <View style={styles.batteryInfoHeader}>
              <Text
                style={[
                  styles.batteryInfoTitle,
                  { color: currentTheme.colors.text },
                ]}
              >
                🚨 Fall Detection
              </Text>
              <TouchableOpacity
                style={[
                  styles.closeModalButton,
                  { backgroundColor: "rgba(0, 0, 0, 0.1)" },
                ]}
                onPress={() => setShowFallDetectionModal(false)}
              >
                <Text
                  style={[
                    styles.closeModalText,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  ✕
                </Text>
              </TouchableOpacity>
            </View>

            <View>
              <Text
                style={[
                  styles.batteryInfoText,
                  { color: currentTheme.colors.text },
                ]}
              >
                Fall detection uses your device's sensors to automatically
                detect potential falls during rides and send emergency alerts to
                your contacts.
              </Text>

              <Text
                style={[
                  styles.batteryWarningText,
                  { color: currentTheme.colors.warning },
                ]}
              >
                How it works:
              </Text>
              <Text
                style={[
                  styles.batteryRecommendationText,
                  { color: currentTheme.colors.textSecondary },
                ]}
              >
                • Monitors accelerometer for sudden impacts (
                {fallDetectionConfig.accelerationThreshold}g threshold)
                {"\n"}• Detects rotational motion with gyroscope (
                {fallDetectionConfig.gyroscopeThreshold} rad/s threshold)
                {"\n"}• Waits {fallDetectionConfig.recoveryTimeout / 1000}{" "}
                seconds for recovery before alerting
                {"\n"}• Automatically sends SMS with location to emergency
                contacts
                {"\n"}• ✅ Background monitoring: Works when screen is off or
                app is backgrounded
                {"\n"}• 🔋 Optimized for battery efficiency during background
                operation
              </Text>

              {recentFallEvents.length > 0 && (
                <>
                  <Text
                    style={[
                      styles.batteryWarningText,
                      { color: currentTheme.colors.text, marginTop: 16 },
                    ]}
                  >
                    Recent Fall Events:
                  </Text>
                  {recentFallEvents.slice(0, 3).map((event) => (
                    <View
                      key={event.id}
                      style={{
                        backgroundColor: currentTheme.colors.surface,
                        padding: 12,
                        borderRadius: 8,
                        marginBottom: 8,
                      }}
                    >
                      <Text
                        style={[
                          styles.batteryRecommendationText,
                          { color: currentTheme.colors.text },
                        ]}
                      >
                        {new Date(event.timestamp).toLocaleString()}
                      </Text>
                      <Text
                        style={[
                          styles.batteryRecommendationText,
                          { color: currentTheme.colors.textSecondary },
                        ]}
                      >
                        Impact: {event.accelerationMagnitude.toFixed(1)}g
                        {event.alertSent
                          ? " • Alert sent ✅"
                          : " • Alert failed ❌"}
                        {event.detectedInBackground
                          ? " • Background detection 🌙"
                          : " • Foreground detection 📱"}
                      </Text>
                    </View>
                  ))}
                </>
              )}
            </View>

            <TouchableOpacity
              style={[
                styles.batteryInfoButton,
                { backgroundColor: currentTheme.colors.primary, marginTop: 20 },
              ]}
              onPress={() => setShowFallDetectionModal(false)}
            >
              <Text style={styles.batteryInfoButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#335C67",
  },
  safeArea: {
    backgroundColor: "#335C67",
  },
  content: {
    flex: 1,
  },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: -55,
    marginTop: -20,
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
    marginTop: -8,
    paddingTop: 10,
  },
  mapContainer: {
    flex: 1,
    paddingHorizontal: 20,
    marginTop: 5,
    paddingBottom: 110,
  },
  mapViewContainer: {
    height: 400,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 0,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 8,
  },
  map: {
    flex: 1,
  },
  mapInfo: {
    marginTop: 10,
  },
  infoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  coordinatesContainer: {
    marginTop: 10,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
  coordinatesLabel: {
    fontSize: 12,
    fontFamily: "Inder",
    marginBottom: 5,
  },
  coordinatesText: {
    fontSize: 14,
    fontFamily: "Inder",
    fontWeight: "500",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  loadingText: {
    fontSize: 16,
    fontFamily: "Inder",
    marginTop: 15,
    textAlign: "center",
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingModal: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 30,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
  loadingModalText: {
    fontSize: 16,
    fontFamily: "Inder",
    marginTop: 15,
    textAlign: "center",
  },
  permissionContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 30,
    alignItems: "center",
    marginVertical: 20,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  permissionEmoji: {
    fontSize: 48,
    marginBottom: 15,
  },
  permissionText: {
    fontSize: 20,
    fontFamily: "Inder",
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 10,
  },
  permissionSubtext: {
    fontSize: 14,
    fontFamily: "Inder",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 25,
  },
  permissionButton: {
    backgroundColor: "#335C67",
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#4A9BB7",
  },
  permissionButtonText: {
    fontSize: 16,
    fontFamily: "Inder",
    fontWeight: "600",
    textAlign: "center",
  },
  statisticsButton: {
    padding: 10,
    borderRadius: 20,
    minWidth: 40,
    minHeight: 40,
    marginTop: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  historyButton: {
    padding: 10,
    borderRadius: 20,
    minWidth: 40,
    minHeight: 40,
    marginTop: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  gpsContainer: {
    position: "absolute",
    top: 10,
    left: "50%",
    marginLeft: -25,
    zIndex: 10,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: 8,
    padding: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  gpsStrengthBars: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginRight: 6,
  },
  gpsBar: {
    width: 3,
    marginHorizontal: 1,
    borderRadius: 1,
  },
  gpsText: {
    fontSize: 10,
    color: "#FFFFFF",
    fontFamily: "Inder",
  },
  mapControlsContainer: {
    position: "absolute",
    top: 20,
    right: 20,
    zIndex: 10,
  },
  mapControlButton: {
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  mapControlButtonText: {
    fontSize: 20,
  },
  coordinatesBox: {
    position: "absolute",
    bottom: 20,
    right: 20,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 12,
    padding: 8,
    minWidth: 100,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.1)",
    zIndex: 15,
  },
  coordinatesBoxText: {
    fontSize: 10,
    fontFamily: "Inder",
    color: "#333",
    fontWeight: "500",
    lineHeight: 12,
  },
  trackingControls: {
    marginTop: 0,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  selectionContainer: {
    marginBottom: 0,
  },
  selectionTitle: {
    fontSize: 18,
    fontFamily: "Inder",
    fontWeight: "600",
    marginTop: 10,
  },
  horizontalScroll: {
    paddingVertical: 10,
    borderRadius: 18,
  },
  selectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    minWidth: 120,
    alignItems: "center",
    borderWidth: 2,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  horseImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginBottom: 8,
  },
  horseImagePlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginBottom: 8,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.1)",
  },
  horseImagePlaceholderIcon: {
    fontSize: 24,
    textAlign: "center",
  },
  selectionCardTitle: {
    fontSize: 16,
    fontFamily: "Inder",
    fontWeight: "600",
    marginBottom: 4,
    textAlign: "center",
    lineHeight: 20,
  },
  selectionCardSubtitle: {
    fontSize: 12,
    fontFamily: "Inder",
  },
  startTrackingButton: {
    backgroundColor: "#335C67",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 6,
    marginTop: 15,
    marginBottom: -20,
  },
  startTrackingButtonText: {
    fontSize: 18,
    fontFamily: "Inder",
    fontWeight: "600",
  },
  trainingDropdown: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    borderWidth: 2,
    borderColor: "#E0E0E0",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  trainingDropdownContent: {
    flex: 1,
  },
  selectedTrainingContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  selectedTrainingText: {
    fontSize: 16,
    fontFamily: "Inder",
    fontWeight: "500",
  },
  placeholderText: {
    fontSize: 16,
    fontFamily: "Inder",
    fontStyle: "italic",
  },
  dropdownArrow: {
    fontSize: 16,
    fontWeight: "bold",
  },
  trainingDropdownList: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginTop: -100,
    borderWidth: 2,
    borderColor: "#E0E0E0",
    height: 450,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  trainingDropdownItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 15,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  trainingItemContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  trainingItemText: {
    fontSize: 16,
    fontFamily: "Inder",
    flex: 1,
  },
  favoriteButton: {
    padding: 8,
    marginLeft: 10,
    minWidth: 32,
    minHeight: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  favoriteIcon: {
    fontSize: 24,
    color: "#FFD700",
  },
  favoritesSeparator: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
    backgroundColor: "#F8F8F8",
  },
  separatorText: {
    fontSize: 12,
    fontFamily: "Inder",
    fontWeight: "500",
    textTransform: "uppercase",
  },
  trackingStatusContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginTop: 25,
    borderWidth: 2,
    borderColor: "#E0E0E0",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
  },
  trackingStatusHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  recordingIndicator: {
    flexDirection: "row",
    alignItems: "center",
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#DC3545",
    marginRight: 8,
  },
  recordingText: {
    fontSize: 14,
    fontFamily: "Inder",
    fontWeight: "600",
    letterSpacing: 1,
  },
  trackingTimer: {
    fontSize: 24,
    fontFamily: "Inder",
    fontWeight: "700",
  },
  trackingStats: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  trackingStatItem: {
    alignItems: "center",
  },
  trackingStatLabel: {
    fontSize: 12,
    fontFamily: "Inder",
    fontWeight: "500",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  trackingStatValue: {
    fontSize: 16,
    fontFamily: "Inder",
    fontWeight: "600",
  },
  trackingStatusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  trackingStatusLabel: {
    fontSize: 14,
    fontFamily: "Inder",
    fontWeight: "500",
  },
  trackingStatusValue: {
    fontSize: 16,
    fontFamily: "Inder",
    fontWeight: "600",
  },
  // High Accuracy Toggle Styles
  highAccuracyContainer: {
    padding: 16,
    marginTop: 10,
    marginBottom: 5,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  highAccuracyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  highAccuracyLabel: {
    fontSize: 16,
    fontFamily: "Inder",
    fontWeight: "600",
    flex: 1,
  },
  infoButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  infoButtonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  toggleSwitch: {
    width: 50,
    height: 26,
    borderRadius: 13,
    padding: 3,
    justifyContent: "center",
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  // Battery Info Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  batteryInfoModal: {
    margin: 20,
    borderRadius: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 8,
    maxWidth: 400,
    alignSelf: "center",
  },
  batteryInfoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  batteryInfoTitle: {
    fontSize: 20,
    fontFamily: "Inder",
    fontWeight: "700",
    flex: 1,
  },
  closeModalButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  closeModalText: {
    fontSize: 18,
    fontWeight: "bold",
  },
  batteryInfoContent: {
    marginBottom: 20,
  },
  batteryInfoText: {
    fontSize: 16,
    fontFamily: "Inder",
    lineHeight: 24,
    marginBottom: 12,
  },
  batteryWarningText: {
    fontSize: 15,
    fontFamily: "Inder",
    fontWeight: "600",
    lineHeight: 22,
    marginBottom: 12,
  },
  batteryRecommendationText: {
    fontSize: 14,
    fontFamily: "Inder",
    lineHeight: 20,
    fontStyle: "italic",
  },
  batteryInfoButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: "center",
  },
  batteryInfoButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Inder",
    fontWeight: "600",
  },
  modalButtonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
    gap: 15,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
  },
  confirmButton: {
    // backgroundColor will be set dynamically
  },
  modalButtonText: {
    fontSize: 16,
    fontFamily: "Inder",
    fontWeight: "600",
  },
  // Camera Controls Styles
  cameraControlsContainer: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
  },
  cameraControlsTitle: {
    fontSize: 16,
    fontFamily: "Inder",
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 15,
  },
  cameraButtonsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  cameraButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    minWidth: 80,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cameraButtonIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  cameraButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "Inder",
    fontWeight: "600",
  },
  mediaCountText: {
    textAlign: "center",
    fontSize: 12,
    fontFamily: "Inder",
    marginTop: 10,
    fontStyle: "italic",
  },

  // Gait Display Styles
  gaitDisplayContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  gaitDisplayEmoji: {
    fontSize: 20,
    marginRight: 6,
  },

  // Gait Legend Styles
  gaitLegendContainer: {
    marginVertical: 12,
    paddingHorizontal: 16,
  },
  gaitLegendTitle: {
    fontSize: 12,
    fontFamily: "Inder",
    fontWeight: "600",
    marginBottom: 8,
    textAlign: "center",
  },
  gaitLegendRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    flexWrap: "wrap",
  },
  gaitLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 4,
    marginVertical: 2,
  },
  gaitColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 4,
  },
  gaitLegendLabel: {
    fontSize: 10,
    fontFamily: "Inder",
    fontWeight: "500",
  },
});

export default MapScreen;
