import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useThemeColor } from "@/hooks/useThemeColor";
import { MaterialIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface EmergencyData {
  riderId: string;
  riderName: string;
  latitude?: number;
  longitude?: number;
  timestamp: number;
  message: string;
}

export default function EmergencyNotificationScreen() {
  const params = useLocalSearchParams();
  const colorScheme = useColorScheme();
  const backgroundColor = useThemeColor(
    { light: Colors.light.background, dark: Colors.dark.background },
    "background"
  );
  const textColor = useThemeColor(
    { light: Colors.light.text, dark: Colors.dark.text },
    "text"
  );
  const cardColor = useThemeColor(
    { light: "#f8f9fa", dark: "#2c2c2e" },
    "background"
  );
  const dangerColor = "#dc3545";
  const primaryColor = "#007AFF";

  const [emergencyData, setEmergencyData] = useState<EmergencyData | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Parse emergency data from navigation params
    try {
      if (params.data) {
        const data =
          typeof params.data === "string"
            ? JSON.parse(params.data)
            : params.data;
        setEmergencyData({
          riderId: data.riderId || "Unknown",
          riderName: data.riderName || "Unknown Rider",
          latitude: data.latitude,
          longitude: data.longitude,
          timestamp: data.timestamp || Date.now(),
          message:
            data.message ||
            "Fall detected - immediate assistance may be required!",
        });
      }
    } catch (error) {
      console.error("Failed to parse emergency data:", error);
      Alert.alert("Error", "Failed to load emergency notification data");
    } finally {
      setLoading(false);
    }
  }, [params]);

  const openInGoogleMaps = () => {
    if (!emergencyData?.latitude || !emergencyData?.longitude) {
      Alert.alert(
        "Location Unavailable",
        "GPS coordinates are not available for this emergency alert."
      );
      return;
    }

    const { latitude, longitude } = emergencyData;
    const label = encodeURIComponent(
      `${emergencyData.riderName} - Emergency Location`
    );

    // Construct Google Maps URL
    let url: string;

    if (Platform.OS === "ios") {
      // Try Google Maps app first, fallback to Apple Maps
      url = `comgooglemaps://?q=${latitude},${longitude}&label=${label}`;

      Linking.canOpenURL(url).then((supported) => {
        if (supported) {
          Linking.openURL(url);
        } else {
          // Fallback to Apple Maps
          const appleUrl = `http://maps.apple.com/?q=${latitude},${longitude}&ll=${latitude},${longitude}`;
          Linking.openURL(appleUrl);
        }
      });
    } else {
      // Android - Google Maps
      url = `geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`;

      Linking.canOpenURL(url).then((supported) => {
        if (supported) {
          Linking.openURL(url);
        } else {
          // Fallback to browser
          const webUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
          Linking.openURL(webUrl);
        }
      });
    }
  };

  const callEmergencyServices = () => {
    Alert.alert(
      "Call Emergency Services",
      "Do you want to call emergency services (911)?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Call 911",
          style: "destructive",
          onPress: () => {
            Linking.openURL("tel:911");
          },
        },
      ]
    );
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const formatCoordinates = (lat: number, lng: number) => {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  };

  if (loading) {
    return (
      <ThemedView style={[styles.container, { backgroundColor }]}>
        <ActivityIndicator size="large" color={dangerColor} />
        <ThemedText style={styles.loadingText}>
          Loading emergency information...
        </ThemedText>
      </ThemedView>
    );
  }

  if (!emergencyData) {
    return (
      <ThemedView style={[styles.container, { backgroundColor }]}>
        <MaterialIcons name="error-outline" size={64} color={dangerColor} />
        <ThemedText style={styles.errorText}>
          Unable to load emergency data
        </ThemedText>
        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={() => router.back()}
        >
          <ThemedText style={styles.buttonText}>Go Back</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Emergency Header */}
        <View
          style={[styles.emergencyHeader, { backgroundColor: dangerColor }]}
        >
          <MaterialIcons name="warning" size={48} color="white" />
          <Text style={styles.emergencyTitle}>EMERGENCY ALERT</Text>
          <Text style={styles.emergencySubtitle}>Fall Detected</Text>
        </View>

        {/* Rider Information */}
        <View style={[styles.card, { backgroundColor: cardColor }]}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="person" size={24} color={textColor} />
            <ThemedText style={styles.cardTitle}>Rider Information</ThemedText>
          </View>
          <ThemedText style={styles.riderName}>
            {emergencyData.riderName}
          </ThemedText>
          <ThemedText style={styles.timestamp}>
            Alert Time: {formatTime(emergencyData.timestamp)}
          </ThemedText>
        </View>

        {/* Emergency Message */}
        <View style={[styles.card, { backgroundColor: cardColor }]}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="message" size={24} color={textColor} />
            <ThemedText style={styles.cardTitle}>Emergency Details</ThemedText>
          </View>
          <ThemedText style={styles.emergencyMessage}>
            {emergencyData.message}
          </ThemedText>
        </View>

        {/* Location Information */}
        {emergencyData.latitude && emergencyData.longitude ? (
          <View style={[styles.card, { backgroundColor: cardColor }]}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="location-on" size={24} color={textColor} />
              <ThemedText style={styles.cardTitle}>Location</ThemedText>
            </View>
            <ThemedText style={styles.coordinates}>
              {formatCoordinates(
                emergencyData.latitude,
                emergencyData.longitude
              )}
            </ThemedText>
            <TouchableOpacity
              style={[
                styles.button,
                styles.primaryButton,
                { backgroundColor: primaryColor },
              ]}
              onPress={openInGoogleMaps}
            >
              <MaterialIcons name="map" size={20} color="white" />
              <Text style={styles.buttonTextWhite}>Open in Maps</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: cardColor }]}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="location-off" size={24} color={textColor} />
              <ThemedText style={styles.cardTitle}>Location</ThemedText>
            </View>
            <ThemedText style={styles.noLocation}>
              Location data not available
            </ThemedText>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[
              styles.button,
              styles.emergencyButton,
              { backgroundColor: dangerColor },
            ]}
            onPress={callEmergencyServices}
          >
            <MaterialIcons name="phone" size={20} color="white" />
            <Text style={styles.buttonTextWhite}>Call 911</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.button,
              styles.secondaryButton,
              { borderColor: textColor },
            ]}
            onPress={() => router.back()}
          >
            <ThemedText style={[styles.buttonText, { color: textColor }]}>
              Close
            </ThemedText>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  loadingText: {
    textAlign: "center",
    fontSize: 16,
    marginTop: 20,
  },
  errorText: {
    textAlign: "center",
    fontSize: 16,
    marginTop: 20,
    color: "#dc3545",
  },
  emergencyHeader: {
    alignItems: "center",
    padding: 30,
    borderRadius: 12,
    marginBottom: 20,
  },
  emergencyTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "white",
    marginTop: 10,
    textAlign: "center",
  },
  emergencySubtitle: {
    fontSize: 16,
    color: "white",
    marginTop: 5,
    textAlign: "center",
  },
  card: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 10,
  },
  riderName: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
  },
  timestamp: {
    fontSize: 14,
    opacity: 0.7,
  },
  emergencyMessage: {
    fontSize: 16,
    lineHeight: 24,
  },
  coordinates: {
    fontSize: 16,
    fontFamily: "monospace",
    marginBottom: 15,
  },
  noLocation: {
    fontSize: 16,
    opacity: 0.7,
    fontStyle: "italic",
  },
  actionButtons: {
    marginTop: 20,
    gap: 15,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  primaryButton: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  emergencyButton: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  secondaryButton: {
    borderWidth: 1,
    backgroundColor: "transparent",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  buttonTextWhite: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
});
