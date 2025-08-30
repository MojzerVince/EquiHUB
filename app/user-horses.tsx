import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import * as HorseAPI from "../lib/horseAPI";
import { Horse } from "../lib/supabase";

const UserHorsesScreen = () => {
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { user } = useAuth();
  const { currentTheme } = useTheme();

  const [horses, setHorses] = useState<Horse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);

  const isOwnProfile = user?.id === userId;

  useEffect(() => {
    loadHorses();
    loadUserProfile();
  }, [userId]);

  const loadHorses = async () => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      const horsesData = await HorseAPI.HorseAPI.getHorses(userId);
      setHorses(horsesData || []);
    } catch (error) {
      console.error("Error loading horses:", error);
      setError("Failed to load horses");
    } finally {
      setLoading(false);
    }
  };

  const loadUserProfile = async () => {
    if (!userId) return;

    try {
      // Use direct REST API to get user profile
      const supabaseUrl = "https://grdsqxwghajehneksxik.supabase.co";
      const apiKey =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyZHNxeHdnaGFqZWhuZWtzeGlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQyMzIwMDUsImV4cCI6MjA2OTgwODAwNX0.PL2kAvrRGZbjnJcvKXMLVAaIF-ZfOWBOvzoPNVr9Fms";

      const response = await fetch(
        `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=name,profile_image_url`,
        {
          headers: {
            apikey: apiKey,
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        const profiles = await response.json();
        if (profiles && profiles.length > 0) {
          setUserProfile(profiles[0]);
        }
      }
    } catch (error) {
      console.error("Error loading user profile:", error);
    }
  };

  const renderHorseItem = ({ item }: { item: Horse }) => (
    <View
      style={[
        styles.horseCard,
        { backgroundColor: currentTheme.colors.surface },
      ]}
    >
      <Image
        source={{
          uri:
            item.image_url ||
            "https://via.placeholder.com/150x150/cccccc/666666?text=Horse",
        }}
        style={styles.horseImage}
      />
      <View style={styles.horseInfo}>
        <Text style={[styles.horseName, { color: currentTheme.colors.text }]}>
          {item.name}
        </Text>
        <Text
          style={[
            styles.horseBreed,
            { color: currentTheme.colors.textSecondary },
          ]}
        >
          {item.breed}
        </Text>
        <Text
          style={[
            styles.horseDetails,
            { color: currentTheme.colors.textSecondary },
          ]}
        >
          {item.gender} • {item.height}cm
        </Text>
        {item.weight && (
          <Text
            style={[
              styles.horseDetails,
              { color: currentTheme.colors.textSecondary },
            ]}
          >
            {item.weight}kg
          </Text>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView
        style={[
          styles.container,
          { backgroundColor: currentTheme.colors.background },
        ]}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Text
              style={[
                styles.backButtonText,
                { color: currentTheme.colors.primary },
              ]}
            >
              ← Back
            </Text>
          </TouchableOpacity>
          <Text
            style={[styles.headerTitle, { color: currentTheme.colors.text }]}
          >
            Horses
          </Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={currentTheme.colors.primary} />
          <Text
            style={[
              styles.loadingText,
              { color: currentTheme.colors.textSecondary },
            ]}
          >
            Loading horses...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: currentTheme.colors.background },
      ]}
    >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text
            style={[
              styles.backButtonText,
              { color: currentTheme.colors.primary },
            ]}
          >
            ← Back
          </Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: currentTheme.colors.text }]}>
          {`${userProfile?.name || "User"}'s Horses`}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {error ? (
        <View style={styles.centered}>
          <Text
            style={[styles.errorText, { color: currentTheme.colors.error }]}
          >
            {error}
          </Text>
          <TouchableOpacity onPress={loadHorses} style={styles.retryButton}>
            <Text
              style={[
                styles.retryButtonText,
                { color: currentTheme.colors.primary },
              ]}
            >
              Retry
            </Text>
          </TouchableOpacity>
        </View>
      ) : horses.length === 0 ? (
        <View style={styles.centered}>
          <Text
            style={[
              styles.emptyText,
              { color: currentTheme.colors.textSecondary },
            ]}
          >
            {`${userProfile?.name || "This user"} doesn't have any horses yet`}
          </Text>
        </View>
      ) : (
        <FlatList
          data={horses}
          renderItem={renderHorseItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  backButton: {
    padding: 5,
  },
  backButtonText: {
    fontSize: 16,
    fontFamily: "Inder",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    fontFamily: "Inder",
    textAlign: "center",
  },
  headerSpacer: {
    width: 50,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    fontFamily: "Inder",
  },
  errorText: {
    fontSize: 16,
    fontFamily: "Inder",
    textAlign: "center",
    marginBottom: 20,
  },
  retryButton: {
    padding: 10,
  },
  retryButtonText: {
    fontSize: 16,
    fontFamily: "Inder",
  },
  emptyText: {
    fontSize: 16,
    fontFamily: "Inder",
    textAlign: "center",
  },
  listContainer: {
    padding: 20,
  },
  horseCard: {
    flexDirection: "row",
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  horseImage: {
    width: 80,
    height: 80,
    borderRadius: 10,
    marginRight: 15,
  },
  horseInfo: {
    flex: 1,
    justifyContent: "center",
  },
  horseName: {
    fontSize: 18,
    fontWeight: "bold",
    fontFamily: "Inder",
    marginBottom: 5,
  },
  horseBreed: {
    fontSize: 14,
    fontFamily: "Inder",
    marginBottom: 3,
  },
  horseDetails: {
    fontSize: 12,
    fontFamily: "Inder",
    marginBottom: 2,
  },
});

export default UserHorsesScreen;
