import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { StorageService, UploadResult } from "../lib/storageService";

interface ImageUploadComponentProps {
  onUploadComplete: (result: UploadResult) => void;
  uploadType:
    | "badge"
    | "challenge"
    | "global-challenge"
    | "stable"
    | "profile"
    | "horse"
    | "general";
  bucketName?: string;
  folderName?: string;
  currentImageUrl?: string;
  userId?: string;
  stableId?: string;
  challengeId?: string;
  maxSize?: number; // in MB
  allowedTypes?: string[];
  showPreview?: boolean;
  disabled?: boolean;
}

export default function ImageUploadComponent({
  onUploadComplete,
  uploadType,
  bucketName = "images",
  folderName = "uploads",
  currentImageUrl,
  userId,
  stableId,
  challengeId,
  maxSize = 5,
  allowedTypes = ["image/jpeg", "image/png", "image/webp"],
  showPreview = true,
  disabled = false,
}: ImageUploadComponentProps) {
  const { currentTheme } = useTheme();
  const theme = currentTheme.colors;
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(
    currentImageUrl
  );

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Please grant camera roll permissions to upload images."
      );
      return false;
    }
    return true;
  };

  const validateFile = (file: any): { valid: boolean; error?: string } => {
    // Check file type
    if (!allowedTypes.includes(file.mimeType || file.type)) {
      return {
        valid: false,
        error: `Invalid file type. Allowed types: ${allowedTypes.join(", ")}`,
      };
    }

    // Check file size
    const maxSizeBytes = maxSize * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return {
        valid: false,
        error: `File size too large. Maximum size: ${maxSize}MB`,
      };
    }

    return { valid: true };
  };

  const uploadFile = async (
    fileUri: string,
    fileName: string,
    mimeType: string
  ) => {
    try {
      setUploading(true);

      // Create File object for upload
      const response = await fetch(fileUri);
      const blob = await response.blob();
      const file = new File([blob], fileName, { type: mimeType });

      // Validate file
      const validation = validateFile(file);
      if (!validation.valid) {
        Alert.alert("Upload Error", validation.error);
        return;
      }

      let result: UploadResult;

      // Upload based on type
      switch (uploadType) {
        case "badge":
          result = await StorageService.uploadBadgeIcon(file, fileName);
          break;
        case "challenge":
          result = await StorageService.uploadChallengeIcon(file, fileName);
          break;
        case "global-challenge":
          if (!challengeId) {
            Alert.alert(
              "Error",
              "Challenge ID required for global challenge uploads"
            );
            return;
          }
          result = await StorageService.uploadGlobalChallengeIcon(
            file,
            challengeId,
            fileName
          );
          break;
        case "stable":
          if (!stableId) {
            Alert.alert("Error", "Stable ID required for stable uploads");
            return;
          }
          result = await StorageService.uploadStableIcon(
            file,
            stableId,
            fileName
          );
          break;
        case "profile":
          if (!userId) {
            Alert.alert("Error", "User ID required for profile uploads");
            return;
          }
          result = await StorageService.uploadProfileImage(file, userId);
          break;
        case "horse":
        case "general":
        default:
          result = await StorageService.uploadImage(
            file,
            bucketName,
            folderName,
            fileName
          );
          break;
      }

      if (result.success && result.url) {
        setPreviewUrl(result.url);
        onUploadComplete(result);
        Alert.alert("Success", "Image uploaded successfully!");
      } else {
        Alert.alert("Upload Failed", result.error || "Unknown error occurred");
      }
    } catch (error) {
      console.error("Upload error:", error);
      Alert.alert(
        "Upload Failed",
        "An error occurred while uploading the image"
      );
    } finally {
      setUploading(false);
    }
  };

  const pickImageFromLibrary = async () => {
    if (disabled) return;

    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: uploadType === "profile" ? [1, 1] : [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const fileName = `${uploadType}_${Date.now()}.${asset.uri
          .split(".")
          .pop()}`;
        await uploadFile(asset.uri, fileName, asset.type || "image/jpeg");
      }
    } catch (error) {
      console.error("Image picker error:", error);
      Alert.alert("Error", "Failed to pick image from library");
    }
  };

  const takePhoto = async () => {
    if (disabled) return;

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Please grant camera permissions to take photos."
      );
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: uploadType === "profile" ? [1, 1] : [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const fileName = `${uploadType}_${Date.now()}.${asset.uri
          .split(".")
          .pop()}`;
        await uploadFile(asset.uri, fileName, asset.type || "image/jpeg");
      }
    } catch (error) {
      console.error("Camera error:", error);
      Alert.alert("Error", "Failed to take photo");
    }
  };

  const showUploadOptions = () => {
    Alert.alert("Upload Image", "Choose an option", [
      { text: "Camera", onPress: takePhoto },
      { text: "Photo Library", onPress: pickImageFromLibrary },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  return (
    <View style={styles.container}>
      {showPreview && previewUrl && (
        <View style={[styles.previewContainer, { borderColor: theme.border }]}>
          <Image source={{ uri: previewUrl }} style={styles.previewImage} />
        </View>
      )}

      <TouchableOpacity
        style={[
          styles.uploadButton,
          { backgroundColor: disabled ? theme.border : theme.primary },
          uploading && styles.uploadingButton,
        ]}
        onPress={showUploadOptions}
        disabled={disabled || uploading}
      >
        {uploading ? (
          <View style={styles.uploadingContainer}>
            <ActivityIndicator color="white" size="small" />
            <Text style={[styles.uploadButtonText, { marginLeft: 8 }]}>
              Uploading...
            </Text>
          </View>
        ) : (
          <Text style={styles.uploadButtonText}>
            {previewUrl ? "Change Image" : "Upload Image"}
          </Text>
        )}
      </TouchableOpacity>

      <Text style={[styles.helpText, { color: theme.textSecondary }]}>
        Max size: {maxSize}MB • Formats:{" "}
        {allowedTypes
          .map((type) => type.split("/")[1].toUpperCase())
          .join(", ")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: 16,
  },
  previewContainer: {
    width: 120,
    height: 120,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 16,
    overflow: "hidden",
  },
  previewImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  uploadButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 140,
  },
  uploadingButton: {
    opacity: 0.7,
  },
  uploadingContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  uploadButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  helpText: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 16,
  },
});
