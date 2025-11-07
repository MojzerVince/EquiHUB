import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { createPlannedSession } from "../lib/plannedSessionAPI";
import {
    schedulePlannedSessionNotification,
    scheduleRepeatingSessionNotifications
} from "../lib/plannedSessionNotifications";

interface Horse {
  id: string;
  name: string;
  breed?: string;
}

const TRAINING_TYPES = [
  "Dressage",
  "Jumping",
  "Trail Riding",
  "Lunging",
  "Ground Work",
  "Competition",
  "Flatwork",
  "Cross Country",
  "Other",
];

const AddPlannedSessionScreen = () => {
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  const weekOffset = parseInt(params.weekOffset as string) || 0;

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [trainingType, setTrainingType] = useState("Dressage");
  const [showTrainingTypePicker, setShowTrainingTypePicker] = useState(false);
  const [selectedHorse, setSelectedHorse] = useState<Horse | null>(null);
  const [showHorsePicker, setShowHorsePicker] = useState(false);
  const [horses, setHorses] = useState<Horse[]>([]);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [repeatPattern, setRepeatPattern] = useState<
    "daily" | "weekly" | "monthly"
  >("weekly");
  const [showRepeatPicker, setShowRepeatPicker] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingHorses, setLoadingHorses] = useState(true);

  // Calculate initial date based on week offset
  useEffect(() => {
    const now = new Date();
    
    // If no week offset, start with today
    if (weekOffset === 0) {
      const today = new Date(now);
      today.setHours(12, 0, 0, 0);
      setSelectedDate(today);
    } else {
      // For other weeks, calculate based on Monday of that week
      const currentDay = now.getDay();
      const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;

      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() + mondayOffset + weekOffset * 7);
      startOfWeek.setHours(12, 0, 0, 0);

      setSelectedDate(startOfWeek);
    }
  }, [weekOffset]);

  // Load user's horses
  useEffect(() => {
    loadHorses();
  }, []);

  const loadHorses = async () => {
    try {
      setLoadingHorses(true);
      const savedHorses = await AsyncStorage.getItem(
        `user_horses_${user?.id}`
      );

      if (savedHorses) {
        const parsedHorses: Horse[] = JSON.parse(savedHorses);
        setHorses(parsedHorses);
        if (parsedHorses.length > 0) {
          setSelectedHorse(parsedHorses[0]);
        }
      }
    } catch (error) {
      console.error("Error loading horses:", error);
    } finally {
      setLoadingHorses(false);
    }
  };

  // Handle image upload
  const handleImageUpload = async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Please grant camera roll permissions to upload images."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setImageUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      Alert.alert("Error", "Failed to upload image");
    }
  };

  // Handle save
  const handleSave = async () => {
    // Validation
    if (!title.trim()) {
      Alert.alert("Validation Error", "Please enter a title");
      return;
    }

    if (!selectedHorse) {
      Alert.alert("Validation Error", "Please select a horse");
      return;
    }

    try {
      setLoading(true);

      // Upload image to Supabase storage if present
      let uploadedImageUrl: string | undefined = undefined;
      if (imageUri) {
        // TODO: Implement image upload to Supabase storage
        // For now, we'll store the local URI
        uploadedImageUrl = imageUri;
      }

      // Create new planned session in database
      const result = await createPlannedSession({
        horseId: selectedHorse.id,
        horseName: selectedHorse.name,
        trainingType,
        title: title.trim(),
        description: description.trim(),
        plannedDate: selectedDate,
        reminderEnabled,
        repeatEnabled,
        repeatPattern: repeatEnabled ? repeatPattern : undefined,
        imageUrl: uploadedImageUrl,
      });

      if (!result.success || !result.data) {
        throw new Error(result.error || "Failed to create planned session");
      }

      // Schedule notifications if reminders are enabled
      if (reminderEnabled) {
        if (repeatEnabled && repeatPattern) {
          // Schedule repeating notifications
          await scheduleRepeatingSessionNotifications(result.data);
        } else {
          // Schedule single notification
          await schedulePlannedSessionNotification(result.data);
        }
      }

      Alert.alert("Success", "Session planned successfully!", [
        {
          text: "OK",
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      console.error("Error saving planned session:", error);
      Alert.alert("Error", "Failed to save session. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === "ios");
    if (selectedDate) {
      setSelectedDate(selectedDate);
    }
  };

  if (loadingHorses) {
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
            <Text style={styles.header}>Add Session Plan</Text>
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
              style={[
                styles.loadingText,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              Loading...
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
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Image
              source={require("../assets/in_app_icons/back.png")}
              style={styles.backIcon}
            />
          </TouchableOpacity>
          <Text style={styles.header}>Add Session Plan</Text>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoid}
      >
        <View
          style={[
            styles.viewPort,
            { backgroundColor: currentTheme.colors.background },
          ]}
        >
          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.formContainer}>
              {/* Title Input */}
              <View style={styles.inputGroup}>
                <Text
                  style={[
                    styles.label,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  Title *
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: currentTheme.colors.surface,
                      color: currentTheme.colors.text,
                      borderColor: currentTheme.colors.border,
                    },
                  ]}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="e.g., Morning Training"
                  placeholderTextColor={currentTheme.colors.textSecondary}
                />
              </View>

              {/* Training Type Picker */}
              <View style={styles.inputGroup}>
                <Text
                  style={[
                    styles.label,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  Training Type *
                </Text>
                <TouchableOpacity
                  style={[
                    styles.picker,
                    {
                      backgroundColor: currentTheme.colors.surface,
                      borderColor: currentTheme.colors.border,
                    },
                  ]}
                  onPress={() =>
                    setShowTrainingTypePicker(!showTrainingTypePicker)
                  }
                >
                  <Text style={[styles.pickerText, { color: currentTheme.colors.text }]}>
                    {trainingType}
                  </Text>
                  <Text style={styles.pickerArrow}>▼</Text>
                </TouchableOpacity>

                {showTrainingTypePicker && (
                  <View
                    style={[
                      styles.pickerOptions,
                      {
                        backgroundColor: currentTheme.colors.surface,
                        borderColor: currentTheme.colors.border,
                      },
                    ]}
                  >
                    {TRAINING_TYPES.map((type) => (
                      <TouchableOpacity
                        key={type}
                        style={styles.pickerOption}
                        onPress={() => {
                          setTrainingType(type);
                          setShowTrainingTypePicker(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.pickerOptionText,
                            { color: currentTheme.colors.text },
                          ]}
                        >
                          {type}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* Date Picker */}
              <View style={styles.inputGroup}>
                <Text
                  style={[
                    styles.label,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  Date *
                </Text>
                <TouchableOpacity
                  style={[
                    styles.picker,
                    {
                      backgroundColor: currentTheme.colors.surface,
                      borderColor: currentTheme.colors.border,
                    },
                  ]}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Text style={[styles.pickerText, { color: currentTheme.colors.text }]}>
                    {selectedDate.toLocaleDateString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </Text>
                  <Text style={styles.pickerArrow}>📅</Text>
                </TouchableOpacity>

                {showDatePicker && (
                  <DateTimePicker
                    value={selectedDate}
                    mode="date"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    onChange={onDateChange}
                    minimumDate={new Date()}
                  />
                )}
              </View>

              {/* Horse Picker */}
              <View style={styles.inputGroup}>
                <Text
                  style={[
                    styles.label,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  Horse *
                </Text>
                {horses.length === 0 ? (
                  <Text
                    style={[
                      styles.noHorsesText,
                      { color: currentTheme.colors.textSecondary },
                    ]}
                  >
                    No horses available. Please add a horse first.
                  </Text>
                ) : (
                  <>
                    <TouchableOpacity
                      style={[
                        styles.picker,
                        {
                          backgroundColor: currentTheme.colors.surface,
                          borderColor: currentTheme.colors.border,
                        },
                      ]}
                      onPress={() => setShowHorsePicker(!showHorsePicker)}
                    >
                      <Text
                        style={[styles.pickerText, { color: currentTheme.colors.text }]}
                      >
                        {selectedHorse?.name || "Select a horse"}
                      </Text>
                      <Text style={styles.pickerArrow}>▼</Text>
                    </TouchableOpacity>

                    {showHorsePicker && (
                      <View
                        style={[
                          styles.pickerOptions,
                          {
                            backgroundColor: currentTheme.colors.surface,
                            borderColor: currentTheme.colors.border,
                          },
                        ]}
                      >
                        {horses.map((horse) => (
                          <TouchableOpacity
                            key={horse.id}
                            style={styles.pickerOption}
                            onPress={() => {
                              setSelectedHorse(horse);
                              setShowHorsePicker(false);
                            }}
                          >
                            <Text
                              style={[
                                styles.pickerOptionText,
                                { color: currentTheme.colors.text },
                              ]}
                            >
                              {horse.name}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </>
                )}
              </View>

              {/* Description Input */}
              <View style={styles.inputGroup}>
                <Text
                  style={[
                    styles.label,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  Description
                </Text>
                <TextInput
                  style={[
                    styles.textArea,
                    {
                      backgroundColor: currentTheme.colors.surface,
                      color: currentTheme.colors.text,
                      borderColor: currentTheme.colors.border,
                    },
                  ]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Add notes about this training session..."
                  placeholderTextColor={currentTheme.colors.textSecondary}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              {/* Image Upload */}
              <View style={styles.inputGroup}>
                <Text
                  style={[
                    styles.label,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  Image (Optional)
                </Text>
                {imageUri ? (
                  <View style={styles.imagePreviewContainer}>
                    <Image
                      source={{ uri: imageUri }}
                      style={styles.imagePreview}
                    />
                    <TouchableOpacity
                      style={[
                        styles.removeImageButton,
                        { backgroundColor: currentTheme.colors.primary },
                      ]}
                      onPress={() => setImageUri(null)}
                    >
                      <Text style={styles.removeImageText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.uploadButton,
                      {
                        backgroundColor: currentTheme.colors.surface,
                        borderColor: currentTheme.colors.border,
                      },
                    ]}
                    onPress={handleImageUpload}
                  >
                    <Text style={styles.uploadIcon}>📷</Text>
                    <Text
                      style={[
                        styles.uploadText,
                        { color: currentTheme.colors.textSecondary },
                      ]}
                    >
                      Upload Image
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Reminder Toggle */}
              <View style={styles.toggleGroup}>
                <View style={styles.toggleInfo}>
                  <Text
                    style={[styles.toggleLabel, { color: currentTheme.colors.text }]}
                  >
                    Enable Reminder
                  </Text>
                  <Text
                    style={[
                      styles.toggleDescription,
                      { color: currentTheme.colors.textSecondary },
                    ]}
                  >
                    Get notified before the session
                  </Text>
                </View>
                <Switch
                  value={reminderEnabled}
                  onValueChange={setReminderEnabled}
                  trackColor={{
                    false: "#767577",
                    true: currentTheme.colors.primary,
                  }}
                  thumbColor="#f4f3f4"
                />
              </View>

              {/* Repeat Toggle */}
              <View style={styles.toggleGroup}>
                <View style={styles.toggleInfo}>
                  <Text
                    style={[styles.toggleLabel, { color: currentTheme.colors.text }]}
                  >
                    Repeat Session
                  </Text>
                  <Text
                    style={[
                      styles.toggleDescription,
                      { color: currentTheme.colors.textSecondary },
                    ]}
                  >
                    Create recurring sessions
                  </Text>
                </View>
                <Switch
                  value={repeatEnabled}
                  onValueChange={setRepeatEnabled}
                  trackColor={{
                    false: "#767577",
                    true: currentTheme.colors.primary,
                  }}
                  thumbColor="#f4f3f4"
                />
              </View>

              {/* Repeat Pattern Picker */}
              {repeatEnabled && (
                <View style={styles.inputGroup}>
                  <Text
                    style={[
                      styles.label,
                      { color: currentTheme.colors.textSecondary },
                    ]}
                  >
                    Repeat Pattern
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.picker,
                      {
                        backgroundColor: currentTheme.colors.surface,
                        borderColor: currentTheme.colors.border,
                      },
                    ]}
                    onPress={() => setShowRepeatPicker(!showRepeatPicker)}
                  >
                    <Text
                      style={[styles.pickerText, { color: currentTheme.colors.text }]}
                    >
                      {repeatPattern.charAt(0).toUpperCase() +
                        repeatPattern.slice(1)}
                    </Text>
                    <Text style={styles.pickerArrow}>▼</Text>
                  </TouchableOpacity>

                  {showRepeatPicker && (
                    <View
                      style={[
                        styles.pickerOptions,
                        {
                          backgroundColor: currentTheme.colors.surface,
                          borderColor: currentTheme.colors.border,
                        },
                      ]}
                    >
                      {(["daily", "weekly", "monthly"] as const).map(
                        (pattern) => (
                          <TouchableOpacity
                            key={pattern}
                            style={styles.pickerOption}
                            onPress={() => {
                              setRepeatPattern(pattern);
                              setShowRepeatPicker(false);
                            }}
                          >
                            <Text
                              style={[
                                styles.pickerOptionText,
                                { color: currentTheme.colors.text },
                              ]}
                            >
                              {pattern.charAt(0).toUpperCase() +
                                pattern.slice(1)}
                            </Text>
                          </TouchableOpacity>
                        )
                      )}
                    </View>
                  )}
                </View>
              )}
            </View>
          </ScrollView>

          {/* Add Session Button */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.addSessionButton,
                {
                  backgroundColor: currentTheme.colors.primary,
                  opacity: loading ? 0.6 : 1,
                },
              ]}
              onPress={handleSave}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.addSessionButtonText}>Add Session</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
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
    marginBottom: Platform.OS === "ios" ? -15 : -45,
    marginTop: Platform.OS === "ios" ? -15 : -5,
  },
  backButton: {
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
  backIcon: {
    width: 30,
    height: 30,
  },
  header: {
    fontSize: 28,
    fontFamily: "Inder",
    color: "#fff",
    textAlign: "center",
    flex: 1,
    fontWeight: "600",
  },
  placeholder: {
    width: 60,
  },
  keyboardAvoid: {
    flex: 1,
  },
  viewPort: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 50,
    borderTopRightRadius: 50,
    marginTop: -8,
    paddingTop: 30,
  },
  scrollView: {
    flex: 1,
  },
  formContainer: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 100,
  },
  picker: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  pickerText: {
    fontSize: 16,
  },
  pickerArrow: {
    fontSize: 12,
    color: "#888",
  },
  pickerOptions: {
    borderWidth: 1,
    borderRadius: 12,
    marginTop: 8,
    overflow: "hidden",
  },
  pickerOption: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  pickerOptionText: {
    fontSize: 16,
  },
  noHorsesText: {
    fontSize: 14,
    fontStyle: "italic",
    padding: 16,
  },
  uploadButton: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  uploadText: {
    fontSize: 14,
    fontWeight: "600",
  },
  imagePreviewContainer: {
    position: "relative",
  },
  imagePreview: {
    width: "100%",
    height: 200,
    borderRadius: 12,
  },
  removeImageButton: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  removeImageText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  toggleGroup: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  toggleInfo: {
    flex: 1,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  toggleDescription: {
    fontSize: 14,
  },
  buttonContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
  addSessionButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  addSessionButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    marginTop: 12,
  },
});

export default AddPlannedSessionScreen;
