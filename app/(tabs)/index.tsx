import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import * as Sharing from "expo-sharing";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import { useDialog } from "../../contexts/DialogContext";
import { useMetric } from "../../contexts/MetricContext";
import { useTheme } from "../../contexts/ThemeContext";
import { HorseAPI } from "../../lib/horseAPI";
import PaymentService from "../../lib/paymentService";
import { PregnancyNotificationService } from "../../lib/pregnancyNotificationService";
import { Horse } from "../../lib/supabase";

// Pregnancy Timeline Types
type PregnancyStatus = "active" | "foaled" | "lost";
type BreedingMethod = "natural" | "AI" | "ICSI";
type CheckType = "US-14-16" | "Heartbeat-25-30" | "US-40-60" | "Sexing-55-70" | "Sexing-110-150" | "Fall-check";
type VaccineType = "EHV-1" | "Core-prefoal";
type AlertType = "red-bag" | "placenta>3h" | "discharge" | "fever" | "udder-premature";

interface PregnancyCheck {
  type: CheckType;
  date?: string;
  due?: string;
  result?: string;
  fetusSex?: string;
  notes?: string;
  done?: boolean;
}

interface PregnancyVaccine {
  type: VaccineType;
  due: string;
  date?: string; // Actual date when vaccine was given
  done?: boolean;
  notes?: string;
}

interface PregnancyHusbandry {
  bcsTarget?: string;
  fescueRemovedOn?: string | null;
  dietNotes?: string;
}

interface PregnancyDeworming {
  type: "pre-foaling";
  due: string;
  date?: string; // Actual date when deworming was done
  drug?: "ivermectin" | "benzimidazole";
  done?: boolean;
  notes?: string;
}

interface MilkCalciumReading {
  date: string;
  ppm: number;
  notes?: string;
}

interface PregnancyPhoto {
  date: string;
  dayPregnant: number;
  view: "left-lateral";
  url: string;
  month?: number;
}

interface PregnancyAlert {
  type: AlertType;
  active: boolean;
  date: string;
  notes?: string;
}

interface FoalingDetails {
  date: string;
  time?: string;
  foalSex?: string;
  foalWeight?: number;
  placentaPassedTime?: string;
  foalStoodTime?: string;
  foalNursedTime?: string;
  placentaPhoto?: string;
  complications?: string;
  notes?: string;
}

interface Pregnancy {
  id: string;
  horseId: string;
  status: PregnancyStatus;
  coverDate: string;
  ovulationDate?: string;
  dueDateEstimate: string;
  dueWindowStart: string;
  dueWindowEnd: string;
  stallion?: string;
  method?: BreedingMethod;
  vet?: {
    name?: string;
    phone?: string;
  };
  checks: PregnancyCheck[];
  vaccines: PregnancyVaccine[];
  husbandry?: PregnancyHusbandry;
  deworming: PregnancyDeworming[];
  milkCalcium: MilkCalciumReading[];
  photos: PregnancyPhoto[];
  alerts: PregnancyAlert[];
  notes?: string;
  foalingDetails?: FoalingDetails;
  createdAt: string;
  updatedAt: string;
}

// Dropdown options
const genderOptions = ["Stallion", "Mare", "Gelding"];

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
  const { showError, showDelete, showConfirm, showSuccess } = useDialog();
  const {
    formatHeight,
    formatWeight,
    formatHeightUnit,
    formatWeightUnit,
    convertHeightToMetric,
    convertHeightFromMetric,
    convertWeightToMetric,
    convertWeightFromMetric,
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
  const [showInlineImagePicker, setShowInlineImagePicker] = useState(false);

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

  // New Records modal state
  const [recordsModalVisible, setRecordsModalVisible] = useState(false);
  const [selectedHorseForRecords, setSelectedHorseForRecords] =
    useState<Horse | null>(null);
  const [recordsSection, setRecordsSection] = useState<
    "main" | "vaccination" | "document" | "rider" | "pregnancy"
  >("main");

  // Pregnancy state
  const [pregnancies, setPregnancies] = useState<Record<string, Pregnancy>>({});
  const [selectedPregnancy, setSelectedPregnancy] = useState<Pregnancy | null>(null);
  const [pregnancyView, setPregnancyView] = useState<"timeline" | "fruit" | "photos">("timeline");
  const [pregnancyModalVisible, setPregnancyModalVisible] = useState(false);
  
  // Pregnancy form state
  const [pregnancyCoverDate, setPregnancyCoverDate] = useState<Date | null>(null);
  const [pregnancyMethod, setPregnancyMethod] = useState<BreedingMethod>("natural");
  const [pregnancyVetName, setPregnancyVetName] = useState("");
  const [pregnancyVetPhone, setPregnancyVetPhone] = useState("");
  const [showPregnancyCoverDatePicker, setShowPregnancyCoverDatePicker] = useState(false);

  // Add Event Modal state
  const [addEventModalVisible, setAddEventModalVisible] = useState(false);
  const [showInlineAddEvent, setShowInlineAddEvent] = useState(false);
  const [eventType, setEventType] = useState<"ultrasound" | "vaccine" | "deworming" | "note">("ultrasound");
  const [eventDate, setEventDate] = useState<Date | null>(null);
  const [eventNotes, setEventNotes] = useState("");
  const [showEventDatePicker, setShowEventDatePicker] = useState(false);

  // Photo capture state
  const [photoCaptureModalVisible, setPhotoCaptureModalVisible] = useState(false);
  const [showInlinePregnancyPhotoPicker, setShowInlinePregnancyPhotoPicker] = useState(false);


  // Enhanced vaccination state
  const [vaccinationId, setVaccinationId] = useState("");
  const [vaccinationType, setVaccinationType] = useState<"future" | "past">(
    "future"
  );
  const [vaccinationRepeat, setVaccinationRepeat] = useState(false);
  const [vaccinationRepeatInterval, setVaccinationRepeatInterval] = useState<
    "monthly" | "quarterly" | "yearly"
  >("yearly");

  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingVaccination, setEditingVaccination] = useState<any | null>(
    null
  );
  const [applyToFuture, setApplyToFuture] = useState(false);

  // Document manager state
  const [documentSyncEnabled, setDocumentSyncEnabled] = useState(false);
  const [horseDocuments, setHorseDocuments] = useState<{
    [horseId: string]: any[];
  }>({});
  const [documentViewerVisible, setDocumentViewerVisible] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<any | null>(null);
  const [editingDocumentId, setEditingDocumentId] = useState<string | null>(null);
  const [editingDocumentName, setEditingDocumentName] = useState("");

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

  // Daily pregnancy notification check
  useEffect(() => {
    if (user?.id && Object.keys(pregnancies).length > 0) {
      const pregnancyList = Object.values(pregnancies).map(p => {
        const horse = horses.find(h => h.id === p.horseId);
        return {
          ...p,
          horseName: horse?.name
        };
      });
      
      PregnancyNotificationService.dailyPregnancyCheck(pregnancyList).catch(error => {
        console.error('Failed to check pregnancy notifications:', error);
      });
    }
  }, [user?.id, pregnancies, horses]);

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
    // Convert height and weight from metric (stored) to current system for editing
    setEditHeight(Math.round(convertHeightFromMetric(horse.height)).toString());
    setEditWeight(
      horse.weight
        ? Math.round(convertWeightFromMetric(horse.weight)).toString()
        : ""
    );
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
    setShowInlineImagePicker(false);
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
    setShowInlineImagePicker(false);
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
    const heightInMetric = Math.round(convertHeightToMetric(heightNum));
    if (isNaN(heightNum) || heightInMetric < 50 || heightInMetric > 250) {
      const heightUnit = metricSystem === "metric" ? "cm" : "inches";
      const minHeight = metricSystem === "metric" ? "50" : "20";
      const maxHeight = metricSystem === "metric" ? "300" : "118";
      showError(
        `Please enter a valid height (${minHeight}-${maxHeight} ${heightUnit})`
      );
      return;
    }

    let weightNum = null; // Use null instead of undefined for proper deletion
    let weightInMetric = null;
    if (normalizedWeight) {
      weightNum = parseInt(normalizedWeight);
      weightInMetric = Math.round(convertWeightToMetric(weightNum));
      if (isNaN(weightNum) || weightInMetric < 50 || weightInMetric > 2000) {
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
        height: heightInMetric, // Store in metric (cm)
        weight: weightInMetric, // Store in metric (kg) - This will be null if weight field is cleared
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
    const heightInMetric = Math.round(convertHeightToMetric(heightNum));
    if (isNaN(heightNum) || heightInMetric < 50 || heightInMetric > 250) {
      const heightUnit = metricSystem === "metric" ? "cm" : "inches";
      const minHeight = metricSystem === "metric" ? "50" : "20";
      const maxHeight = metricSystem === "metric" ? "250" : "98";
      showError(
        `Please enter a valid height (${minHeight}-${maxHeight} ${heightUnit})`
      );
      return;
    }

    let weightNum = null; // Use null instead of undefined for consistency
    let weightInMetric = null;
    if (normalizedWeight) {
      weightNum = parseInt(normalizedWeight);
      weightInMetric = Math.round(convertWeightToMetric(weightNum));
      if (isNaN(weightNum) || weightInMetric < 50 || weightInMetric > 2000) {
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
        height: heightInMetric, // Store in metric (cm)
        weight: weightInMetric, // Store in metric (kg)
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

          // Clean up pregnancy data for deleted horse
          if (pregnancies[horse.id]) {
            const updatedPregnancies = { ...pregnancies };
            delete updatedPregnancies[horse.id];
            await savePregnancies(updatedPregnancies);
            console.log(
              `🗑️ Removed pregnancy data for deleted horse: ${horse.name}`
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

  // Pregnancy data persistence functions
  const loadPregnancies = async () => {
    try {
      const savedPregnancies = await AsyncStorage.getItem(
        `pregnancies_${user?.id}`
      );
      if (savedPregnancies) {
        setPregnancies(JSON.parse(savedPregnancies));
      }
    } catch (error) {
      console.error("Error loading pregnancies:", error);
    }
  };

  const savePregnancies = async (pregnancyData: Record<string, Pregnancy>) => {
    try {
      await AsyncStorage.setItem(
        `pregnancies_${user?.id}`,
        JSON.stringify(pregnancyData)
      );
      setPregnancies(pregnancyData);
    } catch (error) {
      console.error("Error saving pregnancies:", error);
      showError("Failed to save pregnancy data");
    }
  };

  // Records modal functions
  const openRecordsModal = (horse: Horse) => {
    setSelectedHorseForRecords(horse);
    setRecordsSection("main");
    setRecordsModalVisible(true);
  };

  const closeRecordsModal = () => {
    setRecordsModalVisible(false);
    setSelectedHorseForRecords(null);
    setRecordsSection("main");
    // Reset all sub-modal states
    setVaccinationModalVisible(false);
    setSelectedHorseForVaccination(null);
    setVaccinationName("");
    setVaccinationId("");
    setVaccinationDate(null);
    setVaccinationNotes("");
    setVaccinationType("future");
    setVaccinationRepeat(false);
    setShowVaccinationDatePicker(false);
  };

  const openVaccinationManager = () => {
    setSelectedHorseForVaccination(selectedHorseForRecords);
    setRecordsSection("vaccination");
    setVaccinationName("");
    setVaccinationId("");
    setVaccinationDate(null);
    setVaccinationNotes("");
    setVaccinationType("future");
    setVaccinationRepeat(false);
    setShowVaccinationDatePicker(false);
  };

  const openDocumentManager = () => {
    setRecordsSection("document");
  };

  const openRiderManager = () => {
    setRecordsSection("rider");
  };

  const openPregnancyManager = () => {
    // Check if user is PRO member
    if (!isProMember) {
      router.push("/pro-features");
      return;
    }
    
    if (selectedHorseForRecords && selectedHorseForRecords.gender === "Mare") {
      const pregnancy = pregnancies[selectedHorseForRecords.id];
      setSelectedPregnancy(pregnancy || null);
      setRecordsSection("pregnancy");
    }
  };

  const backToRecordsMain = () => {
    setRecordsSection("main");
    setShowInlinePregnancyPhotoPicker(false);
  };

  // Pregnancy helper functions
  const addDays = (date: Date, days: number): string => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result.toISOString().split('T')[0];
  };

  const addMonths = (date: Date, months: number): string => {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result.toISOString().split('T')[0];
  };

  const buildPregnancyPlan = (coverDate: string): Omit<Pregnancy, 'id' | 'horseId' | 'createdAt' | 'updatedAt' | 'status'> => {
    const cover = new Date(coverDate);
    return {
      coverDate,
      dueDateEstimate: addDays(cover, 340),
      dueWindowStart: addDays(cover, 320),
      dueWindowEnd: addDays(cover, 362),
      checks: [
        { type: "US-14-16", due: addDays(cover, 14), done: false },
        { type: "Heartbeat-25-30", due: addDays(cover, 26), done: false },
        { type: "US-40-60", due: addDays(cover, 50), done: false },
        { type: "Sexing-55-70", due: addDays(cover, 62), done: false },
        { type: "Fall-check", due: addDays(cover, 200), done: false }
      ],
      vaccines: [
        { type: "EHV-1", due: addMonths(cover, 5), done: false },
        { type: "EHV-1", due: addMonths(cover, 7), done: false },
        { type: "EHV-1", due: addMonths(cover, 9), done: false },
        { type: "Core-prefoal", due: addDays(cover, 305), done: false }
      ],
      deworming: [
        { type: "pre-foaling", due: addDays(cover, 338), done: false }
      ],
      milkCalcium: [],
      photos: [],
      alerts: []
    };
  };

  const createPregnancy = (horseId: string, coverDate: string, stallion?: string, method?: BreedingMethod) => {
    const pregnancyId = `pregnancy-${horseId}-${Date.now()}`;
    const plan = buildPregnancyPlan(coverDate);
    const newPregnancy: Pregnancy = {
      id: pregnancyId,
      horseId,
      status: "active",
      ...plan,
      stallion,
      method,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setPregnancies(prev => ({ ...prev, [horseId]: newPregnancy }));
    setSelectedPregnancy(newPregnancy);
  };

  const getDaysPregnant = (pregnancy: Pregnancy): number => {
    const cover = new Date(pregnancy.coverDate);
    const today = new Date();
    const diff = today.getTime() - cover.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  const getPregnancyMonth = (daysPregnant: number): number => {
    return Math.min(Math.floor(daysPregnant / 30) + 1, 11);
  };

  const getNextAction = (pregnancy: Pregnancy): { text: string; daysUntil: number; type: 'check' | 'vaccine' | 'deworming'; date: string } | null => {
    const today = new Date();
    const upcoming = [
      ...pregnancy.checks.filter(c => !c.done && c.due).map(c => ({ text: `Ultrasound: ${c.type}`, date: c.due!, type: 'check' as const })),
      ...pregnancy.vaccines.filter(v => !v.done).map(v => ({ text: `Vaccine: ${v.type}`, date: v.due, type: 'vaccine' as const })),
      ...pregnancy.deworming.filter(d => !d.done).map(d => ({ text: `Deworm (pre-foaling)`, date: d.due, type: 'deworming' as const }))
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (upcoming.length > 0) {
      const next = upcoming[0];
      const daysUntil = Math.ceil((new Date(next.date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return { text: next.text, daysUntil, type: next.type, date: next.date };
    }
    return null;
  };

  const formatDueDateRange = (dueDateStr: string): string => {
    const dueDate = new Date(dueDateStr);
    const earlyDate = new Date(dueDate);
    earlyDate.setDate(dueDate.getDate() - 20);
    const lateDate = new Date(dueDate);
    lateDate.setDate(dueDate.getDate() + 20);
    
    return `${earlyDate.toLocaleDateString()} - ${lateDate.toLocaleDateString()}`;
  };

  const getMonthInfo = (month: number): { fruit: string; size: string; description: string } => {
    const monthData = [
      { fruit: "🫐", size: "Grape/Blueberry (~1 cm)", description: "Embryo visible; first ultrasound at D14-16; heartbeat by D24-26" },
      { fruit: "🍑", size: "Plum/Kiwi (~3-4 cm)", description: "Rapid growth; confirm heartbeat; recheck for twins" },
      { fruit: "🍋", size: "Lemon to Small Pear (~12-15 cm)", description: "Organs forming; major development phase" },
      { fruit: "🍆", size: "Small Eggplant (~20 cm)", description: "Facial hair buds appear" },
      { fruit: "🥒", size: "Butternut Squash (~30 cm)", description: "Eyelids and coat developing; EHV-1 vaccine due" },
      { fruit: "🍉", size: "Small Watermelon (~40 cm)", description: "Clear weight gain begins in mare" },
      { fruit: "🍉", size: "Medium Watermelon (~50 cm)", description: "Tail hair appears; EHV-1 vaccine due" },
      { fruit: "🎃", size: "Large Pumpkin (~60 cm)", description: "Mane and back hair developing" },
      { fruit: "🎃", size: "Giant Pumpkin (~70 cm)", description: "Fine coat over body; EHV-1 vaccine due; remove fescue" },
      { fruit: "🍉", size: "Very Large Watermelon (~80 cm)", description: "Major growth spurt; increase feed; prep foaling area" },
      { fruit: "🎃", size: "Massive Pumpkin (~90+ cm)", description: "Final preparations; watch for foaling signs; pre-foaling deworm" }
    ];
    return monthData[Math.min(month - 1, 10)];
  };

  const handleStartPregnancy = () => {
    if (!pregnancyCoverDate || !selectedHorseForRecords) {
      showError("Please select a cover date to continue.");
      return;
    }

    const coverDateStr = pregnancyCoverDate.toISOString().split('T')[0];
    
    // Store temp variables
    const tempCoverDate = pregnancyCoverDate;
    const tempMethod = pregnancyMethod;
    const tempVetName = pregnancyVetName;
    const tempVetPhone = pregnancyVetPhone;
    const tempHorseId = selectedHorseForRecords.id;
    const tempHorseName = selectedHorseForRecords.name;

    // Create the pregnancy object immediately to prevent flickering
    const pregnancyId = `pregnancy-${tempHorseId}-${Date.now()}`;
    const plan = buildPregnancyPlan(coverDateStr);
    const newPregnancy: Pregnancy = {
      id: pregnancyId,
      horseId: tempHorseId,
      status: "active",
      ...plan,
      method: tempMethod,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      vet: (tempVetName || tempVetPhone) ? {
        name: tempVetName || undefined,
        phone: tempVetPhone || undefined
      } : undefined
    };
    
    // Update all state together to prevent race conditions
    setPregnancyCoverDate(null);
    setPregnancyMethod("natural");
    setPregnancyVetName("");
    setPregnancyVetPhone("");
    setPregnancyModalVisible(false);
    
    const updatedPregnancies = { ...pregnancies, [tempHorseId]: newPregnancy };
    setPregnancies(updatedPregnancies);
    setSelectedPregnancy(newPregnancy);
    
    // Save to AsyncStorage
    savePregnancies(updatedPregnancies);

    // Schedule pregnancy notifications
    PregnancyNotificationService.scheduleAllNotifications({
      ...newPregnancy,
      horseName: tempHorseName
    }).catch(error => {
      console.error('Failed to schedule pregnancy notifications:', error);
    });

    showSuccess(`Pregnancy tracking started for ${tempHorseName}!`);
  };

  const handleCompleteNextAction = () => {
    if (!selectedPregnancy) return;

    const nextAction = getNextAction(selectedPregnancy);
    if (!nextAction) return;

    // Prevent completing future actions (only allow today or overdue)
    if (nextAction.daysUntil > 0) {
      showError("Cannot complete future actions. This action is not due yet.");
      return;
    }

    const updatedPregnancy = { ...selectedPregnancy };
    const todayStr = new Date().toISOString().split('T')[0];

    // Mark the action as complete based on type and set completion date to TODAY
    if (nextAction.type === 'check') {
      const checkIndex = updatedPregnancy.checks.findIndex(
        c => !c.done && c.due === nextAction.date
      );
      if (checkIndex !== -1) {
        updatedPregnancy.checks[checkIndex].done = true;
        // Set the actual date when it was completed (today)
        updatedPregnancy.checks[checkIndex].date = todayStr;
      }
    } else if (nextAction.type === 'vaccine') {
      const vaccineIndex = updatedPregnancy.vaccines.findIndex(
        v => !v.done && v.due === nextAction.date
      );
      if (vaccineIndex !== -1) {
        updatedPregnancy.vaccines[vaccineIndex].done = true;
        // Set the actual date when it was completed (today) - appears at top
        updatedPregnancy.vaccines[vaccineIndex].date = todayStr;
      }
    } else if (nextAction.type === 'deworming') {
      const dewormIndex = updatedPregnancy.deworming.findIndex(
        d => !d.done && d.due === nextAction.date
      );
      if (dewormIndex !== -1) {
        updatedPregnancy.deworming[dewormIndex].done = true;
        // Set the actual date when it was completed (today) - appears at top
        updatedPregnancy.deworming[dewormIndex].date = todayStr;
      }
    }

    updatedPregnancy.updatedAt = new Date().toISOString();

    // Update pregnancy
    const updatedPregnancies = {
      ...pregnancies,
      [updatedPregnancy.horseId]: updatedPregnancy
    };
    setPregnancies(updatedPregnancies);
    setSelectedPregnancy(updatedPregnancy);
    
    // Save to AsyncStorage
    savePregnancies(updatedPregnancies);

    // Update notifications (reschedule based on remaining actions)
    const horseName = horses.find(h => h.id === updatedPregnancy.horseId)?.name;
    PregnancyNotificationService.updatePregnancyNotifications({
      ...updatedPregnancy,
      horseName
    }).catch(error => {
      console.error('Failed to update pregnancy notifications:', error);
    });

    showSuccess("Action completed and added to Event Timeline!");
  };

  const handleAddEvent = () => {
    if (!eventDate || !selectedPregnancy) {
      showError("Please select an event date.");
      return;
    }

    const eventDateStr = eventDate.toISOString().split('T')[0];
    const updatedPregnancy = { ...selectedPregnancy };

    if (eventType === "ultrasound") {
      updatedPregnancy.checks.push({
        type: "US-40-60" as CheckType,
        date: eventDateStr,
        done: true,
        notes: eventNotes || undefined
      });
    } else if (eventType === "vaccine") {
      updatedPregnancy.vaccines.push({
        type: "EHV-1" as VaccineType,
        due: eventDateStr,
        done: true,
        notes: eventNotes || undefined
      });
    } else if (eventType === "deworming") {
      updatedPregnancy.deworming.push({
        type: "pre-foaling",
        due: eventDateStr,
        done: true,
        notes: eventNotes || undefined
      });
    }

    updatedPregnancy.updatedAt = new Date().toISOString();

    // Update pregnancy
    const updatedPregnancies = {
      ...pregnancies,
      [updatedPregnancy.horseId]: updatedPregnancy
    };
    setPregnancies(updatedPregnancies);
    setSelectedPregnancy(updatedPregnancy);
    
    // Save to AsyncStorage
    savePregnancies(updatedPregnancies);

    // Reset form
    setEventDate(null);
    setEventNotes("");
    setEventType("ultrasound");
    setAddEventModalVisible(false);
    setShowInlineAddEvent(false);

    showSuccess("Event added successfully!");
  };

  const handleCapturePhoto = async () => {
    if (!selectedPregnancy) return;

    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    
    if (!permissionResult.granted) {
      showError("Camera permission is required to capture photos.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const photo: PregnancyPhoto = {
        date: new Date().toISOString().split('T')[0],
        dayPregnant: getDaysPregnant(selectedPregnancy),
        view: "left-lateral",
        url: result.assets[0].uri,
        month: getPregnancyMonth(getDaysPregnant(selectedPregnancy))
      };

      const updatedPregnancy = {
        ...selectedPregnancy,
        photos: [...(selectedPregnancy.photos || []), photo],
        updatedAt: new Date().toISOString()
      };

      const updatedPregnancies = {
        ...pregnancies,
        [updatedPregnancy.horseId]: updatedPregnancy
      };
      setPregnancies(updatedPregnancies);
      setSelectedPregnancy(updatedPregnancy);
      
      // Save to AsyncStorage
      savePregnancies(updatedPregnancies);

      showSuccess("Photo captured successfully!");
    }
  };

  const handlePickPhotoFromLibrary = async () => {
    if (!selectedPregnancy) return;

    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (!permissionResult.granted) {
      showError("Photo library permission is required.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const photo: PregnancyPhoto = {
        date: new Date().toISOString().split('T')[0],
        dayPregnant: getDaysPregnant(selectedPregnancy),
        view: "left-lateral",
        url: result.assets[0].uri,
        month: getPregnancyMonth(getDaysPregnant(selectedPregnancy))
      };

      const updatedPregnancy = {
        ...selectedPregnancy,
        photos: [...(selectedPregnancy.photos || []), photo],
        updatedAt: new Date().toISOString()
      };

      const updatedPregnancies = {
        ...pregnancies,
        [updatedPregnancy.horseId]: updatedPregnancy
      };
      setPregnancies(updatedPregnancies);
      setSelectedPregnancy(updatedPregnancy);
      
      // Save to AsyncStorage
      savePregnancies(updatedPregnancies);

      showSuccess("Photo added successfully!");
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
    setIsEditMode(false);
    setEditingVaccination(null);
    setApplyToFuture(false);
    setVaccinationId("");
    setVaccinationType("future");
    setVaccinationRepeat(false);
    setVaccinationRepeatInterval("yearly");
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

    const updatedVaccinations = { ...horseVaccinations };
    if (!updatedVaccinations[selectedHorseForVaccination.id]) {
      updatedVaccinations[selectedHorseForVaccination.id] = [];
    }

    // Calculate next due date for recurring reminders
    let nextDueDate = null;
    if (vaccinationRepeat && vaccinationType === "future") {
      const currentDate = new Date(vaccinationDate);
      const next = new Date(currentDate);
      switch (vaccinationRepeatInterval) {
        case "monthly":
          next.setMonth(next.getMonth() + 1);
          break;
        case "quarterly":
          next.setMonth(next.getMonth() + 3);
          break;
        case "yearly":
          next.setFullYear(next.getFullYear() + 1);
          break;
      }
      nextDueDate = next.toISOString();
    }

    if (isEditMode && editingVaccination) {
      // Edit existing vaccination
      const index = updatedVaccinations[
        selectedHorseForVaccination.id
      ].findIndex((v) => v.id === editingVaccination.id);

      if (index !== -1) {
        // Update the main record
        updatedVaccinations[selectedHorseForVaccination.id][index] = {
          ...editingVaccination,
          name: vaccinationName.trim(),
          vaccinationId: vaccinationId.trim() || null,
          date: vaccinationDate.toISOString(),
          notes: vaccinationNotes.trim(),
          type: vaccinationType,
          repeat: vaccinationRepeat,
          repeatInterval: vaccinationRepeat ? vaccinationRepeatInterval : null,
          nextDueDate: nextDueDate,
        };

        // If applying to all future recurring records created by the old system
        if (applyToFuture && editingVaccination.repeat) {
          // Find all records with the same originalId or that are recurring from this record
          updatedVaccinations[selectedHorseForVaccination.id] =
            updatedVaccinations[selectedHorseForVaccination.id].map((v) => {
              if (
                v.id === editingVaccination.id ||
                v.originalId === editingVaccination.id ||
                v.originalId === editingVaccination.originalId
              ) {
                // Calculate new date based on the interval offset
                if (v.id !== editingVaccination.id && v.type === "future") {
                  const originalDate = new Date(editingVaccination.date);
                  const updatedDate = new Date(vaccinationDate);
                  const timeDiff =
                    updatedDate.getTime() - originalDate.getTime();
                  const currentVacDate = new Date(v.date);
                  const newVacDate = new Date(
                    currentVacDate.getTime() + timeDiff
                  );

                  return {
                    ...v,
                    name: vaccinationName.trim(),
                    vaccinationId: vaccinationId.trim() || null,
                    date: newVacDate.toISOString(),
                    notes: vaccinationNotes.trim(),
                    repeatInterval: vaccinationRepeat
                      ? vaccinationRepeatInterval
                      : null,
                  };
                }
                return v;
              }
              return v;
            });
        }

        // Cancel old notifications and schedule new ones
        await cancelVaccinationNotifications(editingVaccination.id);
        if (vaccinationType === "future") {
          await scheduleVaccinationNotifications(
            updatedVaccinations[selectedHorseForVaccination.id][index],
            selectedHorseForVaccination.name
          );
        }
      }

      setSuccessMessage(
        `Vaccination ${
          vaccinationType === "past" ? "record" : "reminder"
        } updated for ${selectedHorseForVaccination.name}`
      );
    } else {
      // Create new vaccination
      const newVaccination = {
        id: Date.now().toString(),
        name: vaccinationName.trim(),
        vaccinationId: vaccinationId.trim() || null,
        date: vaccinationDate.toISOString(),
        notes: vaccinationNotes.trim(),
        type: vaccinationType,
        repeat: vaccinationRepeat,
        repeatInterval: vaccinationRepeat ? vaccinationRepeatInterval : null,
        createdAt: new Date().toISOString(),
        nextDueDate: nextDueDate,
        lastCompletedDate: null,
        occurrenceCount: 0,
      };

      updatedVaccinations[selectedHorseForVaccination.id].push(newVaccination);

      // Schedule notifications only for future vaccinations
      if (vaccinationType === "future") {
        await scheduleVaccinationNotifications(
          newVaccination,
          selectedHorseForVaccination.name
        );
      }

      setSuccessMessage(
        `Vaccination ${vaccinationType === "past" ? "record" : "reminder"} ${
          vaccinationRepeat ? "with recurring schedule " : ""
        }set for ${selectedHorseForVaccination.name}`
      );
    }

    await saveVaccinationReminders(updatedVaccinations);

    // Reset form
    setVaccinationName("");
    setVaccinationId("");
    setVaccinationDate(null);
    setVaccinationNotes("");
    setVaccinationType("future");
    setVaccinationRepeat(false);
    setShowVaccinationDatePicker(false);
    setIsEditMode(false);
    setEditingVaccination(null);
    setApplyToFuture(false);

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

  const markVaccinationAsCompleted = async (
    horseId: string,
    vaccinationId: string
  ) => {
    const updatedVaccinations = { ...horseVaccinations };
    if (!updatedVaccinations[horseId]) return;

    const index = updatedVaccinations[horseId].findIndex(
      (v) => v.id === vaccinationId
    );

    if (index === -1) return;

    const vaccination = updatedVaccinations[horseId][index];

    // If it's a recurring reminder, update to next occurrence
    if (
      vaccination.repeat &&
      vaccination.type === "future" &&
      vaccination.repeatInterval
    ) {
      const currentDate = new Date(vaccination.date);
      const nextDate = new Date(currentDate);

      switch (vaccination.repeatInterval) {
        case "monthly":
          nextDate.setMonth(nextDate.getMonth() + 1);
          break;
        case "quarterly":
          nextDate.setMonth(nextDate.getMonth() + 3);
          break;
        case "yearly":
          nextDate.setFullYear(nextDate.getFullYear() + 1);
          break;
      }

      // Calculate new next due date
      const newNextDueDate = new Date(nextDate);
      switch (vaccination.repeatInterval) {
        case "monthly":
          newNextDueDate.setMonth(newNextDueDate.getMonth() + 1);
          break;
        case "quarterly":
          newNextDueDate.setMonth(newNextDueDate.getMonth() + 3);
          break;
        case "yearly":
          newNextDueDate.setFullYear(newNextDueDate.getFullYear() + 1);
          break;
      }

      // Update the vaccination record
      updatedVaccinations[horseId][index] = {
        ...vaccination,
        date: nextDate.toISOString(),
        lastCompletedDate: currentDate.toISOString(),
        nextDueDate: newNextDueDate.toISOString(),
        occurrenceCount: (vaccination.occurrenceCount || 0) + 1,
      };

      // Cancel old notification and schedule new one
      await cancelVaccinationNotifications(vaccinationId);
      await scheduleVaccinationNotifications(
        updatedVaccinations[horseId][index],
        horseVaccinations[horseId]?.find(() => true)?.name || "Horse"
      );

      setSuccessMessage(
        "Vaccination marked as completed. Next reminder scheduled."
      );
    } else {
      // If it's not recurring, just change it to past type
      updatedVaccinations[horseId][index] = {
        ...vaccination,
        type: "past",
        date: new Date().toISOString(),
      };

      // Cancel notification
      await cancelVaccinationNotifications(vaccinationId);

      setSuccessMessage("Vaccination marked as completed.");
    }

    await saveVaccinationReminders(updatedVaccinations);
    setShowSuccessModal(true);
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

  // Document Management Functions
  const loadHorseDocuments = async () => {
    try {
      const savedDocuments = await AsyncStorage.getItem(
        `horse_documents_${user?.id}`
      );
      if (savedDocuments) {
        setHorseDocuments(JSON.parse(savedDocuments));
      }
    } catch (error) {
      console.error("Error loading horse documents:", error);
    }
  };

  const saveHorseDocuments = async (documents: {
    [horseId: string]: any[];
  }) => {
    try {
      await AsyncStorage.setItem(
        `horse_documents_${user?.id}`,
        JSON.stringify(documents)
      );
      setHorseDocuments(documents);
    } catch (error) {
      console.error("Error saving horse documents:", error);
      showError("Failed to save document");
    }
  };

  const addDocument = async () => {
    if (!selectedHorseForRecords) return;

    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      showError("Permission to access gallery is required!");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: false,
      quality: 1,
      base64: false,
    });

    if (!result.canceled && result.assets[0]) {
      const newDocument = {
        id: Date.now().toString(),
        uri: result.assets[0].uri,
        name: `Document_${Date.now()}`,
        type: "image",
        createdAt: new Date().toISOString(),
        synced: false, // For future pro sync feature
      };

      const updatedDocuments = { ...horseDocuments };
      if (!updatedDocuments[selectedHorseForRecords.id]) {
        updatedDocuments[selectedHorseForRecords.id] = [];
      }
      updatedDocuments[selectedHorseForRecords.id].push(newDocument);

      await saveHorseDocuments(updatedDocuments);
      setSuccessMessage("Document added successfully!");
      setShowSuccessModal(true);
    }
  };

  const deleteDocument = async (horseId: string, documentId: string) => {
    const updatedDocuments = { ...horseDocuments };
    if (updatedDocuments[horseId]) {
      updatedDocuments[horseId] = updatedDocuments[horseId].filter(
        (d) => d.id !== documentId
      );
      if (updatedDocuments[horseId].length === 0) {
        delete updatedDocuments[horseId];
      }
    }
    await saveHorseDocuments(updatedDocuments);
  };

  const startEditingDocumentName = (document: any) => {
    setEditingDocumentId(document.id);
    setEditingDocumentName(document.name);
  };

  const cancelEditingDocumentName = () => {
    setEditingDocumentId(null);
    setEditingDocumentName("");
  };

  const saveDocumentRename = async (horseId: string, documentId: string) => {
    if (!editingDocumentName.trim()) {
      showError("Please enter a valid name");
      return;
    }

    const updatedDocuments = { ...horseDocuments };

    if (updatedDocuments[horseId]) {
      const index = updatedDocuments[horseId].findIndex(
        (d) => d.id === documentId
      );

      if (index !== -1) {
        updatedDocuments[horseId][index] = {
          ...updatedDocuments[horseId][index],
          name: editingDocumentName.trim(),
        };

        await saveHorseDocuments(updatedDocuments);
        cancelEditingDocumentName();
      }
    }
  };

  const openDocument = (document: any) => {
    setSelectedDocument(document);
    setDocumentViewerVisible(true);
  };

  const shareDocument = async () => {
    if (!selectedDocument) return;

    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(selectedDocument.uri);
      } else {
        // Fallback: try to open with Linking
        const supported = await Linking.canOpenURL(selectedDocument.uri);
        if (supported) {
          await Linking.openURL(selectedDocument.uri);
        } else {
          showError("Cannot open this document");
        }
      }
    } catch (error) {
      console.error("Error sharing document:", error);
      showError("Failed to open document");
    }
  };

  const toggleDocumentSync = () => {
    console.log("toggleDocumentSync called, isProMember:", isProMember);
    if (!isProMember) {
      console.log("Non-PRO user, navigating to pro-features");
      showConfirm(
        "PRO Feature Required",
        "Cloud sync is a PRO feature. Would you like to upgrade to PRO to sync your documents to the cloud?",
        () => {
          router.push("/pro-features");
        }
      );
      return;
    }
    console.log("PRO user, toggling sync state");
    setDocumentSyncEnabled(!documentSyncEnabled);
    // TODO: Implement backend sync for PRO users
  };

  const getHorseDocuments = (horseId: string) => {
    return horseDocuments[horseId] || [];
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
      const notesText = vaccination.notes ? ` Notes: ${vaccination.notes}` : "";
      const notifications = [
        {
          date: oneWeekBefore,
          title: `🩺 Vaccination Reminder - 1 Week`,
          body: `${horseName} has a vaccination (${
            vaccination.name
          }) due in 1 week on ${dueDate.toLocaleDateString()}${notesText}`,
          identifier: `${vaccination.id}_week`,
        },
        {
          date: twoDaysBefore,
          title: `💉 Vaccination Reminder - 2 Days`,
          body: `${horseName} has a vaccination (${vaccination.name}) due in 2 days${notesText}`,
          identifier: `${vaccination.id}_2days`,
        },
        {
          date: oneDayBefore,
          title: `⚠️ Vaccination Reminder - Tomorrow`,
          body: `${horseName} has a vaccination (${vaccination.name}) due tomorrow!${notesText}`,
          identifier: `${vaccination.id}_1day`,
        },
        {
          date: onTheDay,
          title: `🚨 Vaccination Due Today!`,
          body: `${horseName} vaccination (${vaccination.name}) is due today!${notesText}`,
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

  // Load vaccination reminders and pregnancies when component mounts
  useEffect(() => {
    if (user?.id) {
      loadVaccinationReminders();
      loadHorseDocuments();
      loadPregnancies();
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

  // Vaccination Date Picker Component (for Due Date / Completed Date)
  const VaccinationDatePicker = ({
    value,
    vaccinationType,
    onSelect,
    isVisible,
    setVisible,
  }: {
    value: Date | null;
    vaccinationType: "past" | "future";
    onSelect: (date: Date) => void;
    isVisible: boolean;
    setVisible: (visible: boolean) => void;
  }) => {
    const currentDate = new Date();
    const [selectedDay, setSelectedDay] = useState(
      value?.getDate() || currentDate.getDate()
    );
    const [selectedMonth, setSelectedMonth] = useState(
      value?.getMonth() || currentDate.getMonth()
    );
    const [selectedYear, setSelectedYear] = useState(
      value?.getFullYear() || currentDate.getFullYear()
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
      const currentYear = currentDate.getFullYear();
      if (vaccinationType === "past") {
        // For past vaccinations: show from 10 years ago to current year
        for (let i = currentYear; i >= currentYear - 10; i--) {
          years.push(i);
        }
      } else {
        // For future vaccinations: show from current year to 5 years ahead
        for (let i = currentYear; i <= currentYear + 5; i++) {
          years.push(i);
        }
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

    const handleConfirm = () => {
      const newDate = new Date(selectedYear, selectedMonth, selectedDay);
      onSelect(newDate);
      setVisible(false);
    };

    const formatDate = (date: Date) => {
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
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
            {value
              ? formatDate(value)
              : `Select ${
                  vaccinationType === "past" ? "completion" : "due"
                } date`}
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
                {vaccinationType === "past"
                  ? "Select Completed Date"
                  : "Select Due Date"}
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
                            fontWeight: selectedDay === day ? "bold" : "normal",
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

                  {/* Pregnancy Timeline Section */}
                  {horse.gender === "Mare" && pregnancies[horse.id] && pregnancies[horse.id].status === "active" && (
                    <View
                      style={[
                        styles.pregnancySection,
                        {
                          backgroundColor: currentTheme.colors.surface,
                          borderColor: currentTheme.colors.border,
                        },
                      ]}
                    >
                      <View style={styles.pregnancySectionHeader}>
                        <Text
                          style={[
                            styles.pregnancySectionTitle,
                            { color: currentTheme.colors.text },
                          ]}
                        >
                          Pregnancy Timeline
                        </Text>
                        <Text
                          style={[
                            styles.pregnancyDayCount,
                            { color: currentTheme.colors.textSecondary },
                          ]}
                        >
                          Day {getDaysPregnant(pregnancies[horse.id])}
                        </Text>
                      </View>

                      {/* Segmented Progress Bar */}
                      <View style={styles.pregnancyProgressContainer}>
                        <View style={[styles.pregnancyProgressBar, { backgroundColor: currentTheme.colors.secondary }]}>
                          {/* Progress Fill */}
                          <View 
                            style={[
                              styles.pregnancyProgressFill,
                              { 
                                width: `${Math.min((getDaysPregnant(pregnancies[horse.id]) / 340) * 100, 100)}%`,
                                backgroundColor: currentTheme.colors.primary
                              }
                            ]}
                          />
                          {/* Stage Dividers */}
                          <View style={[styles.pregnancyStageDivider, { left: '33.33%', backgroundColor: currentTheme.colors.surface }]} />
                          <View style={[styles.pregnancyStageDivider, { left: '66.66%', backgroundColor: currentTheme.colors.surface }]} />
                        </View>
                        
                        {/* Stage Labels */}
                        <View style={styles.pregnancyStageLabels}>
                          <Text style={[styles.pregnancyStageLabel, { color: currentTheme.colors.textSecondary }]}>Early</Text>
                          <Text style={[styles.pregnancyStageLabel, { color: currentTheme.colors.textSecondary }]}>Mid</Text>
                          <Text style={[styles.pregnancyStageLabel, { color: currentTheme.colors.textSecondary }]}>Late</Text>
                        </View>
                      </View>

                      {/* Due Date */}
                      <Text
                        style={[
                          styles.pregnancyDueDate,
                          { color: currentTheme.colors.textSecondary },
                        ]}
                      >
                        Due: {formatDueDateRange(pregnancies[horse.id].dueDateEstimate)}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[
                      styles.primaryActionButton,
                      { backgroundColor: currentTheme.colors.primary },
                    ]}
                    onPress={() => openRecordsModal(horse)}
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
        visible={editModalVisible}
        onRequestClose={closeEditModal}
        presentationStyle="pageSheet"
      >
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
                  {!showInlineImagePicker ? (
                    <TouchableOpacity
                      style={[
                        styles.changePhotoButton,
                        { backgroundColor: currentTheme.colors.primary },
                      ]}
                      onPress={() => setShowInlineImagePicker(true)}
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
                  ) : (
                    <View style={styles.inlineImagePickerButtons}>
                      <TouchableOpacity
                        style={[
                          styles.inlineImagePickerButton,
                          { backgroundColor: currentTheme.colors.primary },
                        ]}
                        onPress={() => {
                          setShowInlineImagePicker(false);
                          takePhoto();
                        }}
                      >
                        <Text style={styles.inlineImagePickerEmoji}>📷</Text>
                        <Text style={styles.inlineImagePickerButtonText}>
                          Take Photo
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.inlineImagePickerButton,
                          { backgroundColor: currentTheme.colors.secondary },
                        ]}
                        onPress={() => {
                          setShowInlineImagePicker(false);
                          pickImageFromLibrary();
                        }}
                      >
                        <Text style={styles.inlineImagePickerEmoji}>🖼️</Text>
                        <Text style={styles.inlineImagePickerButtonText}>
                          Choose from Library
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
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
                    metricSystem === "metric" ? "Enter height" : "Enter height"
                  }
                  placeholderTextColor={currentTheme.colors.textSecondary}
                  keyboardType="numeric"
                  returnKeyType="done"
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
                  returnKeyType="done"
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
      </Modal>

      {/* Add Horse Modal */}
      <Modal
        animationType="slide"
        visible={addModalVisible}
        onRequestClose={closeAddModal}
        presentationStyle="pageSheet"
      >
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
                    style={styles.selectedImage}
                    source={
                      addImage || require("../../assets/in_app_icons/horse_withBG.png")
                    }
                    resizeMode="cover"
                  />
                  {!showInlineImagePicker ? (
                    <TouchableOpacity
                      style={[
                        styles.changePhotoButton,
                        { backgroundColor: currentTheme.colors.primary },
                      ]}
                      onPress={() => setShowInlineImagePicker(true)}
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
                  ) : (
                    <View style={styles.inlineImagePickerButtons}>
                      <TouchableOpacity
                        style={[
                          styles.inlineImagePickerButton,
                          { backgroundColor: currentTheme.colors.primary },
                        ]}
                        onPress={() => {
                          setShowInlineImagePicker(false);
                          takePhoto();
                        }}
                      >
                        <Text style={styles.inlineImagePickerEmoji}>📷</Text>
                        <Text style={styles.inlineImagePickerButtonText}>
                          Take Photo
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.inlineImagePickerButton,
                          { backgroundColor: currentTheme.colors.secondary },
                        ]}
                        onPress={() => {
                          setShowInlineImagePicker(false);
                          pickImageFromLibrary();
                        }}
                      >
                        <Text style={styles.inlineImagePickerEmoji}>🖼️</Text>
                        <Text style={styles.inlineImagePickerButtonText}>
                          Choose from Library
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
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
                  returnKeyType="done"
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
                  returnKeyType="done"
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
      </Modal>

      {/* Success Modal */}
      <SuccessModal />

      {/* Image Picker Modal */}
      <ImagePickerModal />

      {/* Document Viewer Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={documentViewerVisible}
        onRequestClose={() => setDocumentViewerVisible(false)}
      >
        <View style={styles.documentViewerOverlay}>
          <View style={styles.documentViewerContainer}>
            {/* Header */}
            <View style={styles.documentViewerHeader}>
              <Text style={styles.documentViewerTitle}>
                {selectedDocument?.name || "Document"}
              </Text>
              <TouchableOpacity
                style={styles.documentViewerCloseButton}
                onPress={() => setDocumentViewerVisible(false)}
              >
                <Text style={styles.documentViewerCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Image Display */}
            <ScrollView
              style={styles.documentViewerContent}
              contentContainerStyle={styles.documentViewerContentContainer}
              maximumZoomScale={3}
              minimumZoomScale={1}
            >
              {selectedDocument && (
                <Image
                  source={{ uri: selectedDocument.uri }}
                  style={styles.documentViewerImage}
                  resizeMode="contain"
                />
              )}
            </ScrollView>

            {/* Actions */}
            <View style={styles.documentViewerActions}>
              <TouchableOpacity
                style={[
                  styles.documentViewerButton,
                  { backgroundColor: currentTheme.colors.primary },
                ]}
                onPress={shareDocument}
              >
                <Text style={styles.documentViewerButtonText}>📤 Share</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.documentViewerButton,
                  { backgroundColor: currentTheme.colors.textSecondary },
                ]}
                onPress={() => setDocumentViewerVisible(false)}
              >
                <Text style={styles.documentViewerButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Rename Document Modal - REMOVED, now using inline editing */}

      {/* Records Modal */}
      <Modal
        animationType="slide"
        visible={recordsModalVisible}
        onRequestClose={closeRecordsModal}
        presentationStyle="pageSheet"
      >
        <View
          style={[
            styles.modalContainer,
            { backgroundColor: currentTheme.colors.surface },
          ]}
        >
            {/* Header */}
            <View
              style={[
                styles.modalHeader,
                { backgroundColor: currentTheme.colors.primary },
              ]}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", flex: 1 }}
              >
                {recordsSection !== "main" && (
                  <TouchableOpacity
                    style={styles.backButton}
                    onPress={backToRecordsMain}
                  >
                    <Image
                      style={styles.backIcon}
                      source={require("../../assets/in_app_icons/back.png")}
                    />
                  </TouchableOpacity>
                )}
                <Text
                  style={[
                    styles.modalTitle,
                    {
                      color: "#FFFFFF",
                      flex: 1,
                      textAlign: recordsSection === "main" ? "center" : "left",
                      marginLeft: recordsSection === "main" ? 0 : 10,
                    },
                  ]}
                >
                  {recordsSection === "main" && "📋 RECORDS"}
                  {recordsSection === "vaccination" && "Vaccination Manager"}
                  {recordsSection === "pregnancy" && "Pregnancy Timeline"}
                  {recordsSection === "document" && "Document Manager"}
                  {recordsSection === "rider" && "Rider Manager"}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={closeRecordsModal}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              {selectedHorseForRecords && (
                <>
                  {/* Main Records Menu */}
                  {recordsSection === "main" && (
                    <View>
                      <Text
                        style={[
                          styles.recordsHorseName,
                          { color: currentTheme.colors.text },
                        ]}
                      >
                        Managing records for: {selectedHorseForRecords.name}
                      </Text>

                      <View style={styles.recordsMenuContainer}>
                        <TouchableOpacity
                          style={[
                            styles.recordsMenuItem,
                            { backgroundColor: currentTheme.colors.primary },
                          ]}
                          onPress={openVaccinationManager}
                        >
                          <Text style={styles.recordsMenuIcon}>💉</Text>
                          <View style={styles.recordsMenuContent}>
                            <Text style={styles.recordsMenuTitle}>
                              Vaccination Manager
                            </Text>
                            <Text style={styles.recordsMenuSubtitle}>
                              Set reminders and track vaccination history
                            </Text>
                          </View>
                          <Text style={styles.recordsMenuArrow}>→</Text>
                        </TouchableOpacity>

                        {selectedHorseForRecords?.gender === "Mare" && (
                          <TouchableOpacity
                            style={[
                              styles.recordsMenuItem,
                              { backgroundColor: '#ff69b4' },
                            ]}
                            onPress={openPregnancyManager}
                          >
                            <Text style={styles.recordsMenuIcon}>🤰</Text>
                            <View style={styles.recordsMenuContent}>
                              <Text style={styles.recordsMenuTitle}>
                                Pregnancy Timeline {!isProMember && "(PRO)"}
                              </Text>
                              <Text style={styles.recordsMenuSubtitle}>
                                Track breeding to foaling with milestones & reminders
                              </Text>
                            </View>
                            <Text style={styles.recordsMenuArrow}>→</Text>
                          </TouchableOpacity>
                        )}

                        <TouchableOpacity
                          style={[
                            styles.recordsMenuItem,
                            { backgroundColor: currentTheme.colors.accent },
                          ]}
                          onPress={openDocumentManager}
                        >
                          <Text style={styles.recordsMenuIcon}>📄</Text>
                          <View style={styles.recordsMenuContent}>
                            <Text style={styles.recordsMenuTitle}>
                              Document Manager
                            </Text>
                            <Text style={styles.recordsMenuSubtitle}>
                              Store and organize important documents
                            </Text>
                          </View>
                          <Text style={styles.recordsMenuArrow}>→</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.recordsMenuItem,
                            {
                              backgroundColor:
                                currentTheme.colors.textSecondary,
                              opacity: 0.6,
                            },
                          ]}
                          onPress={openRiderManager}
                          disabled={true}
                        >
                          <Text style={styles.recordsMenuIcon}>👥</Text>
                          <View style={styles.recordsMenuContent}>
                            <Text style={styles.recordsMenuTitle}>
                              Rider Manager
                            </Text>
                            <Text style={styles.recordsMenuSubtitle}>
                              Coming Soon - Share horses with other riders
                            </Text>
                          </View>
                          <Text style={styles.recordsMenuArrow}>→</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {/* Vaccination Manager Section */}
                  {recordsSection === "vaccination" && (
                    <View>
                      <Text
                        style={[
                          styles.vaccinationHorseName,
                          { color: currentTheme.colors.text },
                        ]}
                      >
                        Vaccination Manager for: {selectedHorseForRecords.name}
                      </Text>

                      {/* Vaccination Type Toggle */}
                      <View style={styles.vaccinationTypeToggle}>
                        <TouchableOpacity
                          style={[
                            styles.vaccinationTypeButtonLeft,
                            {
                              backgroundColor:
                                vaccinationType === "future"
                                  ? currentTheme.colors.primary
                                  : currentTheme.colors.surface,
                              borderColor: currentTheme.colors.primary,
                            },
                          ]}
                          onPress={() => setVaccinationType("future")}
                        >
                          <Text
                            style={[
                              styles.vaccinationTypeButtonText,
                              {
                                color:
                                  vaccinationType === "future"
                                    ? "#FFFFFF"
                                    : currentTheme.colors.primary,
                              },
                            ]}
                          >
                            Future Vaccination
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.vaccinationTypeButtonRight,
                            {
                              backgroundColor:
                                vaccinationType === "past"
                                  ? currentTheme.colors.primary
                                  : currentTheme.colors.surface,
                              borderColor: currentTheme.colors.primary,
                            },
                          ]}
                          onPress={() => setVaccinationType("past")}
                        >
                          <Text
                            style={[
                              styles.vaccinationTypeButtonText,
                              {
                                color:
                                  vaccinationType === "past"
                                    ? "#FFFFFF"
                                    : currentTheme.colors.primary,
                              },
                            ]}
                          >
                            Past Vaccination
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {/* Existing Vaccinations */}
                      {horseVaccinations[selectedHorseForRecords.id] &&
                        horseVaccinations[selectedHorseForRecords.id].length >
                          0 && (
                          <View style={styles.existingVaccinations}>
                            <Text
                              style={[
                                styles.existingVaccinationsTitle,
                                { color: currentTheme.colors.text },
                              ]}
                            >
                              Existing Records:
                            </Text>
                            {horseVaccinations[selectedHorseForRecords.id]
                              .sort(
                                (a, b) =>
                                  new Date(b.date).getTime() -
                                  new Date(a.date).getTime()
                              )
                              .map((vaccination) => {
                                const isOverdue =
                                  new Date(vaccination.date) < new Date() &&
                                  vaccination.type === "future";
                                const isPast = vaccination.type === "past";
                                return (
                                  <View
                                    key={vaccination.id}
                                    style={[
                                      styles.vaccinationItem,
                                      {
                                        backgroundColor: isPast
                                          ? currentTheme.colors.surface + "50"
                                          : isOverdue
                                          ? currentTheme.colors.error + "20"
                                          : currentTheme.colors.success + "20",
                                        borderColor: isPast
                                          ? currentTheme.colors.textSecondary
                                          : isOverdue
                                          ? currentTheme.colors.error
                                          : currentTheme.colors.success,
                                      },
                                    ]}
                                  >
                                    <View style={styles.vaccinationItemContent}>
                                      <View
                                        style={styles.vaccinationItemHeader}
                                      >
                                        <Text
                                          style={[
                                            styles.vaccinationItemName,
                                            { color: currentTheme.colors.text },
                                          ]}
                                        >
                                          {vaccination.name}
                                        </Text>
                                        {vaccination.repeat && (
                                          <Text style={styles.repeatIndicator}>
                                            🔄
                                          </Text>
                                        )}
                                      </View>
                                      {vaccination.vaccinationId && (
                                        <Text
                                          style={[
                                            styles.vaccinationItemId,
                                            {
                                              color:
                                                currentTheme.colors
                                                  .textSecondary,
                                            },
                                          ]}
                                        >
                                          ID: {vaccination.vaccinationId}
                                        </Text>
                                      )}
                                      <Text
                                        style={[
                                          styles.vaccinationItemDate,
                                          {
                                            color: isPast
                                              ? currentTheme.colors
                                                  .textSecondary
                                              : isOverdue
                                              ? currentTheme.colors.error
                                              : currentTheme.colors.success,
                                          },
                                        ]}
                                      >
                                        {isPast
                                          ? "📝 Completed: "
                                          : isOverdue
                                          ? "⚠️ Overdue: "
                                          : "📅 Due: "}
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
                                                currentTheme.colors
                                                  .textSecondary,
                                            },
                                          ]}
                                        >
                                          {vaccination.notes}
                                        </Text>
                                      )}
                                    </View>
                                    <View style={styles.vaccinationActions}>
                                      {isOverdue && (
                                        <TouchableOpacity
                                          style={
                                            styles.completeVaccinationButton
                                          }
                                          onPress={() =>
                                            markVaccinationAsCompleted(
                                              selectedHorseForRecords.id,
                                              vaccination.id
                                            )
                                          }
                                        >
                                          <Text
                                            style={
                                              styles.completeVaccinationButtonText
                                            }
                                          >
                                            ✅
                                          </Text>
                                        </TouchableOpacity>
                                      )}
                                      <TouchableOpacity
                                        style={styles.editVaccinationButton}
                                        onPress={() => {
                                          setIsEditMode(true);
                                          setEditingVaccination(vaccination);
                                          setVaccinationName(vaccination.name);
                                          setVaccinationId(
                                            vaccination.vaccinationId || ""
                                          );
                                          setVaccinationDate(
                                            new Date(vaccination.date)
                                          );
                                          setVaccinationType(vaccination.type);
                                          setVaccinationRepeat(
                                            vaccination.repeat
                                          );
                                          setVaccinationRepeatInterval(
                                            vaccination.repeatInterval ||
                                              "yearly"
                                          );
                                          setVaccinationNotes(
                                            vaccination.notes || ""
                                          );
                                          setApplyToFuture(false);
                                        }}
                                      >
                                        <Text
                                          style={
                                            styles.editVaccinationButtonText
                                          }
                                        >
                                          ✏️
                                        </Text>
                                      </TouchableOpacity>
                                      <TouchableOpacity
                                        style={styles.deleteVaccinationButton}
                                        onPress={() =>
                                          deleteVaccinationReminder(
                                            selectedHorseForRecords.id,
                                            vaccination.id
                                          )
                                        }
                                      >
                                        <Text
                                          style={
                                            styles.deleteVaccinationButtonText
                                          }
                                        >
                                          🗑️
                                        </Text>
                                      </TouchableOpacity>
                                    </View>
                                  </View>
                                );
                              })}
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
                          {isEditMode ? "Edit" : "Add New"}{" "}
                          {vaccinationType === "past" ? "Record" : "Reminder"}:
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
                            placeholder="e.g., Annual Shots, Flu, etc."
                            placeholderTextColor={
                              currentTheme.colors.textSecondary
                            }
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
                            Vaccination ID (Optional)
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
                            value={vaccinationId}
                            onChangeText={setVaccinationId}
                            placeholder="Batch number, serial, etc."
                            placeholderTextColor={
                              currentTheme.colors.textSecondary
                            }
                            maxLength={30}
                          />
                        </View>

                        <View style={styles.inputGroup}>
                          <Text
                            style={[
                              styles.inputLabel,
                              { color: currentTheme.colors.text },
                            ]}
                          >
                            {vaccinationType === "past"
                              ? "Completed Date"
                              : "Due Date"}{" "}
                            *
                          </Text>
                          <VaccinationDatePicker
                            value={vaccinationDate}
                            vaccinationType={vaccinationType}
                            onSelect={setVaccinationDate}
                            isVisible={showVaccinationDatePicker}
                            setVisible={setShowVaccinationDatePicker}
                          />
                        </View>

                        {vaccinationType === "future" && (
                          <View style={styles.inputGroup}>
                            <View style={styles.repeatToggleContainer}>
                              <Text
                                style={[
                                  styles.inputLabel,
                                  { color: currentTheme.colors.text },
                                ]}
                              >
                                Set Recurring Reminder
                              </Text>
                              <TouchableOpacity
                                style={[
                                  styles.repeatToggle,
                                  {
                                    backgroundColor: vaccinationRepeat
                                      ? currentTheme.colors.primary
                                      : currentTheme.colors.textSecondary,
                                  },
                                ]}
                                onPress={() =>
                                  setVaccinationRepeat(!vaccinationRepeat)
                                }
                              >
                                <View
                                  style={[
                                    styles.repeatToggleSlider,
                                    {
                                      transform: [
                                        {
                                          translateX: vaccinationRepeat
                                            ? 18
                                            : 2,
                                        },
                                      ],
                                    },
                                  ]}
                                />
                              </TouchableOpacity>
                            </View>

                            {vaccinationRepeat && (
                              <View style={styles.repeatIntervalContainer}>
                                <Text
                                  style={[
                                    styles.inputLabel,
                                    {
                                      color: currentTheme.colors.text,
                                      fontSize: 14,
                                    },
                                  ]}
                                >
                                  Repeat Every:
                                </Text>
                                <View style={styles.repeatIntervalButtons}>
                                  {["monthly", "quarterly", "yearly"].map(
                                    (interval) => (
                                      <TouchableOpacity
                                        key={interval}
                                        style={[
                                          styles.repeatIntervalButton,
                                          {
                                            backgroundColor:
                                              vaccinationRepeatInterval ===
                                              interval
                                                ? currentTheme.colors.primary
                                                : currentTheme.colors.surface,
                                            borderColor:
                                              currentTheme.colors.primary,
                                          },
                                        ]}
                                        onPress={() =>
                                          setVaccinationRepeatInterval(
                                            interval as any
                                          )
                                        }
                                      >
                                        <Text
                                          style={[
                                            styles.repeatIntervalButtonText,
                                            {
                                              color:
                                                vaccinationRepeatInterval ===
                                                interval
                                                  ? "#FFFFFF"
                                                  : currentTheme.colors.primary,
                                            },
                                          ]}
                                        >
                                          {interval.charAt(0).toUpperCase() +
                                            interval.slice(1)}
                                        </Text>
                                      </TouchableOpacity>
                                    )
                                  )}
                                </View>
                              </View>
                            )}
                          </View>
                        )}

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
                            placeholderTextColor={
                              currentTheme.colors.textSecondary
                            }
                            multiline={true}
                            numberOfLines={3}
                            maxLength={200}
                          />
                        </View>

                        {/* Apply to Future Occurrences Checkbox */}
                        {isEditMode &&
                          editingVaccination &&
                          editingVaccination.repeat && (
                            <View style={styles.inputGroup}>
                              <TouchableOpacity
                                style={styles.applyToFutureContainer}
                                onPress={() => setApplyToFuture(!applyToFuture)}
                              >
                                <View
                                  style={[
                                    styles.checkbox,
                                    {
                                      borderColor: currentTheme.colors.primary,
                                      backgroundColor: applyToFuture
                                        ? currentTheme.colors.primary
                                        : "transparent",
                                    },
                                  ]}
                                >
                                  {applyToFuture && (
                                    <Text style={styles.checkboxCheck}>✓</Text>
                                  )}
                                </View>
                                <Text
                                  style={[
                                    styles.applyToFutureText,
                                    { color: currentTheme.colors.text },
                                  ]}
                                >
                                  Apply changes to all future occurrences
                                </Text>
                              </TouchableOpacity>
                            </View>
                          )}
                      </View>
                    </View>
                  )}

                  {/* Pregnancy Manager Section */}
                  {recordsSection === "pregnancy" && selectedHorseForRecords?.gender === "Mare" && (
                    <View>
                      <View style={styles.pregnancyHeader}>
                        {!selectedPregnancy ? (
                          // No active pregnancy - Show inline form or start button
                          !pregnancyModalVisible ? (
                            <View style={styles.noPregnancyContainer}>
                              <Text style={styles.noPregnancyIcon}>🐴</Text>
                              <Text style={[styles.noPregnancyTitle, { color: currentTheme.colors.text }]}>
                                No Active Pregnancy
                              </Text>
                              <Text style={[styles.noPregnancySubtitle, { color: currentTheme.colors.textSecondary }]}>
                                Start tracking a pregnancy for {selectedHorseForRecords.name}
                              </Text>
                              <TouchableOpacity
                                style={[
                                  styles.startPregnancyButton,
                                  { backgroundColor: currentTheme.colors.primary },
                                ]}
                                onPress={() => {
                                  // Show inline pregnancy form
                                  setPregnancyModalVisible(true);
                                }}
                              >
                                <Text style={styles.startPregnancyButtonText}>Start Pregnancy</Text>
                              </TouchableOpacity>
                            </View>
                          ) : (
                            // Inline Start Pregnancy Form
                            <View style={styles.pregnancyFormContainer}>
                              <Text style={[styles.pregnancyFormTitle, { color: currentTheme.colors.text }]}>
                                Start New Pregnancy
                              </Text>
                              <Text style={[styles.startPregnancySubtitle, { color: currentTheme.colors.textSecondary }]}>
                                Enter the cover date and optional details to start tracking
                              </Text>

                              {/* Cover Date - Required */}
                              <View style={styles.inputGroup}>
                                <Text style={[styles.inputLabel, { color: currentTheme.colors.text }]}>
                                  Cover Date *
                                </Text>
                                <DatePicker
                                  value={pregnancyCoverDate}
                                  placeholder="Select cover date"
                                  onSelect={setPregnancyCoverDate}
                                  isVisible={showPregnancyCoverDatePicker}
                                  setVisible={setShowPregnancyCoverDatePicker}
                                />
                              </View>

                              {/* Breeding Method - Optional */}
                              <View style={styles.inputGroup}>
                                <Text style={[styles.inputLabel, { color: currentTheme.colors.text }]}>
                                  Breeding Method
                                </Text>
                                <View style={styles.methodToggle}>
                                  <TouchableOpacity
                                    style={[
                                      styles.methodButtonLeft,
                                      pregnancyMethod === "natural" && styles.methodButtonActive,
                                      pregnancyMethod === "natural" ? {backgroundColor: currentTheme.colors.secondary} : { backgroundColor: currentTheme.colors.surface },
                                      { borderColor: currentTheme.colors.primary}
                                    ]}
                                    onPress={() => setPregnancyMethod("natural")}
                                  >
                                    <Text style={[
                                      styles.methodButtonText,
                                      pregnancyMethod === "natural" && styles.methodButtonTextActive
                                    ]}>
                                      Natural
                                    </Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    style={[
                                      styles.methodButton,
                                      pregnancyMethod === "AI" && styles.methodButtonActive,
                                      pregnancyMethod === "AI" ? {backgroundColor: currentTheme.colors.secondary} : { backgroundColor: currentTheme.colors.surface },
                                      { borderColor: currentTheme.colors.primary}
                                    ]}
                                    onPress={() => setPregnancyMethod("AI")}
                                  >
                                    <Text style={[
                                      styles.methodButtonText,
                                      pregnancyMethod === "AI" && styles.methodButtonTextActive
                                    ]}>
                                      AI
                                    </Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    style={[
                                      styles.methodButtonRight,
                                      pregnancyMethod === "ICSI" && styles.methodButtonActive,
                                      pregnancyMethod === "ICSI" ? {backgroundColor: currentTheme.colors.secondary} : { backgroundColor: currentTheme.colors.surface },
                                      { borderColor: currentTheme.colors.primary }
                                    ]}
                                    onPress={() => setPregnancyMethod("ICSI")}
                                  >
                                    <Text style={[
                                      styles.methodButtonText,
                                      pregnancyMethod === "ICSI" && styles.methodButtonTextActive
                                    ]}>
                                      ICSI
                                    </Text>
                                  </TouchableOpacity>
                                </View>
                              </View>

                              {/* Veterinarian Info - Optional */}
                              <View style={styles.inputGroup}>
                                <Text style={[styles.inputLabel, { color: currentTheme.colors.text }]}>
                                  Veterinarian Name (Optional)
                                </Text>
                                <TextInput
                                  style={[
                                    styles.input,
                                    {
                                      backgroundColor: currentTheme.colors.surface,
                                      color: currentTheme.colors.primaryDark,
                                      borderColor: currentTheme.colors.primaryDark,
                                    },
                                  ]}
                                  value={pregnancyVetName}
                                  onChangeText={setPregnancyVetName}
                                  placeholder="Enter vet name"
                                  placeholderTextColor={currentTheme.colors.textSecondary}
                                />
                              </View>

                              <View style={styles.inputGroup}>
                                <Text style={[styles.inputLabel, { color: currentTheme.colors.text }]}>
                                  Veterinarian Phone (Optional)
                                </Text>
                                <TextInput
                                  style={[
                                    styles.input,
                                    {
                                      backgroundColor: currentTheme.colors.surface,
                                      color: currentTheme.colors.primaryDark,
                                      borderColor: currentTheme.colors.primaryDark,
                                    },
                                  ]}
                                  value={pregnancyVetPhone}
                                  onChangeText={setPregnancyVetPhone}
                                  placeholder="Enter vet phone"
                                  placeholderTextColor={currentTheme.colors.textSecondary}
                                  keyboardType="phone-pad"
                                />
                              </View>

                              {/* Info Banner */}
                              <View style={[styles.pregnancyInfoBanner, { backgroundColor: currentTheme.colors.accent }]}>
                                <Text style={styles.pregnancyInfoIcon}>ℹ️</Text>
                                <Text style={[styles.pregnancyInfoText, { color: currentTheme.colors.text }]}>
                                  A 340-day timeline will be automatically created with ultrasound checks, vaccine reminders, and deworming schedule.
                                </Text>
                              </View>

                              {/* Form Actions */}
                              <View style={styles.pregnancyFormActions}>
                                <TouchableOpacity
                                  style={[
                                    styles.pregnancyFormButton,
                                    styles.pregnancyCancelButton,
                                    { backgroundColor: currentTheme.colors.textSecondary },
                                  ]}
                                  onPress={() => {
                                    setPregnancyModalVisible(false);
                                    // Reset form
                                    setPregnancyCoverDate(null);
                                    setPregnancyMethod("natural");
                                    setPregnancyVetName("");
                                    setPregnancyVetPhone("");
                                  }}
                                >
                                  <Text style={styles.pregnancyFormButtonText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[
                                    styles.pregnancyFormButton,
                                    styles.pregnancySaveButton,
                                    { 
                                      backgroundColor: currentTheme.colors.primary,
                                      opacity: pregnancyCoverDate ? 1 : 0.5
                                    },
                                  ]}
                                  onPress={handleStartPregnancy}
                                  disabled={!pregnancyCoverDate}
                                >
                                  <Text style={styles.pregnancyFormButtonText}>Start Pregnancy</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          )
                        ) : (
                          // Active pregnancy exists
                          <View>
                            {/* Title and Disclaimer for Active Pregnancy */}
                            <Text
                              style={[
                                styles.pregnancyHorseName,
                                { color: currentTheme.colors.text },
                              ]}
                            >
                              Pregnancy Timeline for: {selectedHorseForRecords.name}
                            </Text>
                            
                            <View style={styles.disclaimerBanner}>
                              <Text style={styles.disclaimerIcon}>⚠️</Text>
                              <Text style={styles.disclaimerText}>
                                Educational only — contact your veterinarian for diagnosis or emergencies
                              </Text>
                            </View>
                            
                            <>
                              {/* Status Badge and Day Counter */}
                              <View style={styles.pregnancyStatusContainer}>
                                <View style={[styles.statusBadge, { backgroundColor: currentTheme.colors.accent }]}>
                                  <Text style={[styles.statusBadgeText, { color: currentTheme.colors.text }]}>
                                    {selectedPregnancy.status === "active" ? "🤰 Active" : 
                                     selectedPregnancy.status === "foaled" ? "🐴 Foaled" : "❌ Lost"}
                                  </Text>
                                </View>
                                
                                {selectedPregnancy.status === "active" && (
                                  <View style={styles.dayCounter}>
                                    <Text style={[styles.dayCounterNumber, { color: currentTheme.colors.text }]}>
                                      Day {getDaysPregnant(selectedPregnancy)}
                                    </Text>
                                    <Text style={styles.dayCounterLabel}>of ~340</Text>
                                  </View>
                                )}
                              </View>

                            {/* Progress Bar */}
                            {selectedPregnancy.status === "active" && (
                              <View style={styles.modalProgressContainer}>
                                <View style={[styles.progressBarContainer, { backgroundColor: currentTheme.colors.secondary }]}>
                                  <View 
                                    style={[
                                      styles.progressBarFill,
                                      { 
                                        width: `${Math.min((getDaysPregnant(selectedPregnancy) / 340) * 100, 100)}%`,
                                        backgroundColor: currentTheme.colors.primary
                                      }
                                    ]}
                                  />
                                  {/* Stage Dividers */}
                                  <View style={[styles.modalStageDivider, { left: '33.33%', backgroundColor: currentTheme.colors.surface }]} />
                                  <View style={[styles.modalStageDivider, { left: '66.66%', backgroundColor: currentTheme.colors.surface }]} />
                                </View>
                                
                                {/* Stage Labels */}
                                <View style={styles.modalStageLabels}>
                                  <Text style={[styles.modalStageLabel, { color: currentTheme.colors.textSecondary }]}>
                                    Early (0-113d)
                                  </Text>
                                  <Text style={[styles.modalStageLabel, { color: currentTheme.colors.textSecondary }]}>
                                    Mid (114-226d)
                                  </Text>
                                  <Text style={[styles.modalStageLabel, { color: currentTheme.colors.textSecondary }]}>
                                    Late (227-340d)
                                  </Text>
                                </View>
                              </View>
                            )}

                            {/* Next Action Card */}
                            {selectedPregnancy.status === "active" && getNextAction(selectedPregnancy) && (() => {
                              const nextAction = getNextAction(selectedPregnancy)!;
                              const isFutureAction = nextAction.daysUntil > 0;
                              return (
                                <View style={[styles.nextActionCard, { backgroundColor: currentTheme.colors.accent }]}>
                                  <View style={styles.nextActionContent}>
                                    <View style={styles.nextActionTextContainer}>
                                      <Text style={[styles.nextActionTitle, { color: currentTheme.colors.textSecondary }]}>Next Action</Text>
                                      <Text style={[styles.nextActionText, { color: currentTheme.colors.text }]}>
                                        {nextAction.text}
                                      </Text>
                                      <Text style={[styles.nextActionDays, { color: currentTheme.colors.textSecondary }]}>
                                        {nextAction.daysUntil > 0 
                                          ? `in ${nextAction.daysUntil} days`
                                          : nextAction.daysUntil === 0
                                          ? "Today!"
                                          : `${Math.abs(nextAction.daysUntil)} days overdue`
                                        }
                                      </Text>
                                    </View>
                                    <TouchableOpacity
                                      style={[
                                        styles.nextActionCheckButton,
                                        { 
                                          backgroundColor: isFutureAction ? currentTheme.colors.border : currentTheme.colors.primary,
                                          opacity: isFutureAction ? 0.5 : 1
                                        }
                                      ]}
                                      onPress={handleCompleteNextAction}
                                      disabled={isFutureAction}
                                    >
                                      <Text style={styles.nextActionCheckIcon}>✓</Text>
                                    </TouchableOpacity>
                                  </View>
                                </View>
                              );
                            })()}

                            {/* View Toggle */}
                            <View style={styles.viewToggle}>
                              <TouchableOpacity
                                style={[
                                  styles.viewToggleButtonLeft,
                                  pregnancyView === "timeline" && styles.viewToggleButtonActive,
                                  { 
                                    borderColor: currentTheme.colors.primary,
                                    backgroundColor: pregnancyView === "timeline" ? currentTheme.colors.primary : currentTheme.colors.surface
                                  }
                                ]}
                                onPress={() => {
                                  setPregnancyView("timeline");
                                  setShowInlinePregnancyPhotoPicker(false);
                                }}
                              >
                                <Text style={[
                                  styles.viewToggleText,
                                  pregnancyView === "timeline" && styles.viewToggleTextActive,
                                  { color: pregnancyView === "timeline" ? '#FFFFFF' : currentTheme.colors.text }
                                ]}>
                                  Timeline
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[
                                  styles.viewToggleButton,
                                  pregnancyView === "fruit" && styles.viewToggleButtonActive,
                                  { 
                                    borderColor: currentTheme.colors.primary,
                                    backgroundColor: pregnancyView === "fruit" ? currentTheme.colors.primary : currentTheme.colors.surface
                                  }
                                ]}
                                onPress={() => {
                                  setPregnancyView("fruit");
                                  setShowInlinePregnancyPhotoPicker(false);
                                }}
                              >
                                <Text style={[
                                  styles.viewToggleText,
                                  pregnancyView === "fruit" && styles.viewToggleTextActive,
                                  { color: pregnancyView === "fruit" ? '#FFFFFF' : currentTheme.colors.text }
                                ]}>
                                  Month View
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[
                                  styles.viewToggleButtonRight,
                                  pregnancyView === "photos" && styles.viewToggleButtonActive,
                                  { 
                                    borderColor: currentTheme.colors.primary,
                                    backgroundColor: pregnancyView === "photos" ? currentTheme.colors.primary : currentTheme.colors.surface
                                  }
                                ]}
                                onPress={() => {
                                  setPregnancyView("photos");
                                  setShowInlinePregnancyPhotoPicker(false);
                                }}
                              >
                                <Text style={[
                                  styles.viewToggleText,
                                  pregnancyView === "photos" && styles.viewToggleTextActive,
                                  { color: pregnancyView === "photos" ? '#FFFFFF' : currentTheme.colors.text }
                                ]}>
                                  Photos
                                </Text>
                              </TouchableOpacity>
                            </View>

                            {/* Timeline View */}
                            {pregnancyView === "timeline" && (
                              <View style={styles.timelineContainer}>
                                <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>
                                  Event Timeline
                                </Text>
                                
                                {/* Add Event Button */}
                                {!showInlineAddEvent ? (
                                  <TouchableOpacity
                                    style={[
                                      styles.addEventButton,
                                      { backgroundColor: currentTheme.colors.primary }
                                    ]}
                                    onPress={() => setShowInlineAddEvent(true)}
                                  >
                                    <Text style={styles.addEventButtonText}>+ Add Event</Text>
                                  </TouchableOpacity>
                                ) : (
                                  <View style={[styles.inlineEventForm, { backgroundColor: currentTheme.colors.surface }]}>
                                    {/* Pregnancy Status Change Section */}
                                    <View style={styles.inputGroup}>
                                      <Text style={[styles.inputLabel, { color: currentTheme.colors.text }]}>
                                        Change Pregnancy Status
                                      </Text>
                                      <View style={styles.statusOptionsContainer}>
                                        <TouchableOpacity
                                          style={[
                                            styles.statusOption,
                                            {
                                              backgroundColor: selectedPregnancy.status === 'active' 
                                                ? currentTheme.colors.primary 
                                                : currentTheme.colors.surface,
                                              borderColor: currentTheme.colors.border,
                                            }
                                          ]}
                                          onPress={() => {
                                            if (selectedPregnancy) {
                                              const updated = {
                                                ...selectedPregnancy,
                                                status: 'active' as PregnancyStatus
                                              };
                                              setSelectedPregnancy(updated);
                                              const newPregnancies = { ...pregnancies, [selectedPregnancy.horseId]: updated };
                                              setPregnancies(newPregnancies);
                                              savePregnancies(newPregnancies);
                                              
                                              // Update notifications (reactivate all notifications)
                                              const horseName = horses.find(h => h.id === updated.horseId)?.name;
                                              PregnancyNotificationService.updatePregnancyNotifications({
                                                ...updated,
                                                horseName
                                              }).catch(error => {
                                                console.error('Failed to update pregnancy notifications:', error);
                                              });
                                            }
                                          }}
                                        >
                                          <Text style={[
                                            styles.statusOptionText,
                                            { 
                                              color: selectedPregnancy.status === 'active' 
                                                ? '#FFFFFF' 
                                                : currentTheme.colors.text 
                                            }
                                          ]}>
                                            🤰 Active
                                          </Text>
                                        </TouchableOpacity>
                                        
                                        <TouchableOpacity
                                          style={[
                                            styles.statusOption,
                                            {
                                              backgroundColor: selectedPregnancy.status === 'foaled' 
                                                ? currentTheme.colors.primary 
                                                : currentTheme.colors.surface,
                                              borderColor: currentTheme.colors.border,
                                              opacity: getDaysPregnant(selectedPregnancy) >= 320 && getDaysPregnant(selectedPregnancy) <= 360 ? 1 : 0.5
                                            }
                                          ]}
                                          disabled={getDaysPregnant(selectedPregnancy) < 320 || getDaysPregnant(selectedPregnancy) > 360}
                                          onPress={() => {
                                            if (selectedPregnancy) {
                                              const updated = {
                                                ...selectedPregnancy,
                                                status: 'foaled' as PregnancyStatus
                                              };
                                              setSelectedPregnancy(updated);
                                              const newPregnancies = { ...pregnancies, [selectedPregnancy.horseId]: updated };
                                              setPregnancies(newPregnancies);
                                              savePregnancies(newPregnancies);
                                              
                                              // Cancel notifications (pregnancy completed)
                                              PregnancyNotificationService.cancelPregnancyNotifications(updated.id).catch(error => {
                                                console.error('Failed to cancel pregnancy notifications:', error);
                                              });
                                            }
                                          }}
                                        >
                                          <Text style={[
                                            styles.statusOptionText,
                                            { 
                                              color: selectedPregnancy.status === 'foaled' 
                                                ? '#FFFFFF' 
                                                : currentTheme.colors.text 
                                            }
                                          ]}>
                                            🐴 Foaled
                                          </Text>
                                        </TouchableOpacity>
                                        
                                        <TouchableOpacity
                                          style={[
                                            styles.statusOption,
                                            {
                                              backgroundColor: selectedPregnancy.status === 'lost' 
                                                ? currentTheme.colors.primary 
                                                : currentTheme.colors.surface,
                                              borderColor: currentTheme.colors.border,
                                            }
                                          ]}
                                          onPress={() => {
                                            if (selectedPregnancy) {
                                              const updated = {
                                                ...selectedPregnancy,
                                                status: 'lost' as PregnancyStatus
                                              };
                                              setSelectedPregnancy(updated);
                                              const newPregnancies = { ...pregnancies, [selectedPregnancy.horseId]: updated };
                                              setPregnancies(newPregnancies);
                                              savePregnancies(newPregnancies);
                                              
                                              // Cancel notifications (pregnancy ended)
                                              PregnancyNotificationService.cancelPregnancyNotifications(updated.id).catch(error => {
                                                console.error('Failed to cancel pregnancy notifications:', error);
                                              });
                                            }
                                          }}
                                        >
                                          <Text style={[
                                            styles.statusOptionText,
                                            { 
                                              color: selectedPregnancy.status === 'lost' 
                                                ? '#FFFFFF' 
                                                : currentTheme.colors.text 
                                            }
                                          ]}>
                                            ❌ Lost
                                          </Text>
                                        </TouchableOpacity>
                                      </View>
                                      {getDaysPregnant(selectedPregnancy) < 320 && (
                                        <Text style={[styles.statusHelpText, { color: currentTheme.colors.textSecondary }]}>
                                          ℹ️ Foaled option available from day 320-360
                                        </Text>
                                      )}
                                      {getDaysPregnant(selectedPregnancy) > 360 && (
                                        <Text style={[styles.statusHelpText, { color: currentTheme.colors.textSecondary }]}>
                                          ℹ️ Foaled option available until day 360
                                        </Text>
                                      )}
                                    </View>
                                    
                                    {/* Divider */}
                                    <View style={[styles.divider, { backgroundColor: currentTheme.colors.border }]} />
                                    
                                    {/* Event Type Selection */}
                                    <View style={styles.inputGroup}>
                                      <Text style={[styles.inputLabel, { color: currentTheme.colors.text }]}>
                                        Event Type
                                      </Text>
                                      <View style={styles.eventTypeGrid}>
                                        <TouchableOpacity
                                          style={[
                                            styles.eventTypeButton,
                                            eventType === "ultrasound" && {backgroundColor: currentTheme.colors.accent},
                                            { borderColor: currentTheme.colors.primary }
                                          ]}
                                          onPress={() => setEventType("ultrasound")}
                                        >
                                          <Text style={styles.eventTypeIcon}>🔍</Text>
                                          <Text style={[
                                            styles.eventTypeText,
                                            eventType === "ultrasound" && styles.eventTypeTextActive
                                          ]}>
                                            Ultrasound
                                          </Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                          style={[
                                            styles.eventTypeButton,
                                            eventType === "vaccine" && {backgroundColor: currentTheme.colors.accent},
                                            { borderColor: currentTheme.colors.primary }
                                          ]}
                                          onPress={() => setEventType("vaccine")}
                                        >
                                          <Text style={styles.eventTypeIcon}>💉</Text>
                                          <Text style={[
                                            styles.eventTypeText,
                                            eventType === "vaccine" && styles.eventTypeTextActive
                                          ]}>
                                            Vaccine
                                          </Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                          style={[
                                            styles.eventTypeButton,
                                            eventType === "deworming" && {backgroundColor: currentTheme.colors.accent},
                                            { borderColor: currentTheme.colors.primary }
                                          ]}
                                          onPress={() => setEventType("deworming")}
                                        >
                                          <Text style={styles.eventTypeIcon}>💊</Text>
                                          <Text style={[
                                            styles.eventTypeText,
                                            eventType === "deworming" && styles.eventTypeTextActive
                                          ]}>
                                            Deworming
                                          </Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                          style={[
                                            styles.eventTypeButton,
                                            eventType === "note" && {backgroundColor: currentTheme.colors.accent},
                                            { borderColor: currentTheme.colors.primary }
                                          ]}
                                          onPress={() => setEventType("note")}
                                        >
                                          <Text style={styles.eventTypeIcon}>📝</Text>
                                          <Text style={[
                                            styles.eventTypeText,
                                            eventType === "note" && styles.eventTypeTextActive
                                          ]}>
                                            Note
                                          </Text>
                                        </TouchableOpacity>
                                      </View>
                                    </View>

                                    {/* Event Date */}
                                    <View style={styles.inputGroup}>
                                      <Text style={[styles.inputLabel, { color: currentTheme.colors.text }]}>
                                        Event Date *
                                      </Text>
                                      <DatePicker
                                        value={eventDate}
                                        placeholder="Select event date"
                                        onSelect={setEventDate}
                                        isVisible={showEventDatePicker}
                                        setVisible={setShowEventDatePicker}
                                      />
                                    </View>

                                    {/* Notes */}
                                    <View style={styles.inputGroup}>
                                      <Text style={[styles.inputLabel, { color: currentTheme.colors.text }]}>
                                        Notes (Optional)
                                      </Text>
                                      <TextInput
                                        style={[
                                          styles.textInput,
                                          {
                                            backgroundColor: currentTheme.colors.accent,
                                            color: currentTheme.colors.text,
                                            borderColor: currentTheme.colors.primary,
                                            minHeight: 100,
                                            textAlignVertical: "top",
                                          },
                                        ]}
                                        value={eventNotes}
                                        onChangeText={setEventNotes}
                                        placeholder="Enter any notes or observations..."
                                        placeholderTextColor={currentTheme.colors.textSecondary}
                                        multiline
                                      />
                                    </View>

                                    {/* Action Buttons */}
                                    <View style={styles.inlineEventActions}>
                                      <TouchableOpacity
                                        style={[
                                          styles.inlineEventCancelButton,
                                          { backgroundColor: currentTheme.colors.textSecondary },
                                        ]}
                                        onPress={() => {
                                          setShowInlineAddEvent(false);
                                          setEventDate(null);
                                          setEventNotes("");
                                          setEventType("ultrasound");
                                        }}
                                      >
                                        <Text style={styles.inlineEventCancelButtonText}>
                                          Cancel
                                        </Text>
                                      </TouchableOpacity>
                                      <TouchableOpacity
                                        style={[
                                          styles.inlineEventSaveButton,
                                          { 
                                            backgroundColor: currentTheme.colors.primary,
                                            opacity: eventDate ? 1 : 0.5
                                          },
                                        ]}
                                        onPress={handleAddEvent}
                                        disabled={!eventDate}
                                      >
                                        <Text style={styles.inlineEventSaveButtonText}>
                                          Add Event
                                        </Text>
                                      </TouchableOpacity>
                                    </View>
                                  </View>
                                )}

                                {/* Events List (reverse chronological) */}
                                <View style={styles.eventsList}>
                                  {(() => {
                                    // Gather all completed events
                                    const completedEvents: Array<{
                                      type: 'ultrasound' | 'vaccine' | 'deworming';
                                      date: string;
                                      text: string;
                                      notes?: string;
                                      icon: string;
                                    }> = [];

                                    // Add completed ultrasounds
                                    selectedPregnancy.checks
                                      .filter(c => c.done && c.date)
                                      .forEach(c => {
                                        completedEvents.push({
                                          type: 'ultrasound',
                                          date: c.date!,
                                          text: `Ultrasound: ${c.type}`,
                                          notes: c.notes,
                                          icon: '🔍'
                                        });
                                      });

                                    // Add completed vaccines
                                    selectedPregnancy.vaccines
                                      .filter(v => v.done)
                                      .forEach(v => {
                                        completedEvents.push({
                                          type: 'vaccine',
                                          date: v.date || v.due, // Use actual completion date if available, fallback to due date
                                          text: `Vaccine: ${v.type}`,
                                          notes: v.notes,
                                          icon: '💉'
                                        });
                                      });

                                    // Add completed deworming
                                    selectedPregnancy.deworming
                                      .filter(d => d.done)
                                      .forEach(d => {
                                        completedEvents.push({
                                          type: 'deworming',
                                          date: d.date || d.due, // Use actual completion date if available, fallback to due date
                                          text: 'Deworm (pre-foaling)',
                                          notes: d.notes,
                                          icon: '💊'
                                        });
                                      });

                                    // Sort by date (most recent first)
                                    completedEvents.sort((a, b) => 
                                      new Date(b.date).getTime() - new Date(a.date).getTime()
                                    );

                                    if (completedEvents.length === 0) {
                                      return (
                                        <Text style={[styles.placeholderText, { color: currentTheme.colors.textSecondary }]}>
                                          Events will appear here as they are added
                                        </Text>
                                      );
                                    }

                                    return completedEvents.map((event, index) => (
                                      <View
                                        key={`event-${event.type}-${event.date}-${index}`}
                                        style={[
                                          styles.eventCard,
                                          { backgroundColor: currentTheme.colors.surface }
                                        ]}
                                      >
                                        <View style={styles.eventCardHeader}>
                                          <Text style={styles.eventIcon}>{event.icon}</Text>
                                          <View style={styles.eventCardInfo}>
                                            <Text style={[styles.eventCardTitle, { color: currentTheme.colors.text }]}>
                                              {event.text}
                                            </Text>
                                            <Text style={[styles.eventCardDate, { color: currentTheme.colors.textSecondary }]}>
                                              {new Date(event.date).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric'
                                              })}
                                            </Text>
                                          </View>
                                        </View>
                                        {event.notes && (
                                          <Text style={[styles.eventCardNotes, { color: currentTheme.colors.textSecondary }]}>
                                            {event.notes}
                                          </Text>
                                        )}
                                      </View>
                                    ));
                                  })()}
                                </View>
                              </View>
                            )}

                            {/* Month/Fruit View */}
                            {pregnancyView === "fruit" && (
                              <View style={styles.fruitViewContainer}>
                                {selectedPregnancy.status === "active" && (
                                  <>
                                    {(() => {
                                      const days = getDaysPregnant(selectedPregnancy);
                                      const month = getPregnancyMonth(days);
                                      const info = getMonthInfo(month);
                                      return (
                                        <>
                                          <View style={styles.fruitDisplay}>
                                            <Text style={styles.fruitEmoji}>{info.fruit}</Text>
                                            <Text style={[styles.fruitSize, { color: currentTheme.colors.text }]}>
                                              {info.size}
                                            </Text>
                                            <Text style={[styles.fruitMonth, { color: currentTheme.colors.textSecondary }]}>
                                              Month {month} of 11
                                            </Text>
                                          </View>
                                          
                                          <View style={[styles.infoCard, { backgroundColor: currentTheme.colors.accent }]}>
                                            <Text style={styles.infoCardTitle}>What's happening:</Text>
                                            <Text style={styles.infoCardText}>{info.description}</Text>
                                          </View>
                                        </>
                                      );
                                    })()}
                                  </>
                                )}
                              </View>
                            )}

                            {/* Photos View */}
                            {pregnancyView === "photos" && (
                              <View style={styles.photosContainer}>
                                <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>
                                  Progress Photos
                                </Text>
                                
                                {!showInlinePregnancyPhotoPicker ? (
                                  <TouchableOpacity
                                    style={[
                                      styles.capturePhotoButton,
                                      { backgroundColor: currentTheme.colors.primary }
                                    ]}
                                    onPress={() => setShowInlinePregnancyPhotoPicker(true)}
                                  >
                                    <Text style={styles.capturePhotoButtonText}>📷 Capture Photo</Text>
                                  </TouchableOpacity>
                                ) : (
                                  <View style={styles.inlineImagePickerButtons}>
                                    <TouchableOpacity
                                      style={[
                                        styles.inlineImagePickerButton,
                                        { backgroundColor: currentTheme.colors.primary },
                                      ]}
                                      onPress={() => {
                                        setShowInlinePregnancyPhotoPicker(false);
                                        handleCapturePhoto();
                                      }}
                                    >
                                      <Text style={styles.inlineImagePickerEmoji}>📷</Text>
                                      <Text style={styles.inlineImagePickerButtonText}>
                                        Take Photo
                                      </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                      style={[
                                        styles.inlineImagePickerButton,
                                        { backgroundColor: currentTheme.colors.secondary },
                                      ]}
                                      onPress={() => {
                                        setShowInlinePregnancyPhotoPicker(false);
                                        handlePickPhotoFromLibrary();
                                      }}
                                    >
                                      <Text style={styles.inlineImagePickerEmoji}>🖼️</Text>
                                      <Text style={styles.inlineImagePickerButtonText}>
                                        Choose from Library
                                      </Text>
                                    </TouchableOpacity>
                                  </View>
                                )}

                                {selectedPregnancy.photos && selectedPregnancy.photos.length > 0 ? (
                                  <View style={styles.photoGrid}>
                                    {selectedPregnancy.photos.map((photo, index) => (
                                      <View key={index} style={styles.photoItem}>
                                        <Image 
                                          source={{ uri: photo.url }}
                                          style={styles.photoImage}
                                          resizeMode="cover"
                                        />
                                        <View style={styles.photoOverlay}>
                                          <Text style={styles.photoDay}>Day {photo.dayPregnant}</Text>
                                        </View>
                                      </View>
                                    ))}
                                  </View>
                                ) : (
                                  <Text style={[styles.placeholderText, { color: currentTheme.colors.textSecondary }]}>
                                    No photos yet. Capture progress photos to track your mare's development.
                                  </Text>
                                )}
                              </View>
                            )}
                            </>
                          </View>
                        )}
                      </View>
                    </View>
                  )}

                  {/* Document Manager Section */}
                  {recordsSection === "document" && (
                    <View>
                      <Text
                        style={[
                          styles.documentHorseName,
                          { color: currentTheme.colors.text },
                        ]}
                      >
                        Document Manager for: {selectedHorseForRecords.name}
                      </Text>

                      {/* Pro Sync Toggle */}
                      <View style={styles.documentSyncContainer}>
                        <View style={styles.documentSyncHeader}>
                          <View style={styles.documentSyncInfo}>
                            <Text
                              style={[
                                styles.documentSyncTitle,
                                { color: currentTheme.colors.text },
                              ]}
                            >
                              Cloud Sync {!isProMember && "(PRO Only)"}
                            </Text>
                            <Text
                              style={[
                                styles.documentSyncSubtitle,
                                { color: currentTheme.colors.textSecondary },
                              ]}
                            >
                              {isProMember
                                ? "Sync documents to cloud for backup and sharing"
                                : "Upgrade to PRO to sync documents to cloud"}
                            </Text>
                            {!isProMember && (
                              <Text
                                style={[
                                  styles.documentSyncSubtitle,
                                  {
                                    color: currentTheme.colors.primary,
                                    fontSize: 12,
                                    fontWeight: "600",
                                    marginTop: 4,
                                  },
                                ]}
                              >
                                Tap to upgrade →
                              </Text>
                            )}
                          </View>
                          <TouchableOpacity
                            style={[
                              styles.documentSyncToggle,
                              {
                                backgroundColor:
                                  documentSyncEnabled && isProMember
                                    ? currentTheme.colors.primary
                                    : currentTheme.colors.textSecondary,
                                opacity: isProMember ? 1 : 0.3,
                                borderWidth: !isProMember ? 2 : 0,
                                borderColor: !isProMember
                                  ? currentTheme.colors.error
                                  : "transparent",
                              },
                            ]}
                            onPress={toggleDocumentSync}
                            disabled={false} // Always allow press to show pro-features page for non-pro users
                            activeOpacity={isProMember ? 0.7 : 1}
                          >
                            <View
                              style={[
                                styles.documentSyncSlider,
                                {
                                  transform: [
                                    {
                                      translateX:
                                        documentSyncEnabled && isProMember
                                          ? 18
                                          : 2,
                                    },
                                  ],
                                },
                              ]}
                            />
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* Add Document Button */}
                      <TouchableOpacity
                        style={[
                          styles.addDocumentButton,
                          { backgroundColor: currentTheme.colors.primary },
                        ]}
                        onPress={addDocument}
                      >
                        <Text style={styles.addDocumentIcon}>📎</Text>
                        <Text style={styles.addDocumentText}>Add Document</Text>
                      </TouchableOpacity>

                      {/* Documents List */}
                      {getHorseDocuments(selectedHorseForRecords.id).length >
                        0 && (
                        <View style={styles.documentsContainer}>
                          <Text
                            style={[
                              styles.documentsTitle,
                              { color: currentTheme.colors.text },
                            ]}
                          >
                            Stored Documents:
                          </Text>
                          {getHorseDocuments(selectedHorseForRecords.id).map(
                            (document) => (
                              <View
                                key={document.id}
                                style={[
                                  styles.documentItem,
                                  {
                                    backgroundColor:
                                      currentTheme.colors.surface,
                                    borderColor: currentTheme.colors.border,
                                  },
                                ]}
                              >
                                <TouchableOpacity
                                  style={styles.documentItemContent}
                                  onPress={() => openDocument(document)}
                                  disabled={editingDocumentId === document.id}
                                >
                                  <Text style={styles.documentIcon}>📄</Text>
                                  <View style={styles.documentInfo}>
                                    {editingDocumentId === document.id ? (
                                      <TextInput
                                        style={[
                                          styles.documentNameInput,
                                          {
                                            backgroundColor: currentTheme.colors.background,
                                            borderColor: currentTheme.colors.primary,
                                            color: currentTheme.colors.text,
                                          },
                                        ]}
                                        value={editingDocumentName}
                                        onChangeText={setEditingDocumentName}
                                        placeholder="Enter document name"
                                        placeholderTextColor={currentTheme.colors.textSecondary}
                                        maxLength={50}
                                        autoFocus={true}
                                        returnKeyType="done"
                                        onSubmitEditing={() => saveDocumentRename(selectedHorseForRecords.id, document.id)}
                                      />
                                    ) : (
                                      <Text
                                        style={[
                                          styles.documentName,
                                          { color: currentTheme.colors.text },
                                        ]}
                                      >
                                        {document.name}
                                      </Text>
                                    )}
                                    <Text
                                      style={[
                                        styles.documentDate,
                                        {
                                          color:
                                            currentTheme.colors.textSecondary,
                                        },
                                      ]}
                                    >
                                      Added:{" "}
                                      {new Date(
                                        document.createdAt
                                      ).toLocaleDateString()}
                                    </Text>
                                  </View>
                                </TouchableOpacity>
                                {editingDocumentId === document.id ? (
                                  <>
                                    <TouchableOpacity
                                      style={[
                                        styles.saveDocumentButton,
                                        { backgroundColor: currentTheme.colors.primary }
                                      ]}
                                      onPress={() => saveDocumentRename(selectedHorseForRecords.id, document.id)}
                                    >
                                      <Text style={styles.saveDocumentButtonText}>
                                        ✓
                                      </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                      style={styles.cancelEditButton}
                                      onPress={cancelEditingDocumentName}
                                    >
                                      <Text style={styles.cancelEditButtonText}>
                                        ✕
                                      </Text>
                                    </TouchableOpacity>
                                  </>
                                ) : (
                                  <>
                                    <TouchableOpacity
                                      style={styles.renameDocumentButton}
                                      onPress={() => startEditingDocumentName(document)}
                                    >
                                      <Text style={styles.renameDocumentButtonText}>
                                        ✏️
                                      </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                      style={styles.deleteDocumentButton}
                                      onPress={() =>
                                        deleteDocument(
                                          selectedHorseForRecords.id,
                                          document.id
                                        )
                                      }
                                    >
                                      <Text style={styles.deleteDocumentButtonText}>
                                        🗑️
                                      </Text>
                                    </TouchableOpacity>
                                  </>
                                )}
                              </View>
                            )
                          )}
                        </View>
                      )}

                      {getHorseDocuments(selectedHorseForRecords.id).length ===
                        0 && (
                        <View style={styles.emptyDocumentsState}>
                          <Text style={styles.emptyDocumentsIcon}>📄</Text>
                          <Text
                            style={[
                              styles.emptyDocumentsText,
                              { color: currentTheme.colors.textSecondary },
                            ]}
                          >
                            No documents added yet.
                          </Text>
                          <Text
                            style={[
                              styles.emptyDocumentsSubtext,
                              { color: currentTheme.colors.textSecondary },
                            ]}
                          >
                            Store vaccination certificates, health records, and
                            other important documents here.
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Rider Manager Section */}
                  {recordsSection === "rider" && (
                    <View style={styles.riderManagerContainer}>
                      <Text
                        style={[
                          styles.riderManagerTitle,
                          { color: currentTheme.colors.text },
                        ]}
                      >
                        Rider Manager for: {selectedHorseForRecords.name}
                      </Text>

                      <View style={styles.comingSoonContainer}>
                        <Text style={styles.comingSoonIcon}>🚧</Text>
                        <Text
                          style={[
                            styles.comingSoonTitle,
                            { color: currentTheme.colors.text },
                          ]}
                        >
                          Coming Soon
                        </Text>
                        <Text
                          style={[
                            styles.comingSoonDescription,
                            { color: currentTheme.colors.textSecondary },
                          ]}
                        >
                          Share your horses with other riders and allow them to
                          track sessions and view data. This feature will be
                          available for PRO members.
                        </Text>
                      </View>
                    </View>
                  )}
                </>
              )}
            </ScrollView>

            {/* Footer Actions */}
            {recordsSection === "vaccination" && (
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    styles.cancelButton,
                    { backgroundColor: currentTheme.colors.textSecondary },
                  ]}
                  onPress={() => {
                    setVaccinationName("");
                    setVaccinationId("");
                    setVaccinationDate(null);
                    setVaccinationNotes("");
                    setVaccinationType("future");
                    setVaccinationRepeat(false);
                    setShowVaccinationDatePicker(false);
                  }}
                >
                  <Text style={[styles.cancelButtonText, { color: "#FFFFFF" }]}>
                    Clear Form
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    styles.saveButton,
                    { backgroundColor: currentTheme.colors.primary },
                  ]}
                  onPress={saveVaccinationReminder}
                >
                  <Text style={[styles.saveButtonText, { color: "#FFFFFF" }]}>
                    Save {vaccinationType === "past" ? "Record" : "Reminder"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </Modal>

        {/* Add Event Modal */}
        <Modal
          visible={addEventModalVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setAddEventModalVisible(false)}
        >
          <View style={{ flex: 1, backgroundColor: currentTheme.colors.background }}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.modalTitle,
                    {
                      color: currentTheme.colors.text,
                      textAlign: "center",
                    },
                  ]}
                >
                  Add Event
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setAddEventModalVisible(false)}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              {/* Event Type Selection */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: currentTheme.colors.text }]}>
                  Event Type
                </Text>
                <View style={styles.eventTypeGrid}>
                  <TouchableOpacity
                    style={[
                      styles.eventTypeButton,
                      eventType === "ultrasound" && styles.eventTypeButtonActive,
                      { borderColor: currentTheme.colors.primary }
                    ]}
                    onPress={() => setEventType("ultrasound")}
                  >
                    <Text style={styles.eventTypeIcon}>🔍</Text>
                    <Text style={[
                      styles.eventTypeText,
                      eventType === "ultrasound" && styles.eventTypeTextActive
                    ]}>
                      Ultrasound
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.eventTypeButton,
                      eventType === "vaccine" && styles.eventTypeButtonActive,
                      { borderColor: currentTheme.colors.primary }
                    ]}
                    onPress={() => setEventType("vaccine")}
                  >
                    <Text style={styles.eventTypeIcon}>💉</Text>
                    <Text style={[
                      styles.eventTypeText,
                      eventType === "vaccine" && styles.eventTypeTextActive
                    ]}>
                      Vaccine
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.eventTypeButton,
                      eventType === "deworming" && styles.eventTypeButtonActive,
                      { borderColor: currentTheme.colors.primary }
                    ]}
                    onPress={() => setEventType("deworming")}
                  >
                    <Text style={styles.eventTypeIcon}>💊</Text>
                    <Text style={[
                      styles.eventTypeText,
                      eventType === "deworming" && styles.eventTypeTextActive
                    ]}>
                      Deworming
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.eventTypeButton,
                      eventType === "note" && styles.eventTypeButtonActive,
                      { borderColor: currentTheme.colors.primary }
                    ]}
                    onPress={() => setEventType("note")}
                  >
                    <Text style={styles.eventTypeIcon}>📝</Text>
                    <Text style={[
                      styles.eventTypeText,
                      eventType === "note" && styles.eventTypeTextActive
                    ]}>
                      Note
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Event Date */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: currentTheme.colors.text }]}>
                  Event Date *
                </Text>
                <DatePicker
                  value={eventDate}
                  placeholder="Select event date"
                  onSelect={setEventDate}
                  isVisible={showEventDatePicker}
                  setVisible={setShowEventDatePicker}
                />
              </View>

              {/* Notes */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: currentTheme.colors.text }]}>
                  Notes (Optional)
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: currentTheme.colors.accent,
                      color: currentTheme.colors.text,
                      borderColor: currentTheme.colors.primary,
                      minHeight: 100,
                      textAlignVertical: "top",
                    },
                  ]}
                  value={eventNotes}
                  onChangeText={setEventNotes}
                  placeholder="Enter any notes or observations..."
                  placeholderTextColor={currentTheme.colors.textSecondary}
                  multiline
                />
              </View>
            </ScrollView>

            {/* Footer Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.cancelButton,
                  { backgroundColor: currentTheme.colors.textSecondary },
                ]}
                onPress={() => {
                  setAddEventModalVisible(false);
                  setEventDate(null);
                  setEventNotes("");
                  setEventType("ultrasound");
                }}
              >
                <Text style={[styles.cancelButtonText, { color: "#FFFFFF" }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.saveButton,
                  { 
                    backgroundColor: currentTheme.colors.primary,
                    opacity: eventDate ? 1 : 0.5
                  },
                ]}
                onPress={handleAddEvent}
                disabled={!eventDate}
              >
                <Text style={[styles.saveButtonText, { color: "#FFFFFF" }]}>
                  Add Event
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Photo Capture Modal */}
        <Modal
          visible={photoCaptureModalVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setPhotoCaptureModalVisible(false)}
        >
          <View style={{ flex: 1, backgroundColor: currentTheme.colors.background }}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.modalTitle,
                    {
                      color: currentTheme.colors.text,
                      textAlign: "center",
                    },
                  ]}
                >
                  Capture Progress Photo
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setPhotoCaptureModalVisible(false)}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.photoCaptureContent}>
              <Text style={[styles.photoCaptureTitle, { color: currentTheme.colors.text }]}>
                Choose Photo Source
              </Text>
              <Text style={[styles.photoCaptureSubtitle, { color: currentTheme.colors.textSecondary }]}>
                Capture a new photo or select from your library
              </Text>

              <View style={styles.photoSourceButtons}>
                <TouchableOpacity
                  style={[
                    styles.photoSourceButton,
                    { backgroundColor: currentTheme.colors.primary }
                  ]}
                  onPress={() => {
                    setPhotoCaptureModalVisible(false);
                    handleCapturePhoto();
                  }}
                >
                  <Text style={styles.photoSourceIcon}>📷</Text>
                  <Text style={styles.photoSourceText}>Take Photo</Text>
                  <Text style={styles.photoSourceSubtext}>Use camera</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.photoSourceButton,
                    { backgroundColor: currentTheme.colors.accent, borderWidth: 2, borderColor: currentTheme.colors.primary }
                  ]}
                  onPress={() => {
                    setPhotoCaptureModalVisible(false);
                    handlePickPhotoFromLibrary();
                  }}
                >
                  <Text style={styles.photoSourceIcon}>🖼️</Text>
                  <Text style={[styles.photoSourceText, { color: currentTheme.colors.text }]}>
                    Choose from Library
                  </Text>
                  <Text style={[styles.photoSourceSubtext, { color: currentTheme.colors.textSecondary }]}>
                    Select existing photo
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.photoTipBanner}>
                <Text style={styles.photoTipIcon}>💡</Text>
                <View style={styles.photoTipContent}>
                  <Text style={styles.photoTipTitle}>Photography Tip</Text>
                  <Text style={styles.photoTipText}>
                    For best results, photograph your mare from the left side (left-lateral view) in good lighting. This allows consistent comparison throughout the pregnancy.
                  </Text>
                </View>
              </View>
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
  headerContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    marginBottom: Platform.OS === "ios" ? -20 : -45,
    marginTop: Platform.OS === "ios" ? -15 : -5,
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
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  modalTitle: {
    fontSize: 24,
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
    marginTop: -5,
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
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    fontFamily: "Inder",
    marginTop: 8,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: "#ddddddff",
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
  inlineImagePickerButtons: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  inlineImagePickerButton: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    paddingHorizontal: 12,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  inlineImagePickerEmoji: {
    fontSize: 24,
  },
  inlineImagePickerButtonText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inder",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 2,
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

  // Pregnancy Section on Horse Card Styles
  pregnancySection: {
    marginTop: 15,
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
  },
  pregnancySectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  pregnancySectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    fontFamily: "Inder",
  },
  pregnancyDayCount: {
    marginLeft: 15,
    fontSize: 18,
    fontWeight: "bold",
    fontFamily: "Inder",
  },
  pregnancyProgressContainer: {
    marginBottom: 10,
  },
  pregnancyProgressBar: {
    height: 8,
    backgroundColor: "#e0e0e0",
    borderRadius: 4,
    position: "relative",
    overflow: "visible",
    marginBottom: 8,
  },
  pregnancyProgressFill: {
    height: "100%",
    borderRadius: 4,
    position: "absolute",
    left: 0,
    top: 0,
  },
  pregnancyStageDivider: {
    position: "absolute",
    width: 2,
    height: 12,
    backgroundColor: "#666",
    top: -2,
  },
  pregnancyStageLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  pregnancyStageLabel: {
    fontSize: 10,
    fontFamily: "Inder",
    color: "#666",
    flex: 1,
    textAlign: "center",
  },
  pregnancyDueDate: {
    fontSize: 12,
    fontFamily: "Inder",
    marginTop: 5,
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
  vaccinationActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  editVaccinationButton: {
    padding: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  editVaccinationButtonText: {
    fontSize: 16,
  },
  completeVaccinationButton: {
    padding: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  completeVaccinationButtonText: {
    fontSize: 16,
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

  // Records Modal Styles
  recordsHorseName: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
    fontFamily: "Inder",
  },
  recordsMenuContainer: {
    gap: 15,
  },
  recordsMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    borderRadius: 15,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  recordsMenuIcon: {
    fontSize: 32,
    marginRight: 15,
  },
  recordsMenuContent: {
    flex: 1,
  },
  recordsMenuTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
    fontFamily: "Inder",
    marginBottom: 4,
  },
  recordsMenuSubtitle: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.8)",
    fontFamily: "Inder",
  },
  recordsMenuArrow: {
    fontSize: 20,
    color: "#FFFFFF",
  },
  backButton: {
    padding: 5,
    marginRight: 5,
  },
  backIcon: {
    width: 24,
    height: 24,
    tintColor: "#fff",
  },

  // Vaccination Manager Styles
  vaccinationTypeToggle: {
    flexDirection: "row",
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    borderRadius: 16,
    padding: 4,
    marginBottom: 20,
  },
  vaccinationTypeButtonLeft: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    width: "50%",
  },
  vaccinationTypeButtonRight: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    width: "50%",
  },
  vaccinationTypeButtonText: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    fontFamily: "Inder",
  },
  vaccinationItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  vaccinationItemId: {
    fontSize: 12,
    fontStyle: "italic",
    fontFamily: "Inder",
    marginBottom: 4,
  },
  repeatIndicator: {
    fontSize: 16,
    marginLeft: 8,
  },
  repeatToggleContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  repeatToggle: {
    width: 40,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
  },
  repeatToggleSlider: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#FFFFFF",
  },
  repeatIntervalContainer: {
    marginTop: 10,
  },
  repeatIntervalButtons: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  repeatIntervalButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  repeatIntervalButtonText: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    fontFamily: "Inder",
  },
  applyToFutureContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxCheck: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  applyToFutureText: {
    fontSize: 14,
    fontFamily: "Inder",
    flex: 1,
  },

  // Document Manager Styles
  documentHorseName: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
    fontFamily: "Inder",
  },
  documentSyncContainer: {
    backgroundColor: "rgba(0, 0, 0, 0.03)",
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
  },
  documentSyncHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  documentSyncInfo: {
    flex: 1,
    marginRight: 15,
  },
  documentSyncTitle: {
    fontSize: 16,
    fontWeight: "bold",
    fontFamily: "Inder",
    marginBottom: 4,
  },
  documentSyncSubtitle: {
    fontSize: 12,
    fontFamily: "Inder",
    lineHeight: 16,
  },
  documentSyncToggle: {
    width: 40,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
  },
  documentSyncSlider: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#FFFFFF",
  },
  documentsContainer: {
    marginBottom: 20,
  },
  documentsTitle: {
    fontSize: 16,
    fontWeight: "bold",
    fontFamily: "Inder",
    marginBottom: 15,
  },
  documentItem: {
    flexDirection: "row",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
  },
  documentItemContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  documentIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    fontSize: 16,
    fontWeight: "bold",
    fontFamily: "Inder",
    marginBottom: 2,
  },
  documentNameInput: {
    fontSize: 16,
    fontWeight: "bold",
    fontFamily: "Inder",
    marginBottom: 2,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 2,
  },
  documentDate: {
    fontSize: 12,
    fontFamily: "Inder",
  },
  renameDocumentButton: {
    padding: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  renameDocumentButtonText: {
    fontSize: 16,
  },
  saveDocumentButton: {
    padding: 6,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    marginTop: 6,
    marginRight: 4,
    marginLeft: 4,
    height: 36,
    width: 36,
  },
  saveDocumentButtonText: {
    fontSize: 18,
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  cancelEditButton: {
    padding: 6,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
  },
  cancelEditButtonText: {
    fontSize: 18,
    color: "#666",
    fontWeight: "bold",
  },
  deleteDocumentButton: {
    padding: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  deleteDocumentButtonText: {
    fontSize: 16,
  },
  addDocumentButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
  },
  addDocumentIcon: {
    fontSize: 20,
    marginRight: 10,
    color: "#FFFFFF",
  },
  addDocumentText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
    fontFamily: "Inder",
  },
  emptyDocumentsState: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyDocumentsIcon: {
    fontSize: 48,
    marginBottom: 15,
  },
  emptyDocumentsText: {
    fontSize: 16,
    fontWeight: "bold",
    fontFamily: "Inder",
    textAlign: "center",
    marginBottom: 8,
  },
  emptyDocumentsSubtext: {
    fontSize: 14,
    fontFamily: "Inder",
    textAlign: "center",
    lineHeight: 20,
  },

  // Pregnancy Manager Styles
  pregnancyHeader: {
    marginBottom: 20,
  },
  pregnancyHorseName: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    textAlign: "center",
    fontFamily: "Inder",
  },
  disclaimerBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e8d28aff",
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  disclaimerIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 12,
    color: "#856404",
    fontFamily: "Inder",
    lineHeight: 16,
  },
  noPregnancyContainer: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 30,
  },
  noPregnancyIcon: {
    fontSize: 80,
    marginBottom: 20,
  },
  noPregnancyTitle: {
    fontSize: 20,
    fontWeight: "bold",
    fontFamily: "Inder",
    marginBottom: 10,
  },
  noPregnancySubtitle: {
    fontSize: 14,
    fontFamily: "Inder",
    textAlign: "center",
    marginBottom: 30,
  },
  startPregnancyButton: {
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 15,
  },
  startPregnancyButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
    fontFamily: "Inder",
  },
  startPregnancySubtitle: {
    fontSize: 14,
    fontFamily: "Inder",
    textAlign: "center",
    marginBottom: 25,
    lineHeight: 20,
  },
  methodToggle: {
    flexDirection: "row",
    marginTop: 8,
    overflow: "hidden",
  },
  methodButtonLeft: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderTopLeftRadius: 15,
    borderBottomLeftRadius: 15,
    borderWidth: 1,
    borderRightWidth: 0,
    backgroundColor: "#f5f5f5",
  },
  methodButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    backgroundColor: "#f5f5f5",
  },
  methodButtonRight: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderTopRightRadius: 15,
    borderBottomRightRadius: 15,
    borderWidth: 1,
    borderLeftWidth: 0,
    backgroundColor: "#f5f5f5",
  },
  methodButtonActive: {
    backgroundColor: "#ff69b4",
  },
  methodButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    fontFamily: "Inder",
  },
  methodButtonTextActive: {
    color: "#FFFFFF",
  },
  pregnancyInfoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#e3f2fd",
    borderRadius: 15,
    padding: 15,
    marginBottom: 10,
  },
  pregnancyInfoIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  pregnancyInfoText: {
    flex: 1,
    fontSize: 13,
    color: "#1565c0",
    fontFamily: "Inder",
    lineHeight: 18,
  },
  pregnancyStatusContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  statusBadge: {
    backgroundColor: "#ff69b4",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  statusBadgeText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "bold",
    fontFamily: "Inder",
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  settingsButtonIcon: {
    fontSize: 20,
  },
  settingsContainer: {
    marginTop: 20,
  },
  settingsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    fontFamily: 'Inder',
  },
  statusOptionsContainer: {
    gap: 12,
  },
  statusOption: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
  },
  statusOptionText: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Inder',
  },
  statusHelpText: {
    fontSize: 13,
    marginTop: 8,
    fontFamily: 'Inder',
    textAlign: 'center',
  },
  divider: {
    height: 1,
    marginVertical: 20,
    marginTop: -20,
  },
  statusActionsContainer: {
    marginTop: 20,
    gap: 12,
  },
  exportButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  exportButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Inder',
  },
  pregnancyDeleteButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  pregnancyDeleteButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Inder',
  },
  saveFoalButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveFoalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Inder',
  },
  foalHelpText: {
    fontSize: 13,
    textAlign: 'center',
    fontFamily: 'Inder',
    fontStyle: 'italic',
    marginTop: 8,
  },
  saveSettingsButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 30,
  },
  saveSettingsButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Inder',
  },
  dayCounter: {
    alignItems: "flex-end",
  },
  dayCounterNumber: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#ff69b4",
    fontFamily: "Inder",
  },
  dayCounterLabel: {
    fontSize: 12,
    color: "#999",
    fontFamily: "Inder",
  },
  modalProgressContainer: {
    marginBottom: 20,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: "#e0e0e0",
    borderRadius: 4,
    position: "relative",
    overflow: "visible",
    marginBottom: 8,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#ff69b4",
    borderRadius: 4,
    position: "absolute",
    left: 0,
    top: 0,
  },
  modalStageDivider: {
    position: "absolute",
    width: 2,
    height: 16,
    backgroundColor: "#666",
    top: -4,
  },
  modalStageLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 5,
  },
  modalStageLabel: {
    fontSize: 11,
    fontFamily: "Inder",
    flex: 1,
    textAlign: "center",
  },
  nextActionCard: {
    padding: 15,
    borderRadius: 15,
    marginBottom: 20,
  },
  nextActionContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  nextActionTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  nextActionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#666",
    fontFamily: "Inder",
    marginBottom: 5,
    textTransform: "uppercase",
  },
  nextActionText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    fontFamily: "Inder",
    marginBottom: 3,
  },
  nextActionDays: {
    fontSize: 14,
    color: "#666",
    fontFamily: "Inder",
  },
  nextActionCheckButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  nextActionCheckIcon: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  viewToggle: {
    flexDirection: "row",
    marginBottom: 20,
    borderRadius: 15,
    overflow: "hidden",
  },
  viewToggleButtonLeft: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderTopLeftRadius: 15,
    borderBottomLeftRadius: 15,
    borderWidth: 1,
    borderRightWidth: 0,
    backgroundColor: "#f5f5f5",
  },
  viewToggleButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    backgroundColor: "#f5f5f5",
  },
  viewToggleButtonRight: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderTopRightRadius: 15,
    borderBottomRightRadius: 15,
    borderWidth: 1,
    borderLeftWidth: 0,
    backgroundColor: "#f5f5f5",
  },
  viewToggleButtonActive: {
    backgroundColor: "#ff69b4",
  },
  viewToggleText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    fontFamily: "Inder",
  },
  viewToggleTextActive: {
    color: "#FFFFFF",
  },
  timelineContainer: {
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    fontFamily: "Inder",
    marginBottom: 15,
  },
  addEventButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 20,
  },
  addEventButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
    fontFamily: "Inder",
  },
  inlineEventForm: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  inlineEventActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  inlineEventCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  inlineEventCancelButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: 'Inder',
  },
  inlineEventSaveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  inlineEventSaveButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: 'Inder',
  },
  eventsList: {
    marginTop: 10,
  },
  eventCard: {
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  eventCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  eventIcon: {
    fontSize: 24,
  },
  eventCardInfo: {
    flex: 1,
  },
  eventCardTitle: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inder",
    marginBottom: 4,
  },
  eventCardDate: {
    fontSize: 13,
    fontFamily: "Inder",
  },
  eventCardNotes: {
    fontSize: 14,
    fontFamily: "Inder",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(128, 128, 128, 0.2)",
    lineHeight: 20,
  },
  placeholderText: {
    fontSize: 14,
    fontFamily: "Inder",
    textAlign: "center",
    fontStyle: "italic",
    paddingVertical: 30,
  },
  fruitViewContainer: {
    marginTop: 10,
    alignItems: "center",
  },
  fruitDisplay: {
    alignItems: "center",
    marginBottom: 30,
  },
  fruitEmoji: {
    fontSize: 120,
    marginBottom: 20,
  },
  fruitSize: {
    fontSize: 18,
    fontWeight: "bold",
    fontFamily: "Inder",
    marginBottom: 8,
  },
  fruitMonth: {
    fontSize: 14,
    fontFamily: "Inder",
  },
  infoCard: {
    width: "100%",
    padding: 20,
    borderRadius: 15,
    marginBottom: 20,
  },
  infoCardTitle: {
    fontSize: 16,
    fontWeight: "bold",
    fontFamily: "Inder",
    marginBottom: 10,
    color: "#333",
  },
  infoCardText: {
    fontSize: 14,
    fontFamily: "Inder",
    lineHeight: 20,
    color: "#555",
  },
  photosContainer: {
    marginTop: 10,
  },
  capturePhotoButton: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 15,
    alignItems: "center",
    marginBottom: 20,
  },
  capturePhotoButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
    fontFamily: "Inder",
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  photoItem: {
    width: "48%",
    aspectRatio: 1,
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
  },
  photoImage: {
    width: "100%",
    height: "100%",
  },
  photoOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    padding: 8,
    alignItems: "center",
  },
  photoDay: {
    fontSize: 14,
    fontFamily: "Inder",
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  
  // Add Event Modal Styles
  eventTypeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 10,
  },
  eventTypeButton: {
    width: "48%",
    padding: 15,
    borderRadius: 12,
    borderWidth: 2,
    backgroundColor: "#f5f5f5",
    alignItems: "center",
    justifyContent: "center",
  },
  eventTypeButtonActive: {
    backgroundColor: "#ff69b4",
    borderColor: "#ff69b4",
  },
  eventTypeIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  eventTypeText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inder",
    color: "#666",
  },
  eventTypeTextActive: {
    color: "#FFFFFF",
  },

  // Photo Capture Modal Styles
  photoCaptureContent: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
  },
  photoCaptureTitle: {
    fontSize: 24,
    fontWeight: "bold",
    fontFamily: "Inder",
    textAlign: "center",
    marginBottom: 10,
  },
  photoCaptureSubtitle: {
    fontSize: 16,
    fontFamily: "Inder",
    textAlign: "center",
    marginBottom: 40,
  },
  photoSourceButtons: {
    gap: 15,
    marginBottom: 40,
  },
  photoSourceButton: {
    padding: 25,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  photoSourceIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  photoSourceText: {
    fontSize: 18,
    fontWeight: "bold",
    fontFamily: "Inder",
    color: "#FFFFFF",
    marginBottom: 5,
  },
  photoSourceSubtext: {
    fontSize: 14,
    fontFamily: "Inder",
    color: "rgba(255, 255, 255, 0.8)",
  },
  photoTipBanner: {
    flexDirection: "row",
    backgroundColor: "#fff3cd",
    borderRadius: 12,
    padding: 15,
    alignItems: "flex-start",
  },
  photoTipIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  photoTipContent: {
    flex: 1,
  },
  photoTipTitle: {
    fontSize: 16,
    fontWeight: "bold",
    fontFamily: "Inder",
    color: "#856404",
    marginBottom: 5,
  },
  photoTipText: {
    fontSize: 14,
    fontFamily: "Inder",
    color: "#856404",
    lineHeight: 20,
  },
  pregnancyFormContainer: {
    paddingBottom: 20,
  },
  pregnancyFormTitle: {
    fontSize: 20,
    fontWeight: "bold",
    fontFamily: "Inder",
    marginBottom: 10,
    textAlign: "center",
  },
  pregnancyFormActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
    marginBottom: 10,
  },
  pregnancyFormButton: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  pregnancyCancelButton: {
    // backgroundColor set dynamically
  },
  pregnancySaveButton: {
    // backgroundColor set dynamically
  },
  pregnancyFormButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
    fontFamily: "Inder",
  },

  // Document Viewer Modal Styles
  documentViewerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  documentViewerContainer: {
    width: "95%",
    height: "90%",
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    overflow: "hidden",
  },
  documentViewerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
    backgroundColor: "#2a2a2a",
    borderBottomWidth: 1,
    borderBottomColor: "#444",
  },
  documentViewerTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
    fontFamily: "Inder",
    flex: 1,
  },
  documentViewerCloseButton: {
    padding: 5,
  },
  documentViewerCloseText: {
    fontSize: 24,
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  documentViewerContent: {
    flex: 1,
  },
  documentViewerContentContainer: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  documentViewerImage: {
    width: "100%",
    height: "100%",
  },
  documentViewerActions: {
    flexDirection: "row",
    padding: 15,
    gap: 10,
    backgroundColor: "#2a2a2a",
    borderTopWidth: 1,
    borderTopColor: "#444",
  },
  documentViewerButton: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
  },
  documentViewerButtonText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#FFFFFF",
    fontFamily: "Inder",
  },

  // Rename Document Modal Styles
  renameModalContainer: {
    width: "85%",
    maxWidth: 400,
    borderRadius: 12,
    overflow: "hidden",
  },
  renameModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
  },
  renameModalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
    fontFamily: "Inder",
    flex: 1,
  },
  renameModalCloseButton: {
    padding: 5,
  },
  renameModalCloseText: {
    fontSize: 24,
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  renameModalContent: {
    padding: 20,
  },
  renameModalLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    fontFamily: "Inder",
  },
  renameModalInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    fontFamily: "Inder",
  },
  renameModalActions: {
    flexDirection: "row",
    padding: 15,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  renameModalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  renameModalButtonText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#FFFFFF",
    fontFamily: "Inder",
  },

  // Rider Manager Styles
  riderManagerContainer: {
    alignItems: "center",
  },
  riderManagerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 30,
    textAlign: "center",
    fontFamily: "Inder",
  },
  comingSoonContainer: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 30,
  },
  comingSoonIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  comingSoonTitle: {
    fontSize: 24,
    fontWeight: "bold",
    fontFamily: "Inder",
    marginBottom: 15,
  },
  comingSoonDescription: {
    fontSize: 16,
    fontFamily: "Inder",
    textAlign: "center",
    lineHeight: 24,
  },
});

export default MyHorsesScreen;
