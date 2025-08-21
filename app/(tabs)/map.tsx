import AsyncStorage from "@react-native-async-storage/async-storage";
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
import { useTheme } from "../../contexts/ThemeContext";
import { HorseAPI } from "../../lib/horseAPI";
import { Horse } from "../../lib/supabase";

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

    // Process all location updates, not just the first one
    if (locations && locations.length > 0) {
      const trackingPoints = locations.map((location: any) => ({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        timestamp: Date.now() + Math.random(), // Add small random to avoid timestamp collisions
        accuracy: location.coords.accuracy,
        speed: location.coords.speed,
      }));

      try {
        // Get existing points
        const existingData = await AsyncStorage.getItem(
          "current_tracking_points"
        );
        const existingPoints = existingData ? JSON.parse(existingData) : [];

        // Add new points
        const updatedPoints = [...existingPoints, ...trackingPoints];

        // Limit stored points to prevent memory issues (keep last 1000 points)
        const limitedPoints = updatedPoints.slice(-1000);

        await AsyncStorage.setItem(
          "current_tracking_points",
          JSON.stringify(limitedPoints)
        );

        console.log(
          "📊 Background locations saved:",
          trackingPoints.length,
          "total:",
          limitedPoints.length
        );
      } catch (error) {
        console.error("Error saving background location:", error);
      }
    }
  }
});

const MapScreen = () => {
  const { currentTheme } = useTheme();
  const { showError } = useDialog();
  const { user } = useAuth();
  const router = useRouter();
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

  const trackingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );
  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(
    null
  );

  useEffect(() => {
    requestLocationPermission();
    // Start watching for location immediately when component mounts
    startLocationWatcher();
    // Request camera and media library permissions
    requestCameraPermissions();
  }, []);

  // Request camera and media library permissions
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
    } catch (error) {
      console.error("Error requesting camera permissions:", error);
      setCameraPermission(false);
      setMediaLibraryPermission(false);
    }
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
            timeInterval: 500, // Update every 500ms for maximum responsiveness
            distanceInterval: 1, // Update every 1 meter movement
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

            // If actively tracking, immediately add point to tracking points
            if (isTracking) {
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

                  // Only add if enough time has passed (500ms) or significant movement (2m)
                  if (timeDiff >= 500 || distance >= 2) {
                    console.log("📍 Real-time tracking point added:", {
                      lat: latitude.toFixed(6),
                      lng: longitude.toFixed(6),
                      accuracy: accuracy?.toFixed(1),
                      speed: speed?.toFixed(1),
                    });
                    return [...prev, trackingPoint];
                  }
                  return prev;
                } else {
                  // First tracking point
                  console.log("📍 First tracking point added");
                  return [trackingPoint];
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

  // Load user's horses
  useEffect(() => {
    const loadUserHorses = async () => {
      if (user?.id) {
        setHorsesLoading(true);
        try {
          const horses = await HorseAPI.getHorses(user.id);
          setUserHorses(horses || []);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          showError(`Failed to load your horses\n\nError: ${errorMessage}`);
        } finally {
          setHorsesLoading(false);
        }
      }
    };

    loadUserHorses();
  }, [user]);

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
          console.log("🧹 Cleaned up background location tracking on unmount");
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

  // Save session to AsyncStorage
  const saveSessionToStorage = async (session: TrainingSession) => {
    try {
      const existingSessions = await AsyncStorage.getItem("training_sessions");
      const sessions: TrainingSession[] = existingSessions
        ? JSON.parse(existingSessions)
        : [];

      sessions.push(session);
      await AsyncStorage.setItem("training_sessions", JSON.stringify(sessions));
    } catch (error) {
      throw error;
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

      const notificationContent = {
        title: "🐎 GPS Tracking Active",
        body: `${horseName} • ${trainingType}\nElapsed time: ${timeString}`,
        data: {
          type: "tracking",
          startTime,
          horseName,
          trainingType,
        },
        categoryIdentifier: "tracking",
        priority: Notifications.AndroidNotificationPriority.HIGH,
        sticky: true,
      };

      if (notificationId) {
        // Update existing notification
        await Notifications.dismissNotificationAsync(notificationId);
      }

      const identifier = await Notifications.scheduleNotificationAsync({
        content: notificationContent,
        trigger: null, // Show immediately
        identifier: TRACKING_NOTIFICATION_IDENTIFIER,
      });

      setNotificationId(identifier);
      return identifier;
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

      console.log("✅ Tracking notification stopped and dismissed");
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
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationPermission(false);
        showError(
          "Location permission is required to show your position on the map."
        );
        return;
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
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
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
      console.log("🔐 Requesting background location permission...");
      const { status } = await Location.requestBackgroundPermissionsAsync();
      console.log("🔐 Background permission status:", status);

      if (status !== "granted") {
        console.log("❌ Background location permission denied");
        showError(
          "Background location permission is required for continuous tracking when screen is off"
        );
        return;
      }

      console.log("✅ Background location permission granted");

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
      setSessionMedia([]); // Initialize empty media array for the session

      // Restart location watcher with optimized settings for tracking
      await restartLocationWatcherForTracking();

      // Start background location tracking
      console.log("📍 Starting background location tracking...");

      // Clear any existing tracking points in storage
      await AsyncStorage.removeItem("current_tracking_points");

      // Ensure the task is not already running
      const isAlreadyRunning = await Location.hasStartedLocationUpdatesAsync(
        LOCATION_TASK_NAME
      );
      if (isAlreadyRunning) {
        console.log(
          "⚠️ Background location task already running, stopping first..."
        );
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      }

      // Start background location tracking
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: highAccuracyMode ? 250 : 1000, // Update every 250ms in high accuracy mode, 1 second otherwise
        distanceInterval: 1, // Update every 1 meter movement
        deferredUpdatesInterval: highAccuracyMode ? 250 : 1000,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: "EquiHUB GPS Tracking",
          notificationBody: highAccuracyMode
            ? "Ultra-high accuracy tracking active"
            : "High precision tracking active",
          notificationColor: "#4A90E2",
        },
      });

      console.log("✅ Background location tracking started successfully");

      // Set up a timer to sync background data with the app state
      const syncInterval = setInterval(
        async () => {
          try {
            // Check if the background task is still running
            const isStillRunning =
              await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
            if (!isStillRunning) {
              console.warn("⚠️ Background location task stopped unexpectedly");
              // Don't automatically restart - let user know there was an issue
              return;
            }

            const backgroundData = await AsyncStorage.getItem(
              "current_tracking_points"
            );
            if (backgroundData) {
              const backgroundPoints = JSON.parse(backgroundData);
              if (backgroundPoints.length > 0) {
                setTrackingPoints((prev) => {
                  // Merge with existing points, avoiding duplicates
                  const existingTimestamps = new Set(
                    prev.map((p) => p.timestamp)
                  );
                  const newPoints = backgroundPoints.filter(
                    (p: TrackingPoint) => !existingTimestamps.has(p.timestamp)
                  );

                  if (newPoints.length > 0) {
                    console.log(
                      "📊 Syncing background points:",
                      newPoints.length
                    );
                    // Update current location to the most recent point
                    const latestPoint = newPoints[newPoints.length - 1];
                    setUserLocation({
                      latitude: latestPoint.latitude,
                      longitude: latestPoint.longitude,
                    });

                    // Update GPS strength
                    const strength = calculateGpsStrength(latestPoint.accuracy);
                    setGpsStrength(strength);

                    // Clear processed background data to prevent memory buildup
                    AsyncStorage.removeItem("current_tracking_points");
                  }

                  return [...prev, ...newPoints];
                });
              }
            }
          } catch (error) {
            console.error("Error syncing background data:", error);
          }
        },
        highAccuracyMode ? 500 : 1000
      ); // Sync every 500ms in high accuracy mode, 1 second otherwise

      // Store the sync interval reference for cleanup
      trackingIntervalRef.current = syncInterval;

      // Start tracking notification
      console.log("📱 Starting tracking notification...");
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
      console.log("📱 Stopping tracking notification...");
      await stopTrackingNotification();

      // Stop background location tracking
      console.log("🛑 Stopping background location tracking...");

      // Check if the task is actually running before trying to stop it
      const isTaskRunning = await Location.hasStartedLocationUpdatesAsync(
        LOCATION_TASK_NAME
      );
      if (isTaskRunning) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        console.log("✅ Background location task stopped successfully");
      } else {
        console.log("ℹ️ Background location task was not running");
      }

      // Stop sync interval
      if (trackingIntervalRef.current) {
        clearInterval(trackingIntervalRef.current);
        trackingIntervalRef.current = null;
      }

      // Get final background data before stopping
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
            return [...prev, ...newPoints];
          });
        }
      }

      // Clean up storage
      await AsyncStorage.removeItem("current_tracking_points");

      console.log("✅ Background location tracking stopped successfully");

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

      const completedSession: TrainingSession = {
        ...currentSession,
        endTime,
        duration,
        distance: totalDistance,
        path: trackingPoints,
        averageSpeed,
        maxSpeed,
        media: sessionMedia, // Include captured media
      };

      // Save session to storage
      await saveSessionToStorage(completedSession);

      // Reset tracking state
      setIsTracking(false);
      setCurrentSession(null);
      setSessionStartTime(null);
      setTrackingPoints([]);
      setSessionMedia([]); // Reset media array

      // Restart location watcher with normal settings
      await startLocationWatcher();

      // Show completion alert
      Alert.alert(
        "Session Completed",
        `Training session completed!\n\nDuration: ${Math.floor(
          duration / 60
        )}m ${duration % 60}s\nDistance: ${(totalDistance / 1000).toFixed(
          2
        )} km\nAverage Speed: ${(averageSpeed * 3.6).toFixed(1)} km/h`,
        [
          {
            text: "View Details",
            onPress: () =>
              router.push({
                pathname: "/session-details",
                params: { sessionId: completedSession.id },
              }),
          },
          {
            text: "Back to Map",
          },
        ]
      );
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
            timeInterval: highAccuracyMode ? 250 : 500, // Ultra-fast updates during tracking
            distanceInterval: 0.5, // Update every 0.5 meters during tracking
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
                  console.log("🎯 High-speed tracking point:", {
                    lat: latitude.toFixed(7),
                    lng: longitude.toFixed(7),
                    accuracy: accuracy?.toFixed(1),
                    speed: speed?.toFixed(2),
                    timeDiff: timeDiff,
                    distance: distance.toFixed(1),
                  });
                  return [...prev, trackingPoint];
                }
                return prev;
              } else {
                console.log("🎯 Starting high-speed tracking");
                return [trackingPoint];
              }
            });
          }
        );

        locationSubscriptionRef.current = subscription;
        console.log("🚀 High-speed location tracking activated");
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
            <Text style={styles.header}>Map</Text>
            <TouchableOpacity
              style={styles.historyButton}
              onPress={() => router.push("/sessions")}
            >
              <Text style={styles.historyButtonText}>📜</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
        <View
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
        </View>
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
          <Text style={styles.header}>Map</Text>
          <TouchableOpacity
            style={styles.historyButton}
            onPress={() => router.push("/sessions")}
          >
            <Text style={styles.historyButtonText}>📜</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <View
        style={[
          styles.viewPort,
          { backgroundColor: currentTheme.colors.surface },
        ]}
      >
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
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
                  Allow location access to see your position and nearby
                  equestrian facilities.
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
                      🥾
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
                {/* Show tracking path */}
                {trackingPoints.length > 1 && (
                  <Polyline
                    coordinates={trackingPoints.map((point) => ({
                      latitude: point.latitude,
                      longitude: point.longitude,
                    }))}
                    strokeColor={currentTheme.colors.primary}
                    strokeWidth={4}
                  />
                )}

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
                              {getSortedTrainingTypes().map(
                                (training, index) => {
                                  const isFirstNonFavorite =
                                    favoriteTrainingTypes.length > 0 &&
                                    index === favoriteTrainingTypes.length &&
                                    !favoriteTrainingTypes.includes(
                                      training.id
                                    );

                                  return (
                                    <View key={training.id}>
                                      {isFirstNonFavorite && (
                                        <View style={styles.favoritesSeparator}>
                                          <Text
                                            style={[
                                              styles.separatorText,
                                              {
                                                color:
                                                  currentTheme.colors
                                                    .textSecondary,
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
                                              selectedTrainingType ===
                                              training.id
                                                ? currentTheme.colors.primary +
                                                  "20"
                                                : "transparent",
                                          },
                                        ]}
                                        onPress={() => {
                                          setSelectedTrainingType(training.id);
                                          setTrainingDropdownVisible(false);
                                        }}
                                        activeOpacity={0.7}
                                      >
                                        <View
                                          style={styles.trainingItemContent}
                                        >
                                          <Text
                                            style={[
                                              styles.trainingItemText,
                                              {
                                                color:
                                                  selectedTrainingType ===
                                                  training.id
                                                    ? currentTheme.colors
                                                        .primary
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
                                }
                              )}
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
                            location updates by checking your position every
                            250ms and capturing movement down to 0.5 meters.
                            Normal mode updates every 500ms with 1-meter
                            precision.
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
                          <Text style={styles.batteryInfoButtonText}>
                            Got it
                          </Text>
                        </TouchableOpacity>
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
                      onPress={() => setHighAccuracyMode(!highAccuracyMode)}
                      disabled={isTracking}
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

              {/* Start/Stop Tracking Button */}
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
                      <Text
                        style={[styles.recordingText, { color: "#DC3545" }]}
                      >
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
                        {(
                          calculateTotalDistance(trackingPoints) / 1000
                        ).toFixed(2)}{" "}
                        km
                      </Text>
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
      </View>

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
    position: "relative",
    marginBottom: -33,
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
  scrollContainer: {
    flex: 1,
    marginBottom: 80,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 30,
  },
  mapContainer: {
    flex: 1,
    paddingHorizontal: 20,
    marginTop: 5,
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
  historyButton: {
    position: "absolute",
    right: 20,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    width: 40,
    height: 40,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 20,
  },
  historyButtonText: {
    fontSize: 20,
    color: "#FFFFFF",
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
    paddingVertical: 5,
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
    marginTop: 25,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 6,
    marginBottom: 0,
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
});

export default MapScreen;
