import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
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
import { useAuth } from "../../contexts/AuthContext";
import { useDialog } from "../../contexts/DialogContext";
import { useMetric } from "../../contexts/MetricContext";
import { useTheme } from "../../contexts/ThemeContext";
import { HorseAPI } from "../../lib/horseAPI";
import PaymentService from "../../lib/paymentService";
import { Horse } from "../../lib/supabase";

// Dropdown options
const genderOptions = ["Stallion", "Mare", "Gelding", "Filly", "Colt"];

const breedOptions = [
  "Arabian",
  "Thoroughbred",
  "Quarter Horse",
  "Paint Horse",
  "Appaloosa",
  "Friesian",
  "Clydesdale",
  "Percheron",
  "Belgian",
  "Shire",
  "Mustang",
  "Morgan",
  "Tennessee Walker",
  "Standardbred",
  "Andalusian",
  "Hanoverian",
  "Warmblood",
  "Lipicai",
  "Magyar Sportló",
  "Shagya Araber",
  "Gidran",
  "Nonius",
  "Furioso-North Star",
  "Shitlandi póni",
  "Shetland Pony",
  "Welsh Pony",
  "Haflinger",
  "Icelandic Horse",
  "Fjord",
  "Akhal-Teke",
  "Barb",
  "Lusitano",
  "Paso Fino",
  "Criollo",
  "Mangalarga",
  "Camargue",
  "Connemara",
  "Dartmoor",
  "Exmoor",
  "New Forest",
  "Fell Pony",
  "Dales Pony",
  "Highland Pony",
  "Eriskay Pony",
  "Przewalski's Horse",
  "Døle Gudbrandsdal",
  "Nordlandshest",
  "Finnhorse",
  "Gotland Pony",
  "Östermalm",
  "Žemaitukas",
  "Estonian Native",
  "Latvian",
  "Trakehner",
  "Oldenburg",
  "Holstein",
  "Württemberger",
  "Bavarian Warmblood",
  "Rheinland-Pfalz-Saar",
  "Brandenburger",
  "Mecklenburg",
  "Sachsen-Anhaltiner",
  "Thüringer",
  "Other",
];

const MyHorsesScreen = () => {
  const { user, loading: authLoading } = useAuth();
  const { currentTheme } = useTheme();
  const { showError, showDelete, showConfirm } = useDialog();
  const {
    formatHeight,
    formatWeight,
    formatHeightUnit,
    formatWeightUnit,
    metricSystem,
  } = useMetric();
  const [refreshing, setRefreshing] = useState(false);
  const [horses, setHorses] = useState<Horse[]>([]);
  const [loading, setLoading] = useState(false);
  const [horsesLoaded, setHorsesLoaded] = useState(false);

  // PRO membership state
  const [isProMember, setIsProMember] = useState(false);
  const [checkingProStatus, setCheckingProStatus] = useState(false);

  // Edit modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingHorse, setEditingHorse] = useState<any>(null);
  const [editName, setEditName] = useState("");
  const [editGender, setEditGender] = useState("");
  const [editYear, setEditYear] = useState("");
  const [editHeight, setEditHeight] = useState("");
  const [editWeight, setEditWeight] = useState("");
  const [editBreed, setEditBreed] = useState("");
  const [editBirthDate, setEditBirthDate] = useState<Date | null>(null);

  // Add horse modal state
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addName, setAddName] = useState("");
  const [addGender, setAddGender] = useState("");
  const [addHeight, setAddHeight] = useState("");
  const [addWeight, setAddWeight] = useState("");
  const [addBreed, setAddBreed] = useState("");
  const [addBirthDate, setAddBirthDate] = useState<Date | null>(null);
  const [addImage, setAddImage] = useState<any>(null);

  // Dropdown state
  const [genderDropdownVisible, setGenderDropdownVisible] = useState(false);
  const [breedDropdownVisible, setBreedDropdownVisible] = useState(false);

  // Add modal dropdown state
  const [addGenderDropdownVisible, setAddGenderDropdownVisible] =
    useState(false);
  const [addBreedDropdownVisible, setAddBreedDropdownVisible] = useState(false);

  // Number picker state
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [heightPickerVisible, setHeightPickerVisible] = useState(false);

  // Add modal picker state
  const [addDatePickerVisible, setAddDatePickerVisible] = useState(false);
  const [addHeightPickerVisible, setAddHeightPickerVisible] = useState(false);

  // Success modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Image picker state
  const [editImage, setEditImage] = useState<any>(null);
  const [showImagePickerModal, setShowImagePickerModal] = useState(false);

  // Vaccination reminder state
  const [vaccinationModalVisible, setVaccinationModalVisible] = useState(false);
  const [selectedHorseForVaccination, setSelectedHorseForVaccination] =
    useState<Horse | null>(null);
  const [vaccinationName, setVaccinationName] = useState("");
  const [vaccinationDate, setVaccinationDate] = useState<Date | null>(null);
  const [vaccinationNotes, setVaccinationNotes] = useState("");
  const [showVaccinationDatePicker, setShowVaccinationDatePicker] =
    useState(false);
  const [horseVaccinations, setHorseVaccinations] = useState<{
    [horseId: string]: any[];
  }>({});

  // Load horses when user is authenticated - from cache first, API only on refresh
  useEffect(() => {
    // Add a timeout to prevent getting stuck in loading state
    const loadingTimeout = setTimeout(() => {
      if (loading) {
        setLoading(false);
      }
    }, 15000); // 15 second timeout

    if (!authLoading && user?.id && !loading && !horsesLoaded) {
      // Load from cache first on startup
      loadHorsesFromCache(user.id);
    } else if (!authLoading && !user?.id) {
      // User is not authenticated, set loading to false
      setLoading(false);
      setHorsesLoaded(false);
    }

    return () => {
      clearTimeout(loadingTimeout);
    };
  }, [user, authLoading, loading, horsesLoaded]);

  // Add timeout fallback for auth loading
  useEffect(() => {
    const authTimeout = setTimeout(() => {
      if (authLoading) {
        // Auth loading timeout - just log for debugging
      }
    }, 20000); // 20 second timeout for auth

    return () => {
      clearTimeout(authTimeout);
    };
  }, [authLoading]);

  // Check PRO membership when user is available
  const checkProMembership = useCallback(async () => {
    if (!user?.id) {
      setIsProMember(false);
      return;
    }

    setCheckingProStatus(true);
    try {
      // Use PaymentService to get pro status directly from database
      const proStatus = await PaymentService.isProMember();
      setIsProMember(proStatus);
    } catch (error) {
      console.error("Error checking pro membership:", error);
      // Default to non-Pro if everything fails
      setIsProMember(false);
    } finally {
      setCheckingProStatus(false);
    }
  }, [user?.id]);

  // Check pro membership only once per user session
  useEffect(() => {
    if (user?.id) {
      checkProMembership();
    }
  }, [user?.id]); // Only depend on user?.id changing

  // Load horses from local cache (for startup)
  const loadHorsesFromCache = async (userId: string) => {
    try {
      setLoading(true);
      console.log("📱 Loading horses from local cache...");

      // Try to load horses from AsyncStorage
      const cachedHorsesData = await AsyncStorage.getItem(
        `user_horses_${userId}`
      );

      if (cachedHorsesData) {
        const lightweightHorses = JSON.parse(cachedHorsesData);
        console.log("✅ Found", lightweightHorses.length, "horses in cache");

        // Load images separately and merge with metadata
        const horsesWithImages = await Promise.all(
          lightweightHorses.map(async (horse: any) => {
            try {
              const cachedImageData = await AsyncStorage.getItem(
                `horse_image_${horse.id}`
              );
              if (cachedImageData) {
                const imageData = JSON.parse(cachedImageData);
                return {
                  ...horse,
                  image_url: imageData.image_url,
                  image_base64: imageData.image_base64,
                };
              }
              return horse;
            } catch (error) {
              console.warn(
                `⚠️ Failed to load image for horse ${horse.id}:`,
                error
              );
              return horse;
            }
          })
        );

        setHorses(horsesWithImages);
        setHorsesLoaded(true);
        console.log("✅ Horses loaded from cache successfully");
      } else {
        console.log(
          "📭 No cached horses found, will need to refresh to load data"
        );
        // No cached data - show empty state but don't make API call
        setHorses([]);
        setHorsesLoaded(true);
      }
    } catch (error) {
      console.error("❌ Error loading horses from cache:", error);
      // On cache error, show empty state
      setHorses([]);
      setHorsesLoaded(true);
    } finally {
      setLoading(false);
    }
  };

  // Load horses from API (for refresh and after updates)
  const loadHorsesFromAPI = async (userId: string) => {
    try {
      setLoading(true);
      console.log("🌐 Loading horses from API...");

      // Add timeout to detect hanging API calls
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error("API call timeout after 10 seconds")),
          10000
        );
      });

      const apiPromise = HorseAPI.getHorses(userId);

      const horsesData = await Promise.race([apiPromise, timeoutPromise]);

      // Ensure we have valid array data
      if (Array.isArray(horsesData)) {
        setHorses(horsesData);

        // Store horses in AsyncStorage for future cache loads
        try {
          // Store horse metadata separately from images to prevent cursor window errors
          const lightweightHorses = horsesData.map((horse) => ({
            ...horse,
            image_url: undefined,
            image_base64: undefined,
          }));

          await AsyncStorage.setItem(
            `user_horses_${userId}`,
            JSON.stringify(lightweightHorses)
          );
          console.log(
            "✅ Horses metadata stored in AsyncStorage for offline use"
          );

          // Store images separately with individual keys
          for (const horse of horsesData) {
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
                console.log(`📸 Stored image for horse: ${horse.name}`);
              } catch (imageError) {
                console.warn(
                  `⚠️ Failed to store image for horse ${horse.name}:`,
                  imageError
                );
                // Continue - image storage failure shouldn't break the flow
              }
            }
          }
        } catch (storageError) {
          console.warn(
            "⚠️ Failed to store horses in AsyncStorage:",
            storageError
          );
          // Continue execution - storage failure shouldn't break the app
        }

        console.log("✅ Horses loaded from API and cached successfully");
      } else {
        setHorses([]);
      }

      setHorsesLoaded(true);
    } catch (error) {
      console.error("❌ Error loading horses from API:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Set empty array on error to prevent UI issues
      setHorses([]);
      setHorsesLoaded(true);

      if (errorMessage.includes("timeout")) {
        showError(
          "The request took too long. Please check your internet connection."
        );
      } else {
        showError("Failed to load horses from server");
      }
    } finally {
      setLoading(false);
    }
  };

  const loadHorses = async (userId: string) => {
    // Backward compatibility - calls the API version
    await loadHorsesFromAPI(userId);
  };

  const onRefresh = async () => {
    if (user?.id) {
      setRefreshing(true);
      setHorsesLoaded(false); // Reset the loaded flag to allow reloading

      try {
        // Clear cached horses to force fresh API data on all screens
        await AsyncStorage.removeItem(`user_horses_${user.id}`);

        // Clear individual horse image caches
        const allKeys = await AsyncStorage.getAllKeys();
        const horseImageKeys = allKeys.filter((key) =>
          key.startsWith("horse_image_")
        );
        if (horseImageKeys.length > 0) {
          await AsyncStorage.multiRemove(horseImageKeys);
        }

        // Set a refresh timestamp to notify other screens
        await AsyncStorage.setItem(
          "horses_refresh_timestamp",
          Date.now().toString()
        );

        // On refresh, use API to get fresh data
        await loadHorsesFromAPI(user.id);

        // Also refresh pro membership status
        await checkProMembership();
      } catch (error) {
        console.error("Error during horses refresh:", error);
      } finally {
        setRefreshing(false);
      }
    }
  };

  const openEditModal = (horse: Horse) => {
    setEditingHorse(horse);
    setEditName(horse.name);
    setEditGender(horse.gender);
    setEditHeight(horse.height.toString());
    setEditWeight(horse.weight ? horse.weight.toString() : "");
    setEditBreed(horse.breed);
    // Check if image_url contains base64 data or is a regular URL
    setEditImage(horse.image_url ? { uri: horse.image_url } : null);

    // Set birth date
    if (horse.birth_date) {
      setEditBirthDate(new Date(horse.birth_date));
    } else {
      setEditBirthDate(null);
    }

    // Reset dropdown states
    setGenderDropdownVisible(false);
    setBreedDropdownVisible(false);
    setDatePickerVisible(false);
    setHeightPickerVisible(false);
    setShowImagePickerModal(false);
    setEditModalVisible(true);
  };

  const closeEditModal = () => {
    setEditModalVisible(false);
    setEditingHorse(null);
    setEditName("");
    setEditGender("");
    setEditYear("");
    setEditHeight("");
    setEditWeight("");
    setEditBreed("");
    setEditImage(null);
    setEditBirthDate(null);
    setGenderDropdownVisible(false);
    setBreedDropdownVisible(false);
    setDatePickerVisible(false);
    setHeightPickerVisible(false);
    setShowImagePickerModal(false);
  };

  const openAddModal = () => {
    // Check horse limit for non-PRO users
    if (!isProMember && horses.length >= 2) {
      showConfirm(
        "Horse Limit Reached",
        "Free users can only add up to 2 horses. Upgrade to PRO for unlimited horses!",
        () => {
          // Navigate to subscription page
          router.push("/subscription");
        }
      );
      return;
    }

    setAddName("");
    setAddGender("");
    setAddHeight("");
    setAddWeight("");
    setAddBreed("");
    setAddBirthDate(null);
    setAddImage(null);
    setAddGenderDropdownVisible(false);
    setAddBreedDropdownVisible(false);
    setAddDatePickerVisible(false);
    setAddHeightPickerVisible(false);
    setShowImagePickerModal(false);
    setAddModalVisible(true);
  };

  const closeAddModal = () => {
    setAddModalVisible(false);
    setAddName("");
    setAddGender("");
    setAddHeight("");
    setAddWeight("");
    setAddBreed("");
    setAddBirthDate(null);
    setAddImage(null);
    setAddGenderDropdownVisible(false);
    setAddBreedDropdownVisible(false);
    setAddDatePickerVisible(false);
    setAddHeightPickerVisible(false);
    setShowImagePickerModal(false);
  };

  const saveHorseEdit = async () => {
    if (!user?.id || !editingHorse) {
      showError("User not authenticated");
      return;
    }

    // Validation logic (same as before)
    const normalizedName = editName.normalize("NFC").trim();
    const normalizedGender = editGender.normalize("NFC").trim();
    const normalizedBreed = editBreed.normalize("NFC").trim();
    const normalizedHeight = editHeight.trim();
    const normalizedWeight = editWeight.trim();

    if (
      !normalizedName ||
      !normalizedGender ||
      !editBirthDate ||
      !normalizedHeight ||
      !normalizedBreed
    ) {
      showError("Please fill in all required fields");
      return;
    }

    const namePattern = /^[\p{L}\p{M}\s\-'\.]+$/u;
    if (!namePattern.test(normalizedName)) {
      showError("Horse name contains invalid characters");
      return;
    }

    if (normalizedName.length < 2 || normalizedName.length > 50) {
      showError("Horse name must be between 2 and 50 characters");
      return;
    }

    const currentDate = new Date();
    const minDate = new Date(1980, 0, 1);
    if (editBirthDate < minDate || editBirthDate > currentDate) {
      showError("Please enter a valid birth date");
      return;
    }

    const heightNum = parseInt(normalizedHeight);
    if (isNaN(heightNum) || heightNum < 50 || heightNum > 250) {
      const heightUnit = metricSystem === "metric" ? "cm" : "inches";
      const minHeight = metricSystem === "metric" ? "50" : "20";
      const maxHeight = metricSystem === "metric" ? "250" : "98";
      showError(
        `Please enter a valid height (${minHeight}-${maxHeight} ${heightUnit})`
      );
      return;
    }

    let weightNum = null; // Use null instead of undefined for proper deletion
    if (normalizedWeight) {
      weightNum = parseInt(normalizedWeight);
      if (isNaN(weightNum) || weightNum < 50 || weightNum > 2000) {
        const weightUnit = metricSystem === "metric" ? "kg" : "lbs";
        const minWeight = metricSystem === "metric" ? "50" : "110";
        const maxWeight = metricSystem === "metric" ? "2000" : "4400";
        showError(
          `Please enter a valid weight (${minWeight}-${maxWeight} ${weightUnit})`
        );
        return;
      }
    }

    try {
      setLoading(true);

      const updates = {
        name: normalizedName,
        gender: normalizedGender,
        birth_date: editBirthDate.toISOString(),
        height: heightNum,
        weight: weightNum, // This will be null if weight field is cleared
        breed: normalizedBreed,
        image:
          editImage && editImage.uri !== editingHorse.image_url
            ? editImage
            : undefined,
      };

      const updatedHorse = await HorseAPI.updateHorse(
        editingHorse.id,
        user?.id,
        updates
      );

      if (updatedHorse) {
        setHorsesLoaded(false); // Reset flag to allow reloading
        await loadHorsesFromAPI(user?.id); // Refresh from API after update
        closeEditModal();

        // Notify other screens about the horse update
        await AsyncStorage.setItem(
          "horses_refresh_timestamp",
          Date.now().toString()
        );

        // Check if image was provided but not saved
        if (
          editImage &&
          editImage.uri !== editingHorse.image_url &&
          !updatedHorse.image_url
        ) {
          setSuccessMessage(
            `${normalizedName} has been updated! (Note: Image processing failed, but other changes were saved)`
          );
        } else {
          setSuccessMessage(`${normalizedName} has been updated!`);
        }
        setShowSuccessModal(true);
      } else {
        showError("Failed to update horse");
      }
    } catch (error) {
      console.error("Error updating horse:", error);
      showError("Failed to update horse");
    } finally {
      setLoading(false);
    }
  };

  const saveHorseAdd = async () => {
    if (!user?.id) {
      showError("Please log in again to add horses");
      return;
    }

    // Validation logic (same as before)
    const normalizedName = addName.normalize("NFC").trim();
    const normalizedGender = addGender.normalize("NFC").trim();
    const normalizedBreed = addBreed.normalize("NFC").trim();
    const normalizedHeight = addHeight.trim();
    const normalizedWeight = addWeight.trim();

    if (
      !normalizedName ||
      !normalizedGender ||
      !addBirthDate ||
      !normalizedHeight ||
      !normalizedBreed
    ) {
      showError("Please fill in all required fields");
      return;
    }

    const namePattern = /^[\p{L}\p{M}\s\-'\.]+$/u;
    if (!namePattern.test(normalizedName)) {
      showError("Horse name contains invalid characters");
      return;
    }

    if (normalizedName.length < 2 || normalizedName.length > 50) {
      showError("Horse name must be between 2 and 50 characters");
      return;
    }

    const currentDate = new Date();
    const minDate = new Date(1980, 0, 1);
    if (addBirthDate < minDate || addBirthDate > currentDate) {
      showError("Please enter a valid birth date");
      return;
    }

    const heightNum = parseInt(normalizedHeight);
    if (isNaN(heightNum) || heightNum < 50 || heightNum > 250) {
      const heightUnit = metricSystem === "metric" ? "cm" : "inches";
      const minHeight = metricSystem === "metric" ? "50" : "20";
      const maxHeight = metricSystem === "metric" ? "250" : "98";
      showError(
        `Please enter a valid height (${minHeight}-${maxHeight} ${heightUnit})`
      );
      return;
    }

    let weightNum = null; // Use null instead of undefined for consistency
    if (normalizedWeight) {
      weightNum = parseInt(normalizedWeight);
      if (isNaN(weightNum) || weightNum < 50 || weightNum > 2000) {
        const weightUnit = metricSystem === "metric" ? "kg" : "lbs";
        const minWeight = metricSystem === "metric" ? "50" : "110";
        const maxWeight = metricSystem === "metric" ? "2000" : "4400";
        showError(
          `Please enter a valid weight (${minWeight}-${maxWeight} ${weightUnit})`
        );
        return;
      }
    }

    try {
      setLoading(true);

      const horseData = {
        name: normalizedName,
        gender: normalizedGender,
        birth_date: addBirthDate.toISOString(),
        height: heightNum,
        weight: weightNum,
        breed: normalizedBreed,
        image: addImage,
      };

      const newHorse = await HorseAPI.addHorse(user?.id, horseData);

      if (newHorse) {
        setHorsesLoaded(false); // Reset flag to allow reloading
        await loadHorsesFromAPI(user?.id); // Refresh from API after add
        closeAddModal();

        // Notify other screens about the horse addition
        await AsyncStorage.setItem(
          "horses_refresh_timestamp",
          Date.now().toString()
        );

        // Check if image was provided but not saved
        if (addImage && !newHorse.image_url) {
          setSuccessMessage(
            `${normalizedName} has been added! (Note: Image processing failed, but horse was saved successfully)`
          );
        } else {
          setSuccessMessage(`${normalizedName} has been added!`);
        }
        setShowSuccessModal(true);
      } else {
        showError("Failed to add horse. Please try again.");
      }
    } catch (error) {
      console.error("Error adding horse:", error);
      showError(
        "Failed to add horse. Please check your connection and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const deleteHorse = (horse: Horse) => {
    showDelete(horse.name, async () => {
      if (!user?.id) {
        showError("User not authenticated");
        return;
      }

      try {
        setLoading(true);
        console.log(
          `🔥 Starting delete for horse: ${horse.name} (ID: ${horse.id})`
        );

        const success = await HorseAPI.deleteHorse(horse.id, user?.id);

        if (success) {
          console.log(`🔥 Delete successful for horse: ${horse.name}`);

          // Immediately remove the horse from the local state for instant UI feedback
          setHorses((prevHorses) =>
            prevHorses.filter((h) => h.id !== horse.id)
          );

          // Clean up cached data for deleted horse
          try {
            await AsyncStorage.removeItem(`horse_image_${horse.id}`);
            console.log(
              `🗑️ Removed cached image for deleted horse: ${horse.name}`
            );
          } catch (cacheError) {
            console.warn(
              `⚠️ Failed to remove cached image for ${horse.name}:`,
              cacheError
            );
          }

          // Add a small delay to ensure the delete has been processed on the server
          await new Promise((resolve) => setTimeout(resolve, 500));

          // Then reload to ensure data consistency
          setHorsesLoaded(false); // Reset flag to allow reloading
          await loadHorsesFromAPI(user?.id); // Refresh from API after delete

          // Notify other screens about the horse deletion
          await AsyncStorage.setItem(
            "horses_refresh_timestamp",
            Date.now().toString()
          );

          setSuccessMessage(`${horse.name} has been deleted`);
          setShowSuccessModal(true);
        } else {
          console.log(`🔥 Delete failed for horse: ${horse.name}`);
          showError("Failed to delete horse");
        }
      } catch (error) {
        console.error("Error deleting horse:", error);
        showError("Failed to delete horse");
      } finally {
        setLoading(false);
      }
    });
  };

  // Image picker functions
  const pickImageFromLibrary = async () => {
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      showError("Permission to access camera roll is required!");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: false,
    });

    if (!result.canceled && result.assets[0]) {
      const newImage = { uri: result.assets[0].uri };
      if (editModalVisible) {
        setEditImage(newImage);
      } else if (addModalVisible) {
        setAddImage(newImage);
      }
      setShowImagePickerModal(false);
    }
  };

  const takePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

    if (permissionResult.granted === false) {
      showError("Permission to access camera is required!");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: false,
    });

    if (!result.canceled && result.assets[0]) {
      const newImage = { uri: result.assets[0].uri };
      if (editModalVisible) {
        setEditImage(newImage);
      } else if (addModalVisible) {
        setAddImage(newImage);
      }
      setShowImagePickerModal(false);
    }
  };

  // Vaccination reminder functions
  const loadVaccinationReminders = async () => {
    try {
      const savedVaccinations = await AsyncStorage.getItem(
        `vaccination_reminders_${user?.id}`
      );
      if (savedVaccinations) {
        setHorseVaccinations(JSON.parse(savedVaccinations));
      }
    } catch (error) {
      console.error("Error loading vaccination reminders:", error);
    }
  };

  const saveVaccinationReminders = async (vaccinations: {
    [horseId: string]: any[];
  }) => {
    try {
      await AsyncStorage.setItem(
        `vaccination_reminders_${user?.id}`,
        JSON.stringify(vaccinations)
      );
      setHorseVaccinations(vaccinations);
    } catch (error) {
      console.error("Error saving vaccination reminders:", error);
      showError("Failed to save vaccination reminder");
    }
  };

  const openVaccinationModal = (horse: Horse) => {
    setSelectedHorseForVaccination(horse);
    setVaccinationName("");
    setVaccinationDate(null);
    setVaccinationNotes("");
    setShowVaccinationDatePicker(false);
    setVaccinationModalVisible(true);
  };

  const closeVaccinationModal = () => {
    setVaccinationModalVisible(false);
    setSelectedHorseForVaccination(null);
    setVaccinationName("");
    setVaccinationDate(null);
    setVaccinationNotes("");
    setShowVaccinationDatePicker(false);
  };

  const saveVaccinationReminder = async () => {
    if (
      !selectedHorseForVaccination ||
      !vaccinationName.trim() ||
      !vaccinationDate
    ) {
      showError("Please fill in all required fields");
      return;
    }

    const newVaccination = {
      id: Date.now().toString(),
      name: vaccinationName.trim(),
      date: vaccinationDate.toISOString(),
      notes: vaccinationNotes.trim(),
      createdAt: new Date().toISOString(),
    };

    const updatedVaccinations = { ...horseVaccinations };
    if (!updatedVaccinations[selectedHorseForVaccination.id]) {
      updatedVaccinations[selectedHorseForVaccination.id] = [];
    }
    updatedVaccinations[selectedHorseForVaccination.id].push(newVaccination);

    await saveVaccinationReminders(updatedVaccinations);

    // Schedule notifications for the new vaccination
    await scheduleVaccinationNotifications(
      newVaccination,
      selectedHorseForVaccination.name
    );

    closeVaccinationModal();
    setSuccessMessage(
      `Vaccination reminder set for ${selectedHorseForVaccination.name}`
    );
    setShowSuccessModal(true);
  };

  const deleteVaccinationReminder = async (
    horseId: string,
    vaccinationId: string
  ) => {
    // Cancel notifications first
    await cancelVaccinationNotifications(vaccinationId);

    const updatedVaccinations = { ...horseVaccinations };
    if (updatedVaccinations[horseId]) {
      updatedVaccinations[horseId] = updatedVaccinations[horseId].filter(
        (v) => v.id !== vaccinationId
      );
      if (updatedVaccinations[horseId].length === 0) {
        delete updatedVaccinations[horseId];
      }
    }
    await saveVaccinationReminders(updatedVaccinations);
  };

  const getUpcomingVaccinations = (horseId: string) => {
    const vaccinations = horseVaccinations[horseId] || [];
    const now = new Date();
    return vaccinations.filter((v) => new Date(v.date) >= now);
  };

  const getOverdueVaccinations = (horseId: string) => {
    const vaccinations = horseVaccinations[horseId] || [];
    const now = new Date();
    return vaccinations.filter((v) => new Date(v.date) < now);
  };

  // Notification functions
  const requestNotificationPermissions = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted") {
        showError(
          "Notification permissions are required for vaccination reminders"
        );
        return false;
      }
      return true;
    } catch (error) {
      console.error("Error requesting notification permissions:", error);
      return false;
    }
  };

  const scheduleVaccinationNotifications = async (
    vaccination: any,
    horseName: string
  ) => {
    try {
      const hasPermission = await requestNotificationPermissions();
      if (!hasPermission) return;

      const dueDate = new Date(vaccination.date);
      const now = new Date();

      // Calculate notification dates
      const oneWeekBefore = new Date(dueDate);
      oneWeekBefore.setDate(dueDate.getDate() - 7);

      const twoDaysBefore = new Date(dueDate);
      twoDaysBefore.setDate(dueDate.getDate() - 2);

      const oneDayBefore = new Date(dueDate);
      oneDayBefore.setDate(dueDate.getDate() - 1);

      const onTheDay = new Date(dueDate);
      onTheDay.setHours(9, 0, 0, 0); // 9 AM on the day

      // Schedule notifications if they're in the future
      const notifications = [
        {
          date: oneWeekBefore,
          title: `🩺 Vaccination Reminder - 1 Week`,
          body: `${horseName} has a vaccination (${
            vaccination.name
          }) due in 1 week on ${dueDate.toLocaleDateString()}`,
          identifier: `${vaccination.id}_week`,
        },
        {
          date: twoDaysBefore,
          title: `💉 Vaccination Reminder - 2 Days`,
          body: `${horseName} has a vaccination (${vaccination.name}) due in 2 days`,
          identifier: `${vaccination.id}_2days`,
        },
        {
          date: oneDayBefore,
          title: `⚠️ Vaccination Reminder - Tomorrow`,
          body: `${horseName} has a vaccination (${vaccination.name}) due tomorrow!`,
          identifier: `${vaccination.id}_1day`,
        },
        {
          date: onTheDay,
          title: `🚨 Vaccination Due Today!`,
          body: `${horseName} vaccination (${vaccination.name}) is due today!`,
          identifier: `${vaccination.id}_today`,
        },
      ];

      for (const notification of notifications) {
        if (notification.date > now) {
          await Notifications.scheduleNotificationAsync({
            identifier: notification.identifier,
            content: {
              title: notification.title,
              body: notification.body,
              data: {
                vaccinationId: vaccination.id,
                horseName: horseName,
                type: "vaccination_reminder",
              },
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
              seconds: Math.floor(
                (notification.date.getTime() - now.getTime()) / 1000
              ),
              repeats: false,
            },
          });
        }
      }

      console.log(
        `Scheduled notifications for ${vaccination.name} vaccination for ${horseName}`
      );
    } catch (error) {
      console.error("Error scheduling notifications:", error);
    }
  };

  const cancelVaccinationNotifications = async (vaccinationId: string) => {
    try {
      const identifiers = [
        `${vaccinationId}_week`,
        `${vaccinationId}_2days`,
        `${vaccinationId}_1day`,
        `${vaccinationId}_today`,
      ];

      await Notifications.cancelScheduledNotificationAsync(identifiers[0]);
      await Notifications.cancelScheduledNotificationAsync(identifiers[1]);
      await Notifications.cancelScheduledNotificationAsync(identifiers[2]);
      await Notifications.cancelScheduledNotificationAsync(identifiers[3]);
      console.log(`Cancelled notifications for vaccination ${vaccinationId}`);
    } catch (error) {
      console.error("Error cancelling notifications:", error);
    }
  };

  // Load vaccination reminders when component mounts
  useEffect(() => {
    if (user?.id) {
      loadVaccinationReminders();
    }
  }, [user?.id]);

  // Initialize notifications
  useEffect(() => {
    // Configure notification behavior
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });

    // Request permissions on app start
    requestNotificationPermissions();
  }, []);

  // Custom Dropdown Component
  const CustomDropdown = ({
    value,
    placeholder,
    options,
    onSelect,
    isVisible,
    setVisible,
  }: {
    value: string;
    placeholder: string;
    options: string[];
    onSelect: (option: string) => void;
    isVisible: boolean;
    setVisible: (visible: boolean) => void;
  }) => {
    return (
      <View style={{ marginBottom: 20 }}>
        <TouchableOpacity
          style={{
            backgroundColor: currentTheme.colors.surface,
            borderRadius: 8,
            paddingVertical: 15,
            paddingHorizontal: 16,
            borderWidth: 1,
            borderColor: currentTheme.colors.border,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
          onPress={() => setVisible(!isVisible)}
        >
          <Text
            style={{
              color: value
                ? currentTheme.colors.text
                : currentTheme.colors.textSecondary,
              fontSize: 16,
              fontFamily: "Inder",
              includeFontPadding: false,
            }}
          >
            {value || placeholder || ""}
          </Text>
          <Text style={{ color: currentTheme.colors.text, fontSize: 16 }}>
            {isVisible ? "▲" : "▼"}
          </Text>
        </TouchableOpacity>

        {isVisible ? (
          <Modal
            transparent={true}
            visible={isVisible}
            animationType="fade"
            onRequestClose={() => setVisible(false)}
          >
            <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor: "rgba(0, 0, 0, 0.5)",
                justifyContent: "center",
                alignItems: "center",
              }}
              onPress={() => setVisible(false)}
            >
              <View
                style={{
                  backgroundColor: currentTheme.colors.surface,
                  borderRadius: 12,
                  padding: 20,
                  maxHeight: 300,
                  width: "80%",
                  borderWidth: 1,
                  borderColor: currentTheme.colors.border,
                }}
              >
                <ScrollView style={{ maxHeight: 250 }}>
                  {options.map((option, index) => (
                    <TouchableOpacity
                      key={index}
                      style={{
                        paddingVertical: 15,
                        paddingHorizontal: 10,
                        borderBottomWidth: index < options.length - 1 ? 1 : 0,
                        borderBottomColor: currentTheme.colors.border,
                      }}
                      onPress={() => {
                        onSelect(option);
                        setVisible(false);
                      }}
                    >
                      <Text
                        style={{
                          color:
                            value === option
                              ? currentTheme.colors.secondary
                              : currentTheme.colors.text,
                          fontSize: 16,
                          fontWeight: value === option ? "bold" : "normal",
                          fontFamily: "Inder",
                          textAlign: "left",
                          includeFontPadding: false,
                        }}
                      >
                        {option}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </TouchableOpacity>
          </Modal>
        ) : null}
      </View>
    );
  };

  // Custom Date Picker Component
  const DatePicker = ({
    value,
    placeholder,
    onSelect,
    isVisible,
    setVisible,
  }: {
    value: Date | null;
    placeholder: string;
    onSelect: (date: Date) => void;
    isVisible: boolean;
    setVisible: (visible: boolean) => void;
  }) => {
    const [selectedDay, setSelectedDay] = useState(value?.getDate() || 1);
    const [selectedMonth, setSelectedMonth] = useState(value?.getMonth() || 0);
    const [selectedYear, setSelectedYear] = useState(
      value?.getFullYear() || new Date().getFullYear()
    );

    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];

    const generateYears = () => {
      const years = [];
      const currentYear = new Date().getFullYear();
      for (let i = currentYear; i >= 1980; i--) {
        years.push(i);
      }
      return years;
    };

    const getDaysInMonth = (month: number, year: number) => {
      return new Date(year, month + 1, 0).getDate();
    };

    const generateDays = () => {
      const daysInMonth = getDaysInMonth(selectedMonth, selectedYear);
      const days = [];
      for (let i = 1; i <= daysInMonth; i++) {
        days.push(i);
      }
      return days;
    };

    const formatDate = (date: Date) => {
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    };

    const handleConfirm = () => {
      const newDate = new Date(selectedYear, selectedMonth, selectedDay);
      onSelect(newDate);
      setVisible(false);
    };

    return (
      <View style={{ marginBottom: 20 }}>
        <TouchableOpacity
          style={{
            backgroundColor: currentTheme.colors.surface,
            borderRadius: 8,
            paddingVertical: 15,
            paddingHorizontal: 16,
            borderWidth: 1,
            borderColor: currentTheme.colors.border,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
          onPress={() => setVisible(!isVisible)}
        >
          <Text
            style={{
              color: value
                ? currentTheme.colors.text
                : currentTheme.colors.textSecondary,
              fontSize: 16,
              fontFamily: "Inder",
              includeFontPadding: false,
            }}
          >
            {value ? formatDate(value) : placeholder || ""}
          </Text>
          <Text style={{ color: currentTheme.colors.text, fontSize: 16 }}>
            {isVisible ? "▲" : "▼"}
          </Text>
        </TouchableOpacity>

        {isVisible ? (
          <Modal
            transparent={true}
            visible={isVisible}
            animationType="fade"
            onRequestClose={() => setVisible(false)}
          >
            <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor: "rgba(0, 0, 0, 0.5)",
                justifyContent: "center",
                alignItems: "center",
              }}
              onPress={() => setVisible(false)}
            >
              <View
                style={{
                  backgroundColor: currentTheme.colors.surface,
                  borderRadius: 12,
                  padding: 20,
                  width: "90%",
                  maxWidth: 400,
                  borderWidth: 1,
                  borderColor: currentTheme.colors.border,
                }}
              >
                <Text
                  style={{
                    color: currentTheme.colors.text,
                    fontSize: 20,
                    fontWeight: "bold",
                    textAlign: "center",
                    marginBottom: 20,
                    fontFamily: "Inder",
                  }}
                >
                  Select Birth Date
                </Text>

                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    marginBottom: 20,
                  }}
                >
                  {/* Month Picker */}
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text
                      style={{
                        color: currentTheme.colors.text,
                        marginBottom: 10,
                        textAlign: "center",
                        fontFamily: "Inder",
                      }}
                    >
                      Month
                    </Text>
                    <ScrollView
                      style={{
                        maxHeight: 150,
                        backgroundColor: currentTheme.colors.primaryDark,
                        borderRadius: 8,
                      }}
                    >
                      {months.map((month, index) => (
                        <TouchableOpacity
                          key={index}
                          style={{
                            paddingVertical: 12,
                            paddingHorizontal: 10,
                            backgroundColor:
                              selectedMonth === index
                                ? currentTheme.colors.secondary
                                : "transparent",
                          }}
                          onPress={() => setSelectedMonth(index)}
                        >
                          <Text
                            style={{
                              color: "#FFFFFF",
                              textAlign: "center",
                              fontFamily: "Inder",
                              fontWeight:
                                selectedMonth === index ? "bold" : "normal",
                            }}
                          >
                            {month}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  {/* Day Picker */}
                  <View style={{ flex: 0.6, marginRight: 10 }}>
                    <Text
                      style={{
                        color: currentTheme.colors.text,
                        marginBottom: 10,
                        textAlign: "center",
                        fontFamily: "Inder",
                      }}
                    >
                      Day
                    </Text>
                    <ScrollView
                      style={{
                        maxHeight: 150,
                        backgroundColor: currentTheme.colors.primaryDark,
                        borderRadius: 8,
                      }}
                    >
                      {generateDays().map((day) => (
                        <TouchableOpacity
                          key={day}
                          style={{
                            paddingVertical: 12,
                            paddingHorizontal: 10,
                            backgroundColor:
                              selectedDay === day
                                ? currentTheme.colors.secondary
                                : "transparent",
                          }}
                          onPress={() => setSelectedDay(day)}
                        >
                          <Text
                            style={{
                              color: "#FFFFFF",
                              textAlign: "center",
                              fontFamily: "Inder",
                              fontWeight:
                                selectedDay === day ? "bold" : "normal",
                            }}
                          >
                            {day}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  {/* Year Picker */}
                  <View style={{ flex: 0.8 }}>
                    <Text
                      style={{
                        color: currentTheme.colors.text,
                        marginBottom: 10,
                        textAlign: "center",
                        fontFamily: "Inder",
                      }}
                    >
                      Year
                    </Text>
                    <ScrollView
                      style={{
                        maxHeight: 150,
                        backgroundColor: currentTheme.colors.primaryDark,
                        borderRadius: 8,
                      }}
                    >
                      {generateYears().map((year) => (
                        <TouchableOpacity
                          key={year}
                          style={{
                            paddingVertical: 12,
                            paddingHorizontal: 10,
                            backgroundColor:
                              selectedYear === year
                                ? currentTheme.colors.secondary
                                : "transparent",
                          }}
                          onPress={() => setSelectedYear(year)}
                        >
                          <Text
                            style={{
                              color: "#FFFFFF",
                              textAlign: "center",
                              fontFamily: "Inder",
                              fontWeight:
                                selectedYear === year ? "bold" : "normal",
                            }}
                          >
                            {year}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </View>

                <View style={{ flexDirection: "row", gap: 10 }}>
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      backgroundColor: currentTheme.colors.textSecondary,
                      borderRadius: 8,
                      paddingVertical: 12,
                    }}
                    onPress={() => setVisible(false)}
                  >
                    <Text
                      style={{
                        color: "#FFFFFF",
                        textAlign: "center",
                        fontSize: 16,
                        fontFamily: "Inder",
                      }}
                    >
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      backgroundColor: currentTheme.colors.primary,
                      borderRadius: 8,
                      paddingVertical: 12,
                    }}
                    onPress={handleConfirm}
                  >
                    <Text
                      style={{
                        color: "#FFFFFF",
                        textAlign: "center",
                        fontSize: 16,
                        fontWeight: "bold",
                        fontFamily: "Inder",
                      }}
                    >
                      Confirm
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </Modal>
        ) : null}
      </View>
    );
  };

  // Custom Number Picker Component
  const NumberPicker = ({
    value,
    placeholder,
    minValue,
    maxValue,
    onSelect,
    isVisible,
    setVisible,
    unit = "",
  }: {
    value: string;
    placeholder: string;
    minValue: number;
    maxValue: number;
    onSelect: (value: string) => void;
    isVisible: boolean;
    setVisible: (visible: boolean) => void;
    unit?: string;
  }) => {
    const [selectedValue, setSelectedValue] = useState(
      parseInt(value) || minValue
    );

    const generateNumbers = () => {
      const numbers = [];
      for (let i = minValue; i <= maxValue; i++) {
        numbers.push(i);
      }
      return numbers;
    };

    const handleConfirm = () => {
      onSelect(selectedValue.toString());
      setVisible(false);
    };

    return (
      <View style={{ marginBottom: 20 }}>
        <TouchableOpacity
          style={{
            backgroundColor: "#2D5A66",
            borderRadius: 8,
            paddingVertical: 15,
            paddingHorizontal: 16,
            borderWidth: 1,
            borderColor: "#4A9BB7",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
          onPress={() => setVisible(!isVisible)}
        >
          <Text
            style={{
              color: value ? "#FFFFFF" : "#B0B0B0",
              fontSize: 16,
              fontFamily: "Inder",
              includeFontPadding: false,
            }}
          >
            {value ? `${value}${unit}` : placeholder || ""}
          </Text>
          <Text style={{ color: "#FFFFFF", fontSize: 16 }}>
            {isVisible ? "▲" : "▼"}
          </Text>
        </TouchableOpacity>

        {isVisible ? (
          <Modal
            transparent={true}
            visible={isVisible}
            animationType="fade"
            onRequestClose={() => setVisible(false)}
          >
            <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor: "rgba(0, 0, 0, 0.5)",
                justifyContent: "center",
                alignItems: "center",
              }}
              onPress={() => setVisible(false)}
            >
              <View
                style={{
                  backgroundColor: "#1C3A42",
                  borderRadius: 12,
                  padding: 20,
                  width: "80%",
                  maxWidth: 300,
                  borderWidth: 1,
                  borderColor: "#4A9BB7",
                }}
              >
                <Text
                  style={{
                    color: "#FFFFFF",
                    fontSize: 20,
                    fontWeight: "bold",
                    textAlign: "center",
                    marginBottom: 20,
                    fontFamily: "Inder",
                  }}
                >
                  Select {placeholder ? placeholder.toLowerCase() : "item"}
                </Text>

                <ScrollView
                  style={{
                    maxHeight: 200,
                    backgroundColor: "#2D5A66",
                    borderRadius: 8,
                  }}
                >
                  {generateNumbers().map((num) => (
                    <TouchableOpacity
                      key={num}
                      style={{
                        paddingVertical: 15,
                        paddingHorizontal: 10,
                        backgroundColor:
                          selectedValue === num ? "#4A9BB7" : "transparent",
                        borderBottomWidth: 1,
                        borderBottomColor: "#335C67",
                      }}
                      onPress={() => setSelectedValue(num)}
                    >
                      <Text
                        style={{
                          color: "#FFFFFF",
                          fontSize: 16,
                          textAlign: "center",
                          fontFamily: "Inder",
                          fontWeight: selectedValue === num ? "bold" : "normal",
                        }}
                      >
                        {num}
                        {unit}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <View style={{ flexDirection: "row", gap: 10, marginTop: 20 }}>
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      backgroundColor: "#666",
                      borderRadius: 8,
                      paddingVertical: 12,
                    }}
                    onPress={() => setVisible(false)}
                  >
                    <Text
                      style={{
                        color: "#FFFFFF",
                        textAlign: "center",
                        fontSize: 16,
                        fontFamily: "Inder",
                      }}
                    >
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      backgroundColor: "#4A9BB7",
                      borderRadius: 8,
                      paddingVertical: 12,
                    }}
                    onPress={handleConfirm}
                  >
                    <Text
                      style={{
                        color: "#FFFFFF",
                        textAlign: "center",
                        fontSize: 16,
                        fontWeight: "bold",
                        fontFamily: "Inder",
                      }}
                    >
                      Confirm
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </Modal>
        ) : null}
      </View>
    );
  };

  // Custom Success Modal Component
  const SuccessModal = () => (
    <Modal
      animationType="fade"
      transparent={true}
      visible={showSuccessModal}
      onRequestClose={() => setShowSuccessModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.successModalContainer,
            { backgroundColor: currentTheme.colors.surface },
          ]}
        >
          <View
            style={[
              styles.modalIcon,
              { backgroundColor: currentTheme.colors.success },
            ]}
          >
            <Text style={styles.checkIcon}>✓</Text>
          </View>
          <Text
            style={[
              styles.successModalTitle,
              { color: currentTheme.colors.text },
            ]}
          >
            Success!
          </Text>
          <Text
            style={[
              styles.successModalMessage,
              { color: currentTheme.colors.textSecondary },
            ]}
          >
            {successMessage || ""}
          </Text>
          <TouchableOpacity
            style={[
              styles.successModalButton,
              { backgroundColor: currentTheme.colors.primary },
            ]}
            onPress={() => setShowSuccessModal(false)}
          >
            <Text style={[styles.successModalButtonText, { color: "#FFFFFF" }]}>
              OK
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // Custom Image Picker Modal Component
  const ImagePickerModal = () => (
    <Modal
      animationType="fade"
      transparent={true}
      visible={showImagePickerModal}
      onRequestClose={() => setShowImagePickerModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.imagePickerModalContainer,
            { backgroundColor: currentTheme.colors.surface },
          ]}
        >
          <View
            style={[
              styles.imagePickerIcon,
              { backgroundColor: currentTheme.colors.accent },
            ]}
          >
            <Text style={styles.cameraIcon}>📷</Text>
          </View>
          <Text
            style={[
              styles.imagePickerTitle,
              { color: currentTheme.colors.text },
            ]}
          >
            Update Photo
          </Text>
          <Text
            style={[
              styles.imagePickerMessage,
              { color: currentTheme.colors.textSecondary },
            ]}
          >
            Choose how you'd like to update the horse's photo
          </Text>

          <View style={styles.imagePickerButtons}>
            <TouchableOpacity
              style={[
                styles.imagePickerButton,
                {
                  backgroundColor: currentTheme.colors.primary,
                  borderColor: currentTheme.colors.border,
                },
              ]}
              onPress={takePhoto}
            >
              <View style={styles.imagePickerButtonIcon}>
                <Text style={styles.imagePickerButtonEmoji}>📷</Text>
              </View>
              <Text
                style={[styles.imagePickerButtonText, { color: "#FFFFFF" }]}
              >
                Take Photo
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.imagePickerButton,
                {
                  backgroundColor: currentTheme.colors.secondary,
                  borderColor: currentTheme.colors.border,
                },
              ]}
              onPress={pickImageFromLibrary}
            >
              <View style={styles.imagePickerButtonIcon}>
                <Text style={styles.imagePickerButtonEmoji}>🖼️</Text>
              </View>
              <Text
                style={[styles.imagePickerButtonText, { color: "#FFFFFF" }]}
              >
                Choose from Library
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.imagePickerButton,
                styles.cancelImageButton,
                { backgroundColor: currentTheme.colors.textSecondary },
              ]}
              onPress={() => setShowImagePickerModal(false)}
            >
              <Text
                style={[styles.cancelImageButtonText, { color: "#FFFFFF" }]}
              >
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Show authentication message if no user
  if (!authLoading && !user?.id) {
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
            <Text style={styles.header}>My Horses</Text>
          </View>
        </SafeAreaView>
        <ScrollView
          style={[
            styles.viewPort,
            { backgroundColor: currentTheme.colors.background },
          ]}
        >
          <View style={styles.loadingContainer}>
            <Text style={styles.emptyStateEmoji}>🔒</Text>
            <Text style={styles.emptyStateText}>Please log in</Text>
            <Text style={styles.emptyStateSubtext}>
              You need to be logged in to manage your horses.
            </Text>
            <TouchableOpacity
              style={styles.addHorseButton}
              onPress={() => user?.id && loadHorses(user.id)}
            >
              <Text style={styles.addHorseButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  if (authLoading || loading) {
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
            <Text style={styles.header}>My Horses</Text>
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
            <Text style={styles.loadingText}>
              {authLoading ? "Loading..." : "Loading horses..."}
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
          <Text style={styles.header}>My Horses</Text>
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
        <View style={styles.horsesContainer}>
          {/* Unlock with PRO widget - shown when non-PRO user reaches limit */}
          {!isProMember && horses.length >= 2 && (
            <TouchableOpacity
              style={[
                styles.unlockProWidget,
                { backgroundColor: currentTheme.colors.primary },
              ]}
              onPress={() => router.push("/subscription")}
            >
              <Text style={styles.unlockProIcon}>✨</Text>
              <Text style={styles.unlockProText}>Unlock more with PRO</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.addHorseButton,
              {
                backgroundColor:
                  !isProMember && horses.length >= 2
                    ? currentTheme.colors.primary
                    : currentTheme.colors.primary,
                borderColor: currentTheme.colors.border,
                opacity: !isProMember && horses.length >= 2 ? 0.6 : 1,
              },
            ]}
            onPress={
              !isProMember && horses.length >= 2 ? undefined : openAddModal
            }
            disabled={!isProMember && horses.length >= 2}
          >
            <Text style={styles.addHorseButtonIcon}>🐴</Text>
            <Text style={[styles.addHorseButtonText]}>Add New Horse</Text>
          </TouchableOpacity>
          {(horses || []).map((horse, index) => (
            <View
              style={[
                styles.horseCard,
                {
                  borderColor: currentTheme.colors.border,
                },
              ]}
              key={horse.id}
            >
              <View style={styles.horseImageContainer}>
                {horse.image_url ? (
                  <Image
                    style={[
                      styles.horseImage,
                      { borderColor: currentTheme.colors.primary },
                    ]}
                    resizeMode="cover"
                    source={{ uri: horse.image_url }}
                  />
                ) : (
                  <View
                    style={[
                      styles.horseImage,
                      {
                        borderColor: currentTheme.colors.primary,
                        backgroundColor: currentTheme.colors.surface,
                        justifyContent: "center",
                        alignItems: "center",
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 60 }}>🐴</Text>
                  </View>
                )}
              </View>

              <View style={styles.horseContent}>
                <View style={styles.horseInfo}>
                  <Text style={styles.horseName}>{horse.name || ""}</Text>
                  <Text style={styles.horseBreed}>{horse.breed || ""}</Text>
                  <View style={styles.horseDetails}>
                    <View style={styles.detailRow}>
                      <View style={styles.detailLeft}>
                        <Text style={styles.detailIcon}>📅</Text>
                        <Text style={styles.detailLabel}>Born</Text>
                      </View>
                      <Text style={styles.detailValue}>
                        {horse.birth_date ? formatDate(horse.birth_date) : ""}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <View style={styles.detailLeft}>
                        <Text style={styles.detailIcon}>♀♂</Text>
                        <Text style={styles.detailLabel}>Gender</Text>
                      </View>
                      <Text style={styles.detailValue}>
                        {horse.gender || ""}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <View style={styles.detailLeft}>
                        <Text style={styles.detailIcon}>📏</Text>
                        <Text style={styles.detailLabel}>Height</Text>
                      </View>
                      <Text style={styles.detailValue}>
                        {formatHeight(horse.height || 0)}
                      </Text>
                    </View>
                    {horse.weight ? (
                      <View style={styles.detailRow}>
                        <View style={styles.detailLeft}>
                          <Text style={styles.detailIcon}>⚖️</Text>
                          <Text style={styles.detailLabel}>Weight</Text>
                        </View>
                        <Text style={styles.detailValue}>
                          {formatWeight(horse.weight || 0)}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Vaccination Status Section */}
                  {(getUpcomingVaccinations(horse.id).length > 0 ||
                    getOverdueVaccinations(horse.id).length > 0) && (
                    <View
                      style={[
                        styles.vaccinationSection,
                        {
                          backgroundColor: currentTheme.colors.surface,
                          borderColor: currentTheme.colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.vaccinationSectionTitle,
                          { color: currentTheme.colors.text },
                        ]}
                      >
                        💉 Vaccination Status
                      </Text>

                      {getOverdueVaccinations(horse.id).length > 0 && (
                        <View style={styles.vaccinationAlert}>
                          <Text
                            style={[
                              styles.vaccinationAlertText,
                              { color: currentTheme.colors.error },
                            ]}
                          >
                            ⚠️ {getOverdueVaccinations(horse.id).length} overdue
                            vaccination(s)
                          </Text>
                        </View>
                      )}

                      {getUpcomingVaccinations(horse.id).length > 0 && (
                        <View style={styles.vaccinationUpcoming}>
                          <Text
                            style={[
                              styles.vaccinationUpcomingText,
                              { color: currentTheme.colors.success },
                            ]}
                          >
                            📅 {getUpcomingVaccinations(horse.id).length}{" "}
                            upcoming vaccination(s)
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>

                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[
                      styles.primaryActionButton,
                      { backgroundColor: currentTheme.colors.primary },
                    ]}
                    onPress={() => openVaccinationModal(horse)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.primaryActionButtonText}>
                      RECORDS
                      {(getOverdueVaccinations(horse.id).length > 0 ||
                        getUpcomingVaccinations(horse.id).length > 0) &&
                        ` (${
                          getOverdueVaccinations(horse.id).length +
                          getUpcomingVaccinations(horse.id).length
                        })`}
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.secondaryButtons}>
                    <TouchableOpacity
                      style={[
                        styles.secondaryActionButton,
                        styles.editButton,
                        {
                          backgroundColor: `${currentTheme.colors.primary}15`,
                          borderColor: `${currentTheme.colors.primary}40`,
                        },
                      ]}
                      onPress={() => openEditModal(horse)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[styles.editButtonText, styles.actionButtonIcon]}
                      >
                        ✏️
                      </Text>
                      <Text
                        style={[
                          styles.editButtonText,
                          { color: currentTheme.colors.primary },
                        ]}
                      >
                        Edit
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.secondaryActionButton,
                        styles.deleteButton,
                        {
                          backgroundColor: `${currentTheme.colors.error}15`,
                          borderColor: `${currentTheme.colors.error}40`,
                        },
                      ]}
                      onPress={() => deleteHorse(horse)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.deleteButtonText,
                          styles.actionButtonIcon,
                        ]}
                      >
                        🗑️
                      </Text>
                      <Text
                        style={[
                          styles.deleteButtonText,
                          { color: currentTheme.colors.error },
                        ]}
                      >
                        Delete
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          ))}
          {horses && horses.length === 0 && !loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateEmoji}>🐴</Text>
              <Text
                style={[
                  styles.emptyStateText,
                  { color: currentTheme.colors.text },
                ]}
              >
                No horses yet!
              </Text>
              <Text
                style={[
                  styles.emptyStateSubtext,
                  { color: currentTheme.colors.textSecondary },
                ]}
              >
                Add your first horse to get started.
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Loading overlay */}
      {loading && horses && horses.length > 0 ? (
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
              Updating...
            </Text>
          </View>
        </View>
      ) : null}

      {/* Edit Horse Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editModalVisible}
        onRequestClose={closeEditModal}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContainer,
              { backgroundColor: currentTheme.colors.surface },
            ]}
          >
            <View
              style={[
                styles.modalHeader,
                { backgroundColor: currentTheme.colors.primary },
              ]}
            >
              <Text style={[styles.modalTitle, { color: "#FFFFFF" }]}>
                Edit Horse
              </Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={closeEditModal}
              >
                <Text style={[styles.modalCloseText, { color: "#FFFFFF" }]}>
                  ✕
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <View style={styles.inputGroup}>
                <Text
                  style={[
                    styles.inputLabel,
                    { color: currentTheme.colors.text },
                  ]}
                >
                  Photo
                </Text>
                <View
                  style={[
                    styles.imageContainer,
                    { backgroundColor: currentTheme.colors.surface },
                  ]}
                >
                  <Image
                    style={[
                      styles.selectedImage,
                      { borderColor: currentTheme.colors.primary },
                    ]}
                    source={
                      editImage
                        ? editImage
                        : editingHorse?.image_url
                        ? { uri: editingHorse.image_url }
                        : require("../../assets/images/horses/pony.jpg")
                    }
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    style={[
                      styles.changePhotoButton,
                      { backgroundColor: currentTheme.colors.primary },
                    ]}
                    onPress={() => setShowImagePickerModal(true)}
                  >
                    <View style={styles.cameraIconContainer}>
                      <Text style={styles.cameraIconText}>📷</Text>
                    </View>
                    <Text
                      style={[styles.changePhotoText, { color: "#FFFFFF" }]}
                    >
                      Change Photo
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text
                  style={[
                    styles.inputLabel,
                    { color: currentTheme.colors.text },
                  ]}
                >
                  Name
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: currentTheme.colors.surface,
                      borderColor: currentTheme.colors.border,
                      color: currentTheme.colors.text,
                    },
                  ]}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Horse name"
                  placeholderTextColor={currentTheme.colors.textSecondary}
                  autoCapitalize="words"
                  autoCorrect={false}
                  textContentType="none"
                  keyboardType="default"
                  returnKeyType="next"
                  maxLength={50}
                  multiline={false}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text
                  style={[
                    styles.inputLabel,
                    { color: currentTheme.colors.text },
                  ]}
                >
                  Gender
                </Text>
                <CustomDropdown
                  value={editGender}
                  placeholder="Select gender"
                  options={genderOptions}
                  onSelect={setEditGender}
                  isVisible={genderDropdownVisible}
                  setVisible={setGenderDropdownVisible}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text
                  style={[
                    styles.inputLabel,
                    { color: currentTheme.colors.text },
                  ]}
                >
                  Birth Date
                </Text>
                <DatePicker
                  value={editBirthDate}
                  placeholder="Select birth date"
                  onSelect={setEditBirthDate}
                  isVisible={datePickerVisible}
                  setVisible={setDatePickerVisible}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text
                  style={[
                    styles.inputLabel,
                    { color: currentTheme.colors.text },
                  ]}
                >
                  Height ({formatHeightUnit()})
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: currentTheme.colors.surface,
                      borderColor: currentTheme.colors.border,
                      color: currentTheme.colors.text,
                    },
                  ]}
                  value={editHeight}
                  onChangeText={setEditHeight}
                  placeholder={
                    metricSystem === "metric"
                      ? "Enter height (100-220 cm)"
                      : "Enter height (39-87 in)"
                  }
                  placeholderTextColor={currentTheme.colors.textSecondary}
                  keyboardType="numeric"
                  returnKeyType="next"
                  maxLength={3}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text
                  style={[
                    styles.inputLabel,
                    { color: currentTheme.colors.text },
                  ]}
                >
                  Weight ({formatWeightUnit()}) - Optional
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: currentTheme.colors.surface,
                      borderColor: currentTheme.colors.border,
                      color: currentTheme.colors.text,
                    },
                  ]}
                  value={editWeight}
                  onChangeText={setEditWeight}
                  placeholder="Enter weight"
                  placeholderTextColor={currentTheme.colors.textSecondary}
                  keyboardType="numeric"
                  returnKeyType="next"
                  maxLength={4}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text
                  style={[
                    styles.inputLabel,
                    { color: currentTheme.colors.text },
                  ]}
                >
                  Breed
                </Text>
                <CustomDropdown
                  value={editBreed}
                  placeholder="Select breed"
                  options={breedOptions}
                  onSelect={setEditBreed}
                  isVisible={breedDropdownVisible}
                  setVisible={setBreedDropdownVisible}
                />
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.cancelButton,
                  { backgroundColor: currentTheme.colors.textSecondary },
                ]}
                onPress={closeEditModal}
              >
                <Text style={[styles.cancelButtonText, { color: "#FFFFFF" }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.saveButton,
                  { backgroundColor: currentTheme.colors.primary },
                ]}
                onPress={saveHorseEdit}
              >
                <Text style={[styles.saveButtonText, { color: "#FFFFFF" }]}>
                  Save Changes
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Horse Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={addModalVisible}
        onRequestClose={closeAddModal}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContainer,
              { backgroundColor: currentTheme.colors.surface },
            ]}
          >
            <View
              style={[
                styles.modalHeader,
                { backgroundColor: currentTheme.colors.primary },
              ]}
            >
              <Text style={[styles.modalTitle, { color: "#FFFFFF" }]}>
                Add New Horse
              </Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={closeAddModal}
              >
                <Text style={[styles.modalCloseText, { color: "#FFFFFF" }]}>
                  ✕
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <View style={styles.inputGroup}>
                <Text
                  style={[
                    styles.inputLabel,
                    { color: currentTheme.colors.text },
                  ]}
                >
                  Photo
                </Text>
                <View
                  style={[
                    styles.imageContainer,
                    { backgroundColor: currentTheme.colors.surface },
                  ]}
                >
                  <Image
                    style={[
                      styles.selectedImage,
                      { borderColor: currentTheme.colors.primary },
                    ]}
                    source={
                      addImage || require("../../assets/images/horses/pony.jpg")
                    }
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    style={[
                      styles.changePhotoButton,
                      { backgroundColor: currentTheme.colors.primary },
                    ]}
                    onPress={() => setShowImagePickerModal(true)}
                  >
                    <View style={styles.cameraIconContainer}>
                      <Text style={styles.cameraIconText}>📷</Text>
                    </View>
                    <Text
                      style={[styles.changePhotoText, { color: "#FFFFFF" }]}
                    >
                      Add Photo
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text
                  style={[
                    styles.inputLabel,
                    { color: currentTheme.colors.text },
                  ]}
                >
                  Name
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: currentTheme.colors.surface,
                      borderColor: currentTheme.colors.border,
                      color: currentTheme.colors.text,
                    },
                  ]}
                  value={addName}
                  onChangeText={setAddName}
                  placeholder="Horse name"
                  placeholderTextColor={currentTheme.colors.textSecondary}
                  autoCapitalize="words"
                  autoCorrect={false}
                  textContentType="none"
                  keyboardType="default"
                  returnKeyType="next"
                  maxLength={50}
                  multiline={false}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text
                  style={[
                    styles.inputLabel,
                    { color: currentTheme.colors.text },
                  ]}
                >
                  Gender
                </Text>
                <CustomDropdown
                  value={addGender}
                  placeholder="Select gender"
                  options={genderOptions}
                  onSelect={setAddGender}
                  isVisible={addGenderDropdownVisible}
                  setVisible={setAddGenderDropdownVisible}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text
                  style={[
                    styles.inputLabel,
                    { color: currentTheme.colors.text },
                  ]}
                >
                  Birth Date
                </Text>
                <DatePicker
                  value={addBirthDate}
                  placeholder="Select birth date"
                  onSelect={setAddBirthDate}
                  isVisible={addDatePickerVisible}
                  setVisible={setAddDatePickerVisible}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text
                  style={[
                    styles.inputLabel,
                    { color: currentTheme.colors.text },
                  ]}
                >
                  Height ({formatHeightUnit()})
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: currentTheme.colors.surface,
                      borderColor: currentTheme.colors.border,
                      color: currentTheme.colors.text,
                    },
                  ]}
                  value={addHeight}
                  onChangeText={setAddHeight}
                  placeholder={
                    metricSystem === "metric"
                      ? "Enter height (100-220 cm)"
                      : "Enter height (39-87 in)"
                  }
                  placeholderTextColor={currentTheme.colors.textSecondary}
                  keyboardType="numeric"
                  returnKeyType="next"
                  maxLength={3}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text
                  style={[
                    styles.inputLabel,
                    { color: currentTheme.colors.text },
                  ]}
                >
                  Weight ({formatWeightUnit()}) - Optional
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: currentTheme.colors.surface,
                      borderColor: currentTheme.colors.border,
                      color: currentTheme.colors.text,
                    },
                  ]}
                  value={addWeight}
                  onChangeText={setAddWeight}
                  placeholder="Enter weight"
                  placeholderTextColor={currentTheme.colors.textSecondary}
                  keyboardType="numeric"
                  returnKeyType="next"
                  maxLength={4}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text
                  style={[
                    styles.inputLabel,
                    { color: currentTheme.colors.text },
                  ]}
                >
                  Breed
                </Text>
                <CustomDropdown
                  value={addBreed}
                  placeholder="Select breed"
                  options={breedOptions}
                  onSelect={setAddBreed}
                  isVisible={addBreedDropdownVisible}
                  setVisible={setAddBreedDropdownVisible}
                />
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.cancelButton,
                  { backgroundColor: currentTheme.colors.textSecondary },
                ]}
                onPress={closeAddModal}
              >
                <Text style={[styles.cancelButtonText, { color: "#FFFFFF" }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.saveButton,
                  { backgroundColor: currentTheme.colors.primary },
                ]}
                onPress={saveHorseAdd}
              >
                <Text style={[styles.saveButtonText, { color: "#FFFFFF" }]}>
                  Add Horse
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Success Modal */}
      <SuccessModal />

      {/* Image Picker Modal */}
      <ImagePickerModal />

      {/* Vaccination Reminder Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={vaccinationModalVisible}
        onRequestClose={closeVaccinationModal}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContainer,
              { backgroundColor: currentTheme.colors.surface },
            ]}
          >
            <View
              style={[
                styles.modalHeader,
                { backgroundColor: currentTheme.colors.accent },
              ]}
            >
              <Text style={[styles.modalTitle, { color: "#FFFFFF" }]}>
                💉 Vaccination Reminders
              </Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={closeVaccinationModal}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              {selectedHorseForVaccination && (
                <>
                  <Text
                    style={[
                      styles.vaccinationHorseName,
                      { color: currentTheme.colors.text },
                    ]}
                  >
                    Setting reminder for: {selectedHorseForVaccination.name}
                  </Text>

                  {/* Existing Vaccinations */}
                  {horseVaccinations[selectedHorseForVaccination.id] &&
                    horseVaccinations[selectedHorseForVaccination.id].length >
                      0 && (
                      <View style={styles.existingVaccinations}>
                        <Text
                          style={[
                            styles.existingVaccinationsTitle,
                            { color: currentTheme.colors.text },
                          ]}
                        >
                          Existing Reminders:
                        </Text>
                        {horseVaccinations[selectedHorseForVaccination.id].map(
                          (vaccination) => {
                            const isOverdue =
                              new Date(vaccination.date) < new Date();
                            return (
                              <View
                                key={vaccination.id}
                                style={[
                                  styles.vaccinationItem,
                                  {
                                    backgroundColor: isOverdue
                                      ? currentTheme.colors.error + "20"
                                      : currentTheme.colors.success + "20",
                                    borderColor: isOverdue
                                      ? currentTheme.colors.error
                                      : currentTheme.colors.success,
                                  },
                                ]}
                              >
                                <View style={styles.vaccinationItemContent}>
                                  <Text
                                    style={[
                                      styles.vaccinationItemName,
                                      { color: currentTheme.colors.text },
                                    ]}
                                  >
                                    {vaccination.name}
                                  </Text>
                                  <Text
                                    style={[
                                      styles.vaccinationItemDate,
                                      {
                                        color: isOverdue
                                          ? currentTheme.colors.error
                                          : currentTheme.colors.success,
                                      },
                                    ]}
                                  >
                                    {isOverdue ? "⚠️ Overdue: " : "📅 Due: "}
                                    {new Date(
                                      vaccination.date
                                    ).toLocaleDateString()}
                                  </Text>
                                  {vaccination.notes && (
                                    <Text
                                      style={[
                                        styles.vaccinationItemNotes,
                                        {
                                          color:
                                            currentTheme.colors.textSecondary,
                                        },
                                      ]}
                                    >
                                      {vaccination.notes}
                                    </Text>
                                  )}
                                </View>
                                <TouchableOpacity
                                  style={styles.deleteVaccinationButton}
                                  onPress={() =>
                                    deleteVaccinationReminder(
                                      selectedHorseForVaccination.id,
                                      vaccination.id
                                    )
                                  }
                                >
                                  <Text
                                    style={styles.deleteVaccinationButtonText}
                                  >
                                    🗑️
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            );
                          }
                        )}
                      </View>
                    )}

                  {/* Add New Vaccination Form */}
                  <View style={styles.addVaccinationForm}>
                    <Text
                      style={[
                        styles.addVaccinationTitle,
                        { color: currentTheme.colors.text },
                      ]}
                    >
                      Add New Reminder:
                    </Text>

                    <View style={styles.inputGroup}>
                      <Text
                        style={[
                          styles.inputLabel,
                          { color: currentTheme.colors.text },
                        ]}
                      >
                        Vaccination Name *
                      </Text>
                      <TextInput
                        style={[
                          styles.textInput,
                          {
                            backgroundColor: currentTheme.colors.surface,
                            borderColor: currentTheme.colors.border,
                            color: currentTheme.colors.text,
                          },
                        ]}
                        value={vaccinationName}
                        onChangeText={setVaccinationName}
                        placeholder="e.g., Annual Vaccinations, Flu Shot, etc."
                        placeholderTextColor={currentTheme.colors.textSecondary}
                        maxLength={50}
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <Text
                        style={[
                          styles.inputLabel,
                          { color: currentTheme.colors.text },
                        ]}
                      >
                        Due Date *
                      </Text>
                      <TouchableOpacity
                        style={[
                          styles.datePickerButton,
                          {
                            backgroundColor: currentTheme.colors.surface,
                            borderColor: currentTheme.colors.border,
                          },
                        ]}
                        onPress={() => setShowVaccinationDatePicker(true)}
                      >
                        <Text
                          style={[
                            styles.datePickerButtonText,
                            {
                              color: vaccinationDate
                                ? currentTheme.colors.text
                                : currentTheme.colors.textSecondary,
                            },
                          ]}
                        >
                          {vaccinationDate
                            ? vaccinationDate.toLocaleDateString()
                            : "Select due date"}
                        </Text>
                        <Text
                          style={[
                            styles.datePickerArrow,
                            { color: currentTheme.colors.text },
                          ]}
                        >
                          📅
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.inputGroup}>
                      <Text
                        style={[
                          styles.inputLabel,
                          { color: currentTheme.colors.text },
                        ]}
                      >
                        Notes (Optional)
                      </Text>
                      <TextInput
                        style={[
                          styles.textInput,
                          styles.textInputMultiline,
                          {
                            backgroundColor: currentTheme.colors.surface,
                            borderColor: currentTheme.colors.border,
                            color: currentTheme.colors.text,
                          },
                        ]}
                        value={vaccinationNotes}
                        onChangeText={setVaccinationNotes}
                        placeholder="Additional notes about this vaccination..."
                        placeholderTextColor={currentTheme.colors.textSecondary}
                        multiline={true}
                        numberOfLines={3}
                        maxLength={200}
                      />
                    </View>
                  </View>
                </>
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.cancelButton,
                  { backgroundColor: currentTheme.colors.textSecondary },
                ]}
                onPress={closeVaccinationModal}
              >
                <Text style={[styles.cancelButtonText, { color: "#FFFFFF" }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.saveButton,
                  { backgroundColor: currentTheme.colors.accent },
                ]}
                onPress={saveVaccinationReminder}
              >
                <Text style={[styles.saveButtonText, { color: "#FFFFFF" }]}>
                  Save Reminder
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Vaccination Date Picker Modal */}
      {showVaccinationDatePicker && (
        <Modal
          transparent={true}
          visible={showVaccinationDatePicker}
          animationType="fade"
          onRequestClose={() => setShowVaccinationDatePicker(false)}
        >
          <TouchableOpacity
            style={styles.datePickerOverlay}
            onPress={() => setShowVaccinationDatePicker(false)}
          >
            <View
              style={[
                styles.datePickerContainer,
                { backgroundColor: currentTheme.colors.surface },
              ]}
            >
              <Text
                style={[
                  styles.datePickerTitle,
                  { color: currentTheme.colors.text },
                ]}
              >
                Select Due Date
              </Text>

              <ScrollView style={styles.datePickerScroll}>
                {Array.from({ length: 365 }, (_, index) => {
                  const date = new Date();
                  date.setDate(date.getDate() + index);
                  return (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.datePickerOption,
                        {
                          backgroundColor:
                            vaccinationDate?.toDateString() ===
                            date.toDateString()
                              ? currentTheme.colors.accent
                              : "transparent",
                        },
                      ]}
                      onPress={() => {
                        setVaccinationDate(date);
                        setShowVaccinationDatePicker(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.datePickerOptionText,
                          {
                            color:
                              vaccinationDate?.toDateString() ===
                              date.toDateString()
                                ? "#FFFFFF"
                                : currentTheme.colors.text,
                          },
                        ]}
                      >
                        {date.toLocaleDateString("en-US", {
                          weekday: "short",
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
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
    marginTop: -8,
  },
  horsesContainer: {
    paddingHorizontal: 20,
    paddingBottom: 110,
  },
  statsHeader: {
    alignItems: "center",
    backgroundColor: "#E9F5F0",
    borderRadius: 20,
    paddingHorizontal: 20,
    marginBottom: 5,
  },
  statsText: {
    fontSize: 18,
    fontFamily: "Inder",
    color: "#335C67",
    fontWeight: "600",
  },
  unlockProWidget: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#335C67",
    borderRadius: 15,
    paddingHorizontal: 20,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginTop: 10,
  },
  unlockProIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  unlockProText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Inder",
    fontWeight: "600",
  },
  addHorseButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4a5c6a",
    borderRadius: 24,
    paddingVertical: 18,
    paddingHorizontal: 32,
    marginTop: 12,
    marginBottom: 24,
    marginHorizontal: 4,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    gap: 12,
  },
  addHorseButtonIcon: {
    fontSize: 20,
  },
  addHorseButtonText: {
    color: "#fff",
    fontSize: 18,
    fontFamily: "Inder",
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  horseCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    marginHorizontal: 4,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  horseImageContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  horseImage: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 0,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  horseContent: {
    flex: 1,
    alignItems: "center",
  },
  horseInfo: {
    alignItems: "center",
    marginBottom: 24,
    width: "100%",
  },
  horseName: {
    fontSize: 32,
    fontFamily: "Inder",
    fontWeight: "bold",
    color: "#2c3e50",
    textAlign: "center",
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  horseBreed: {
    fontSize: 18,
    fontFamily: "Inder",
    color: "#7f8c8d",
    textAlign: "center",
    marginBottom: 24,
    fontWeight: "500",
  },
  horseDetails: {
    width: "100%",
    paddingHorizontal: 8,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  detailLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  detailIcon: {
    width: 24,
    height: 24,
    marginRight: 12,
    fontSize: 18,
    textAlign: "center",
    color: "#7f8c8d",
  },
  detailLabel: {
    fontSize: 16,
    fontFamily: "Inder",
    color: "#5a6c7d",
    fontWeight: "500",
    flex: 1,
  },
  detailValue: {
    fontSize: 16,
    fontFamily: "Inder",
    color: "#2c3e50",
    fontWeight: "600",
    textAlign: "right",
  },
  actionButtons: {
    width: "100%",
  },
  primaryActionButton: {
    borderRadius: 20,
    paddingVertical: 16,
    marginBottom: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryActionButtonText: {
    color: "#ffffff",
    fontSize: 18,
    fontFamily: "Inder",
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  secondaryButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  secondaryActionButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  editButton: {
    borderWidth: 1,
  },
  deleteButton: {
    borderWidth: 1,
  },
  editButtonText: {
    fontSize: 14,
    fontFamily: "Inder",
    fontWeight: "600",
  },
  deleteButtonText: {
    fontSize: 14,
    fontFamily: "Inder",
    fontWeight: "600",
  },
  actionButtonIcon: {
    fontSize: 16,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyStateEmoji: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyStateText: {
    fontSize: 24,
    fontFamily: "Inder",
    fontWeight: "bold",
    color: "#335C67",
    marginBottom: 10,
    textAlign: "center",
  },
  emptyStateSubtext: {
    fontSize: 16,
    fontFamily: "Inder",
    color: "#666",
    textAlign: "center",
    lineHeight: 24,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContainer: {
    backgroundColor: "#fff",
    borderRadius: 20,
    width: "95%",
    maxWidth: 500,
    maxHeight: "90%",
    minHeight: "70%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 25,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  modalTitle: {
    fontSize: 26,
    fontFamily: "Inder",
    fontWeight: "bold",
    color: "#335C67",
  },
  modalCloseButton: {
    backgroundColor: "#666",
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  modalCloseText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  modalContent: {
    flex: 1,
    padding: 25,
  },
  inputGroup: {
    marginBottom: 25,
  },
  inputLabel: {
    fontSize: 18,
    fontFamily: "Inder",
    fontWeight: "600",
    color: "#335C67",
    marginBottom: 10,
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 15,
    padding: 18,
    fontSize: 17,
    fontFamily: "Inder",
    backgroundColor: "#f9f9f9",
    color: "#333",
    minHeight: 55,
    textAlignVertical: "center",
    includeFontPadding: false,
    textAlign: "left",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 25,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    gap: 20,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 18,
    borderRadius: 15,
    alignItems: "center",
  },
  cancelButton: {
    // Background color applied dynamically with theme
  },
  saveButton: {
    // Background color applied dynamically with theme
  },
  cancelButtonText: {
    fontSize: 17,
    fontFamily: "Inder",
    fontWeight: "600",
    // Color applied dynamically with theme
  },
  saveButtonText: {
    fontSize: 17,
    fontFamily: "Inder",
    fontWeight: "600",
    // Color applied dynamically with theme
  },
  // Success Modal styles
  successModalContainer: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 30,
    alignItems: "center",
    maxWidth: 300,
    width: "90%",
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
  successModalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#335C67",
    marginBottom: 10,
    fontFamily: "Inder",
  },
  successModalMessage: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 25,
    lineHeight: 22,
    fontFamily: "Inder",
  },
  successModalButton: {
    backgroundColor: "#335C67",
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 30,
    minWidth: 100,
  },
  successModalButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
    fontFamily: "Inder",
  },
  // Image Picker Modal styles
  imagePickerModalContainer: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 30,
    alignItems: "center",
    maxWidth: 350,
    width: "90%",
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4, // Complete this property
  },
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
  imagePickerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#335C67",
    marginBottom: 10,
    fontFamily: "Inder",
  },
  imagePickerMessage: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 25,
    lineHeight: 22,
    fontFamily: "Inder",
  },
  imagePickerButtons: {
    width: "100%",
    gap: 15,
  },
  imagePickerButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#335C67",
    borderRadius: 15,
    paddingVertical: 15,
    paddingHorizontal: 20,
    gap: 15,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  imagePickerButtonIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  imagePickerButtonEmoji: {
    fontSize: 18,
  },
  imagePickerButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inder",
    flex: 1,
  },
  cancelImageButton: {
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
  },
  cancelImageButtonText: {
    color: "#666",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inder",
  },
  // Image selector styles
  imageContainer: {
    alignItems: "center",
    gap: 15,
  },
  selectedImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    // borderColor applied dynamically with theme
  },
  changePhotoButton: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cameraIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  cameraIconText: {
    fontSize: 14,
  },
  changePhotoText: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inder",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: "#666",
    fontFamily: "Inder",
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
  loadingModal: {
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
  loadingModalText: {
    marginTop: 10,
    fontSize: 16,
    color: "#335C67",
    fontFamily: "Inder",
  },

  // Vaccination Reminder Styles
  vaccinationSection: {
    marginTop: 15,
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
  },
  vaccinationSectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
    fontFamily: "Inder",
  },
  vaccinationAlert: {
    marginBottom: 8,
  },
  vaccinationAlertText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inder",
  },
  vaccinationUpcoming: {
    marginBottom: 8,
  },
  vaccinationUpcomingText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inder",
  },
  vaccinationButton: {
    // backgroundColor will be set dynamically based on vaccination status
  },
  vaccinationButtonText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inder",
    fontWeight: "600",
  },
  vaccinationHorseName: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
    fontFamily: "Inder",
  },
  existingVaccinations: {
    marginBottom: 25,
  },
  existingVaccinationsTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 15,
    fontFamily: "Inder",
  },
  vaccinationItem: {
    flexDirection: "row",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
  },
  vaccinationItemContent: {
    flex: 1,
  },
  vaccinationItemName: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
    fontFamily: "Inder",
  },
  vaccinationItemDate: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
    fontFamily: "Inder",
  },
  vaccinationItemNotes: {
    fontSize: 12,
    fontStyle: "italic",
    fontFamily: "Inder",
  },
  deleteVaccinationButton: {
    padding: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  deleteVaccinationButtonText: {
    fontSize: 16,
  },
  addVaccinationForm: {
    marginTop: 10,
  },
  addVaccinationTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 15,
    fontFamily: "Inder",
  },
  datePickerButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 15,
    padding: 18,
  },
  datePickerButtonText: {
    fontSize: 17,
    fontFamily: "Inder",
  },
  datePickerArrow: {
    fontSize: 16,
  },
  textInputMultiline: {
    height: 80,
    textAlignVertical: "top",
    paddingTop: 18,
  },
  datePickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  datePickerContainer: {
    width: "90%",
    maxWidth: 400,
    maxHeight: "70%",
    borderRadius: 15,
    padding: 20,
  },
  datePickerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
    fontFamily: "Inder",
  },
  datePickerScroll: {
    maxHeight: 300,
  },
  datePickerOption: {
    padding: 15,
    borderRadius: 8,
    marginBottom: 5,
  },
  datePickerOptionText: {
    fontSize: 16,
    textAlign: "center",
    fontFamily: "Inder",
  },
});

export default MyHorsesScreen;
