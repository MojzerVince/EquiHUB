import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  Alert,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../contexts/ThemeContext";
import { useTracking } from "../contexts/TrackingContext";
import { useAuth } from "../contexts/AuthContext";
import { useRouter } from "expo-router";
import { ProfileAPIBase64 } from "../lib/profileAPIBase64";

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
  name?: string;
}

const SessionsScreen = () => {
  const { currentTheme } = useTheme();
  const { sessions, deleteSessions } = useTracking();
  const { user } = useAuth();
  const router = useRouter();
  const [isProMember, setIsProMember] = useState(false);

  const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000; // One week in milliseconds

  // Load user profile to check PRO status
  useEffect(() => {
    const loadProfile = async () => {
      if (user?.id) {
        try {
          const profile = await ProfileAPIBase64.getProfile(user.id);
          if (profile) {
            setIsProMember(profile.is_pro_member || false);
          }
        } catch (error) {
          console.error("Error loading profile:", error);
        }
      }
    };

    loadProfile();
  }, [user]);

  const isSessionAccessible = (session: TrackingSession): boolean => {
    if (!isProMember) {
      const oneWeekAgo = Date.now() - ONE_WEEK_MS;
      return session.startTime >= oneWeekAgo;
    }
    return true; // PRO members can access all sessions
  };

  const filteredSessions = sessions.filter(isSessionAccessible);
  const restrictedSessions = sessions.filter(
    (session) => !isSessionAccessible(session)
  );

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const calculateAverageSpeed = (
    distance: number,
    duration: number
  ): number => {
    if (duration === 0) return 0;
    const hours = duration / (1000 * 60 * 60);
    return distance / hours;
  };

  const handleDeleteSession = (sessionId: string, sessionName?: string) => {
    Alert.alert(
      "Delete Session",
      `Are you sure you want to delete "${sessionName || "this session"}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteSessions(sessionId),
        },
      ]
    );
  };

  const renderSession = ({ item }: { item: TrackingSession }) => (
    <View style={styles.sessionCard}>
      <View style={styles.sessionHeader}>
        <Text style={[styles.sessionName, { color: currentTheme.colors.text }]}>
          {item.name || `Ride ${new Date(item.startTime).toLocaleDateString()}`}
        </Text>
        <TouchableOpacity
          onPress={() => handleDeleteSession(item.id, item.name)}
          style={styles.deleteButton}
        >
          <Text style={styles.deleteButtonText}>🗑️</Text>
        </TouchableOpacity>
      </View>

      <Text
        style={[
          styles.sessionDate,
          { color: currentTheme.colors.textSecondary },
        ]}
      >
        {new Date(item.startTime).toLocaleString()}
      </Text>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: currentTheme.colors.text }]}>
            {item.distance.toFixed(2)} km
          </Text>
          <Text
            style={[
              styles.statLabel,
              { color: currentTheme.colors.textSecondary },
            ]}
          >
            Distance
          </Text>
        </View>

        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: currentTheme.colors.text }]}>
            {formatDuration(item.duration)}
          </Text>
          <Text
            style={[
              styles.statLabel,
              { color: currentTheme.colors.textSecondary },
            ]}
          >
            Duration
          </Text>
        </View>

        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: currentTheme.colors.text }]}>
            {calculateAverageSpeed(item.distance, item.duration).toFixed(1)}{" "}
            km/h
          </Text>
          <Text
            style={[
              styles.statLabel,
              { color: currentTheme.colors.textSecondary },
            ]}
          >
            Avg Speed
          </Text>
        </View>
      </View>
    </View>
  );

  const renderRestrictedSessionsMessage = () => {
    if (isProMember || restrictedSessions.length === 0) return null;

    return (
      <View style={styles.restrictedContainer}>
        <Text
          style={[styles.restrictedTitle, { color: currentTheme.colors.text }]}
        >
          ⭐ Upgrade to PRO
        </Text>
        <Text
          style={[
            styles.restrictedText,
            { color: currentTheme.colors.textSecondary },
          ]}
        >
          {restrictedSessions.length} older ride
          {restrictedSessions.length !== 1 ? "s" : ""} available with PRO
          membership
        </Text>
        <Text
          style={[
            styles.restrictedSubtext,
            { color: currentTheme.colors.textSecondary },
          ]}
        >
          Access rides older than one week with PRO
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.headerContainer}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              console.log("Back button pressed");
              router.push("/(tabs)/map");
            }}
            activeOpacity={0.7}
          >
            <Image
              source={require("../assets/UI_resources/UI_white/arrow_white.png")}
              style={styles.backButtonImage}
            />
          </TouchableOpacity>
          <Text style={styles.header}>Ride History</Text>
        </View>
      </SafeAreaView>

      <View style={styles.content}>
        {filteredSessions.length === 0 && restrictedSessions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text
              style={[
                styles.emptyText,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              🚀
            </Text>
            <Text
              style={[
                styles.emptySubtext,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              No rides yet
            </Text>
            <Text
              style={[
                styles.emptyDescription,
                { color: currentTheme.colors.text },
              ]}
            >
              Start tracking your rides to see them here!
            </Text>
          </View>
        ) : (
          <>
            <FlatList
              data={filteredSessions.sort(
                (a: TrackingSession, b: TrackingSession) =>
                  b.startTime - a.startTime
              )}
              renderItem={renderSession}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContainer}
              showsVerticalScrollIndicator={false}
            />
            {renderRestrictedSessionsMessage()}
          </>
        )}
      </View>
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
    paddingVertical: 10,
    height: 60,
  },
  header: {
    fontSize: 30,
    fontFamily: "Inder",
    color: "#fff",
    textAlign: "center",
    flex: 1,
    fontWeight: "600",
  },
  content: {
    backgroundColor: "#FFFFFF",
    flex: 1,
    borderTopLeftRadius: 50,
    borderTopRightRadius: 50,
    marginTop: 5,
    paddingTop: 50,
  },
  listContainer: {
    padding: 20,
  },
  sessionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
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
  sessionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 5,
  },
  sessionName: {
    fontSize: 18,
    fontFamily: "Inder",
    fontWeight: "600",
    flex: 1,
  },
  deleteButton: {
    padding: 5,
  },
  deleteButtonText: {
    fontSize: 18,
  },
  sessionDate: {
    fontSize: 14,
    fontFamily: "Inder",
    marginBottom: 15,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 16,
    fontFamily: "Inder",
    fontWeight: "600",
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: "Inder",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 48,
    marginBottom: 10,
  },
  emptySubtext: {
    fontSize: 24,
    fontFamily: "Inder",
    fontWeight: "600",
    marginBottom: 10,
  },
  emptyDescription: {
    fontSize: 16,
    fontFamily: "Inder",
    textAlign: "center",
  },
  restrictedContainer: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  restrictedTitle: {
    fontSize: 18,
    fontFamily: "Inder",
    fontWeight: "600",
    marginBottom: 8,
  },
  restrictedText: {
    fontSize: 14,
    fontFamily: "Inder",
    textAlign: "center",
    marginBottom: 4,
  },
  restrictedSubtext: {
    fontSize: 12,
    fontFamily: "Inder",
    textAlign: "center",
  },
  backButton: {
    position: "absolute",
    left: 20,
    justifyContent: "center",
    alignItems: "center",
    width: 40,
    height: 40,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    borderRadius: 20,
    zIndex: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.5)",
  },
  backButtonText: {
    fontSize: 28,
    color: "#FFFFFF",
    fontWeight: "600",
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  backButtonImage: {
    width: 20,
    height: 20,
    tintColor: "#FFFFFF",
  },
});

export default SessionsScreen;
