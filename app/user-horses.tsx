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
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Text style={styles.backIcon}>←</Text>
            </TouchableOpacity>
            <Text style={[styles.header, { color: "#FFFFFF" }]}>Horses</Text>
            <View style={styles.headerSpacer} />
          </View>
        </SafeAreaView>
        <View
          style={[
            styles.viewPort,
            { backgroundColor: currentTheme.colors.surface },
          ]}
        >
          <View style={styles.centered}>
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
              Loading horses...
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
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={[styles.header, { color: "#FFFFFF" }]}>
            {`${userProfile?.name || "User"}'s Horses`}
          </Text>
          <View style={styles.headerSpacer} />
        </View>
      </SafeAreaView>

      <View
        style={[
          styles.viewPort,
          { backgroundColor: currentTheme.colors.surface },
        ]}
      >
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
              {`${
                userProfile?.name || "This user"
              } doesn't have any horses yet`}
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
  backButton: {
    position: "absolute",
    left: 20,
    padding: 5,
  },
  backIcon: {
    fontSize: 24,
    color: "#fff",
  },
  headerSpacer: {
    width: 50,
  },
  viewPort: {
    backgroundColor: "#FFFFFF",
    flex: 1,
    borderTopLeftRadius: 50,
    borderTopRightRadius: 50,
    marginTop: 5,
    paddingTop: 20,
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
