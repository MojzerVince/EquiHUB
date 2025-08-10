import React from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../contexts/ThemeContext";
import { useTracking } from "../contexts/TrackingContext";

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

  const calculateAverageSpeed = (distance: number, duration: number): number => {
    if (duration === 0) return 0;
    const hours = duration / (1000 * 60 * 60);
    return distance / hours;
  };

  const handleDeleteSession = (sessionId: string, sessionName?: string) => {
    Alert.alert(
      'Delete Session',
      `Are you sure you want to delete "${sessionName || 'this session'}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => deleteSessions(sessionId)
        },
      ]
    );
  };

  const renderSession = ({ item }: { item: TrackingSession }) => (
    <View
      style={[
        styles.sessionCard,
        { backgroundColor: currentTheme.colors.background },
      ]}
    >
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
      
      <Text style={[styles.sessionDate, { color: currentTheme.colors.textSecondary }]}>
        {new Date(item.startTime).toLocaleString()}
      </Text>
      
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: currentTheme.colors.text }]}>
            {item.distance.toFixed(2)} km
          </Text>
          <Text style={[styles.statLabel, { color: currentTheme.colors.textSecondary }]}>
            Distance
          </Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: currentTheme.colors.text }]}>
            {formatDuration(item.duration)}
          </Text>
          <Text style={[styles.statLabel, { color: currentTheme.colors.textSecondary }]}>
            Duration
          </Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: currentTheme.colors.text }]}>
            {calculateAverageSpeed(item.distance, item.duration).toFixed(1)} km/h
          </Text>
          <Text style={[styles.statLabel, { color: currentTheme.colors.textSecondary }]}>
            Avg Speed
          </Text>
        </View>
      </View>
    </View>
  );

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
          <Text style={styles.header}>Ride History</Text>
        </View>
      </SafeAreaView>

      <View
        style={[
          styles.content,
          { backgroundColor: currentTheme.colors.surface },
        ]}
      >
        {sessions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: currentTheme.colors.textSecondary }]}>
              🚀
            </Text>
            <Text style={[styles.emptySubtext, { color: currentTheme.colors.textSecondary }]}>
              No rides yet
            </Text>
            <Text style={[styles.emptyDescription, { color: currentTheme.colors.text }]}>
              Start tracking your rides to see them here!
            </Text>
          </View>
        ) : (
          <FlatList
            data={sessions.sort((a: TrackingSession, b: TrackingSession) => b.startTime - a.startTime)}
            renderItem={renderSession}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
          />
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
  content: {
    flex: 1,
    paddingTop: 50,
  },
  listContainer: {
    padding: 20,
  },
  sessionCard: {
    padding: 20,
    borderRadius: 15,
    marginBottom: 15,
    elevation: 3,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  sessionName: {
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: "Inder",
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
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: "Inder",
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: "Inder",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 48,
    marginBottom: 10,
  },
  emptySubtext: {
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: "Inder",
    marginBottom: 10,
  },
  emptyDescription: {
    fontSize: 16,
    fontFamily: "Inder",
    textAlign: 'center',
  },
});

export default SessionsScreen;
