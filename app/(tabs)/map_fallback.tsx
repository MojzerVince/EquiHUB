import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../contexts/ThemeContext";

interface Location {
  latitude: number;
  longitude: number;
  timestamp: number;
}

interface TrackingSession {
  id: string;
  startTime: number;
  endTime?: number;
  locations: Location[];
  distance: number;
  duration: number;
}

const MapScreen = () => {
  const { currentTheme } = useTheme();

  // State management
  const [isTracking, setIsTracking] = useState(false);
  const [distance, setDistance] = useState(0);
  const [duration, setDuration] = useState(0);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);

  // Update duration every second when tracking
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isTracking && sessionStartTime) {
      interval = setInterval(() => {
        setDuration(Date.now() - sessionStartTime);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTracking, sessionStartTime]);

  const startTracking = () => {
    setIsTracking(true);
    setSessionStartTime(Date.now());
    setDistance(0);
    setDuration(0);

    // Simulate distance tracking for demo
    const distanceInterval = setInterval(() => {
      if (isTracking) {
        setDistance((prev) => prev + Math.random() * 0.1);
      } else {
        clearInterval(distanceInterval);
      }
    }, 5000);

    Alert.alert(
      "Tracking Started!",
      "Your ride tracking has begun. Install react-native-maps and expo-location for full map functionality."
    );
  };

  const stopTracking = () => {
    if (sessionStartTime) {
      const finalDuration = Date.now() - sessionStartTime;

      Alert.alert(
        "Ride Completed!",
        `Distance: ${distance.toFixed(2)} km\nDuration: ${formatDuration(
          finalDuration
        )}`,
        [
          { text: "Save Session", onPress: () => saveSession() },
          { text: "Discard", style: "destructive" },
        ]
      );
    }

    setIsTracking(false);
    setSessionStartTime(null);
  };

  const saveSession = () => {
    Alert.alert("Success", "Ride session saved successfully!");
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

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
          <Text style={styles.header}>Map & Tracking</Text>
        </View>
      </SafeAreaView>

      <View
        style={[
          styles.mapContainer,
          { backgroundColor: currentTheme.colors.surface },
        ]}
      >
        {/* Placeholder map */}
        <View
          style={[
            styles.mapPlaceholder,
            { backgroundColor: currentTheme.colors.background },
          ]}
        >
          <Text
            style={[
              styles.mapPlaceholderText,
              { color: currentTheme.colors.textSecondary },
            ]}
          >
            🗺️
          </Text>
          <Text
            style={[
              styles.mapPlaceholderSubtext,
              { color: currentTheme.colors.textSecondary },
            ]}
          >
            Map will appear here
          </Text>
          <Text
            style={[styles.installText, { color: currentTheme.colors.text }]}
          >
            Install react-native-maps and expo-location for full functionality
          </Text>
        </View>

        {/* Tracking stats overlay */}
        {isTracking && (
          <View
            style={[
              styles.statsContainer,
              { backgroundColor: currentTheme.colors.background },
            ]}
          >
            <View style={styles.statRow}>
              <Text
                style={[
                  styles.statLabel,
                  { color: currentTheme.colors.textSecondary },
                ]}
              >
                Distance:
              </Text>
              <Text
                style={[styles.statValue, { color: currentTheme.colors.text }]}
              >
                {distance.toFixed(2)} km
              </Text>
            </View>
            <View style={styles.statRow}>
              <Text
                style={[
                  styles.statLabel,
                  { color: currentTheme.colors.textSecondary },
                ]}
              >
                Duration:
              </Text>
              <Text
                style={[styles.statValue, { color: currentTheme.colors.text }]}
              >
                {formatDuration(duration)}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Action buttons */}
      <View
        style={[
          styles.actionContainer,
          { backgroundColor: currentTheme.colors.background },
        ]}
      >
        {!isTracking ? (
          <TouchableOpacity
            style={[
              styles.startButton,
              { backgroundColor: currentTheme.colors.accent },
            ]}
            onPress={startTracking}
          >
            <Text style={styles.startButtonText}>Start Tracking</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.stopButton, { backgroundColor: "#FF6B6B" }]}
            onPress={stopTracking}
          >
            <Text style={styles.stopButtonText}>Stop Tracking</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    paddingBottom: 0,
  },
  headerContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: "center",
    marginBottom: -45,
  },
  header: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFFFFF",
    fontFamily: "Inder",
    textAlign: "center",
  },
  mapContainer: {
    flex: 1,
    position: "relative",
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    margin: 20,
    borderRadius: 10,
    padding: 40,
  },
  mapPlaceholderText: {
    fontSize: 48,
    marginBottom: 10,
  },
  mapPlaceholderSubtext: {
    fontSize: 18,
    fontFamily: "Inder",
    marginBottom: 20,
  },
  installText: {
    fontSize: 14,
    fontFamily: "Inder",
    textAlign: "center",
    fontStyle: "italic",
  },
  statsContainer: {
    position: "absolute",
    top: 20,
    left: 20,
    padding: 15,
    borderRadius: 10,
    elevation: 5,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    minWidth: 150,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 14,
    fontFamily: "Inder",
    fontWeight: "500",
  },
  statValue: {
    fontSize: 14,
    fontFamily: "Inder",
    fontWeight: "bold",
  },
  actionContainer: {
    padding: 20,
    paddingBottom: 30,
  },
  startButton: {
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    alignItems: "center",
    elevation: 3,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  startButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
    fontFamily: "Inder",
  },
  stopButton: {
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    alignItems: "center",
    elevation: 3,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  stopButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
    fontFamily: "Inder",
  },
});

export default MapScreen;
