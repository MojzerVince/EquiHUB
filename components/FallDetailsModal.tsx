import React from "react";
import {
  Linking,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../contexts/ThemeContext";
import { FallNotificationData } from "../lib/emergencyFriendsAPI";

interface FallDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  fallData: FallNotificationData | null;
}

export const FallDetailsModal: React.FC<FallDetailsModalProps> = ({
  visible,
  onClose,
  fallData,
}) => {
  const { currentTheme } = useTheme();

  const openGoogleMaps = () => {
    if (fallData?.coordinates) {
      const { latitude, longitude } = fallData.coordinates;
      const googleMapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
      Linking.openURL(googleMapsUrl);
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatCoordinates = (lat: number, lng: number) => {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  };

  if (!fallData) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={[
          styles.container,
          { backgroundColor: currentTheme.colors.background },
        ]}
      >
        {/* Header */}
        <View
          style={[
            styles.header,
            { backgroundColor: currentTheme.colors.primary },
          ]}
        >
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {fallData.emergencyType === "fall_detection"
              ? "🚨 Fall Detected"
              : "🆘 Emergency Alert"}
          </Text>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Rider Name */}
          <View
            style={[
              styles.infoCard,
              {
                backgroundColor: currentTheme.colors.surface,
                borderColor: currentTheme.colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.infoLabel,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              Rider
            </Text>
            <Text
              style={[styles.infoValue, { color: currentTheme.colors.text }]}
            >
              {fallData.riderName}
            </Text>
          </View>

          {/* Emergency Type */}
          <View
            style={[
              styles.infoCard,
              {
                backgroundColor: currentTheme.colors.surface,
                borderColor: currentTheme.colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.infoLabel,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              Alert Type
            </Text>
            <Text
              style={[styles.infoValue, { color: currentTheme.colors.text }]}
            >
              {fallData.emergencyType === "fall_detection"
                ? "Automatic Fall Detection"
                : "Manual Emergency"}
            </Text>
          </View>

          {/* Time */}
          <View
            style={[
              styles.infoCard,
              {
                backgroundColor: currentTheme.colors.surface,
                borderColor: currentTheme.colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.infoLabel,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              Time
            </Text>
            <Text
              style={[styles.infoValue, { color: currentTheme.colors.text }]}
            >
              {formatTimestamp(fallData.timestamp)}
            </Text>
          </View>

          {/* Location */}
          {fallData.coordinates.latitude !== 0 &&
            fallData.coordinates.longitude !== 0 && (
              <View
                style={[
                  styles.infoCard,
                  {
                    backgroundColor: currentTheme.colors.surface,
                    borderColor: currentTheme.colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.infoLabel,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  Location
                </Text>
                <TouchableOpacity
                  onPress={openGoogleMaps}
                  style={styles.locationButton}
                >
                  <Text
                    style={[
                      styles.coordinatesText,
                      { color: currentTheme.colors.primary },
                    ]}
                  >
                    📍{" "}
                    {formatCoordinates(
                      fallData.coordinates.latitude,
                      fallData.coordinates.longitude
                    )}
                  </Text>
                  <Text
                    style={[
                      styles.tapHint,
                      { color: currentTheme.colors.textSecondary },
                    ]}
                  >
                    Tap to open in Google Maps
                  </Text>
                </TouchableOpacity>
              </View>
            )}

          {/* Emergency Actions */}
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.primaryButton,
                { backgroundColor: currentTheme.colors.primary },
              ]}
              onPress={openGoogleMaps}
            >
              <Text
                style={[
                  styles.actionButtonText,
                  { color: currentTheme.colors.background },
                ]}
              >
                🗺️ View Location
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.secondaryButton,
                {
                  borderColor: currentTheme.colors.border,
                  backgroundColor: currentTheme.colors.surface,
                },
              ]}
              onPress={() => Linking.openURL("tel:911")}
            >
              <Text
                style={[
                  styles.actionButtonText,
                  { color: currentTheme.colors.text },
                ]}
              >
                📞 Call Emergency Services
              </Text>
            </TouchableOpacity>
          </View>

          {/* Warning Message */}
          <View
            style={[
              styles.warningCard,
              {
                backgroundColor: currentTheme.colors.warning + "20",
                borderColor: currentTheme.colors.warning,
              },
            ]}
          >
            <Text
              style={[
                styles.warningText,
                { color: currentTheme.colors.warning },
              ]}
            >
              ⚠️ If this is a real emergency, please call emergency services
              immediately.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
    position: "relative",
  },
  closeButton: {
    position: "absolute",
    left: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  closeButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
    fontFamily: "Inder",
  },
  content: {
    flex: 1,
    padding: 20,
  },
  infoCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: "500",
    fontFamily: "Inder",
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inder",
  },
  locationButton: {
    paddingVertical: 4,
  },
  coordinatesText: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inder",
    marginBottom: 2,
  },
  tapHint: {
    fontSize: 12,
    fontStyle: "italic",
    fontFamily: "Inder",
  },
  actionButtonsContainer: {
    marginTop: 20,
    gap: 12,
  },
  actionButton: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryButton: {
    // backgroundColor handled by theme
  },
  secondaryButton: {
    borderWidth: 2,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    fontFamily: "Inder",
  },
  warningCard: {
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    borderWidth: 1,
  },
  warningText: {
    fontSize: 14,
    fontWeight: "500",
    fontFamily: "Inder",
    textAlign: "center",
    lineHeight: 20,
  },
});
