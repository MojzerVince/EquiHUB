import StableSelection from "@/components/StableSelection";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../contexts/AuthContext";
import { useDialog } from "../contexts/DialogContext";
import { useTheme } from "../contexts/ThemeContext";
import { StableAPI, StableWithMemberInfo } from "../lib/stableAPI";

const StableScreen = () => {
  const router = useRouter();
  const { user } = useAuth();
  const { currentTheme } = useTheme();
  const { showError, showConfirm } = useDialog();

  const [userStables, setUserStables] = useState<StableWithMemberInfo[]>([]);
  const [popularStables, setPopularStables] = useState<StableWithMemberInfo[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showStableSelection, setShowStableSelection] = useState(false);

  useEffect(() => {
    if (user) {
      loadStableData();
    }
  }, [user]);

  const loadStableData = async () => {
    if (!user) return;

    try {
      // Load user's stables and popular stables in parallel
      const [userStablesResult, popularStablesResult] = await Promise.all([
        StableAPI.getUserStables(),
        StableAPI.getPopularStables(10),
      ]);

      if (userStablesResult.error) {
        showError(userStablesResult.error);
      } else {
        setUserStables(userStablesResult.stables);
      }

      if (popularStablesResult.error) {
        console.error(
          "Error loading popular stables:",
          popularStablesResult.error
        );
      } else {
        // Filter out stables the user is already a member of
        const filteredPopular = popularStablesResult.stables.filter(
          (stable) =>
            !userStablesResult.stables.some(
              (userStable) => userStable.id === stable.id
            )
        );
        setPopularStables(filteredPopular);
      }
    } catch (error) {
      console.error("Error loading stable data:", error);
      showError("Failed to load stable information");
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStableData();
    setRefreshing(false);
  };

  const handleJoinStable = async (
    stable: StableWithMemberInfo | null,
    joinCode?: string
  ) => {
    if (!stable && !joinCode) return;

    try {
      let result;
      if (joinCode) {
        result = await StableAPI.joinStableByCode(joinCode);
      } else if (stable) {
        result = await StableAPI.joinStable(stable.id);
      } else {
        return;
      }

      if (result.success) {
        showConfirm(
          "Success!",
          `You have successfully joined ${stable?.name || "the stable"}!`,
          () => {
            loadStableData(); // Refresh the data
          }
        );
      } else {
        showError(result.error || "Failed to join stable");
      }
    } catch (error) {
      showError("Failed to join stable");
    }
  };

  const handleLeaveStable = (stable: StableWithMemberInfo) => {
    if (stable.user_role === "owner") {
      showError(
        "Stable owners cannot leave their stable. Please transfer ownership first."
      );
      return;
    }

    showConfirm(
      "Leave Stable",
      `Are you sure you want to leave ${stable.name}? You can rejoin later if it's a public stable.`,
      async () => {
        try {
          const { success, error } = await StableAPI.leaveStable(stable.id);
          if (success) {
            showConfirm("Left Stable", `You have left ${stable.name}.`);
            loadStableData(); // Refresh the data
          } else {
            showError(error || "Failed to leave stable");
          }
        } catch (error) {
          showError("Failed to leave stable");
        }
      }
    );
  };

  const renderUserStable = ({ item }: { item: StableWithMemberInfo }) => (
    <View
      style={[
        styles.stableCard,
        { backgroundColor: currentTheme.colors.surface },
      ]}
    >
      <View style={styles.stableHeader}>
        <View style={styles.stableInfo}>
          <Text
            style={[styles.stableName, { color: currentTheme.colors.text }]}
          >
            {item.name}
          </Text>
          <Text
            style={[
              styles.stableLocation,
              { color: currentTheme.colors.textSecondary },
            ]}
          >
            {item.city && item.state_province
              ? `${item.city}, ${item.state_province}`
              : item.location || "Location not specified"}
          </Text>
          <View style={styles.roleContainer}>
            <Text
              style={[styles.roleText, { color: currentTheme.colors.primary }]}
            >
              {item.user_role?.toUpperCase()}
            </Text>
            <Text
              style={[
                styles.memberCount,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              • {item.member_count} member{item.member_count !== 1 ? "s" : ""}
            </Text>
          </View>
        </View>
        <View style={styles.stableActions}>
          {item.user_role !== "owner" && (
            <TouchableOpacity
              style={[
                styles.leaveButton,
                { borderColor: currentTheme.colors.error },
              ]}
              onPress={() => handleLeaveStable(item)}
            >
              <Text
                style={[
                  styles.leaveButtonText,
                  { color: currentTheme.colors.error },
                ]}
              >
                Leave
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {item.description && (
        <Text
          style={[
            styles.stableDescription,
            { color: currentTheme.colors.textSecondary },
          ]}
        >
          {item.description}
        </Text>
      )}

      {item.specialties && item.specialties.length > 0 && (
        <View style={styles.specialtiesContainer}>
          {item.specialties.slice(0, 3).map((specialty, index) => (
            <View
              key={index}
              style={[
                styles.specialtyTag,
                { backgroundColor: currentTheme.colors.primary },
              ]}
            >
              <Text style={styles.specialtyText}>{specialty}</Text>
            </View>
          ))}
          {item.specialties.length > 3 && (
            <Text
              style={[
                styles.moreSpecialties,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              +{item.specialties.length - 3} more
            </Text>
          )}
        </View>
      )}

      {item.join_code && (
        <View style={styles.joinCodeContainer}>
          <Text
            style={[
              styles.joinCodeLabel,
              { color: currentTheme.colors.textSecondary },
            ]}
          >
            Join Code:
          </Text>
          <Text
            style={[
              styles.joinCodeText,
              { color: currentTheme.colors.primary },
            ]}
          >
            {item.join_code}
          </Text>
        </View>
      )}
    </View>
  );

  const renderPopularStable = ({ item }: { item: StableWithMemberInfo }) => (
    <TouchableOpacity
      style={[
        styles.popularStableCard,
        { backgroundColor: currentTheme.colors.surface },
      ]}
      onPress={() => handleJoinStable(item)}
      activeOpacity={0.7}
    >
      <Text
        style={[styles.popularStableName, { color: currentTheme.colors.text }]}
      >
        {item.name}
      </Text>
      <Text
        style={[
          styles.popularStableLocation,
          { color: currentTheme.colors.textSecondary },
        ]}
      >
        {item.city && item.state_province
          ? `${item.city}, ${item.state_province}`
          : item.location || "Location not specified"}
      </Text>
      <Text
        style={[
          styles.popularStableMembers,
          { color: currentTheme.colors.textSecondary },
        ]}
      >
        {item.member_count} member{item.member_count !== 1 ? "s" : ""}
      </Text>
      <View
        style={[
          styles.joinButton,
          { backgroundColor: currentTheme.colors.primary },
        ]}
      >
        <Text style={styles.joinButtonText}>Join</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView
        style={[
          styles.container,
          { backgroundColor: currentTheme.colors.primary },
        ]}
      >
        <View style={styles.headerContainer}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.header}>Stables</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View
          style={[
            styles.loadingContainer,
            { backgroundColor: currentTheme.colors.background },
          ]}
        >
          <ActivityIndicator size="large" color={currentTheme.colors.primary} />
          <Text
            style={[
              styles.loadingText,
              { color: currentTheme.colors.textSecondary },
            ]}
          >
            Loading stables...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: currentTheme.colors.primary },
      ]}
    >
      <View style={styles.headerContainer}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.header}>Stables</Text>
        <TouchableOpacity
          onPress={() => setShowStableSelection(true)}
          style={styles.addButton}
        >
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={[
          styles.content,
          { backgroundColor: currentTheme.colors.background },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[currentTheme.colors.primary]}
            tintColor={currentTheme.colors.primary}
          />
        }
      >
        {/* User's Stables */}
        <View style={styles.section}>
          <Text
            style={[styles.sectionTitle, { color: currentTheme.colors.text }]}
          >
            My Stables
          </Text>
          {userStables.length > 0 ? (
            <FlatList
              data={userStables}
              renderItem={renderUserStable}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <View style={styles.emptyContainer}>
              <Text
                style={[
                  styles.emptyText,
                  { color: currentTheme.colors.textSecondary },
                ]}
              >
                You haven't joined any stables yet
              </Text>
              <TouchableOpacity
                style={[
                  styles.joinFirstButton,
                  { backgroundColor: currentTheme.colors.primary },
                ]}
                onPress={() => setShowStableSelection(true)}
              >
                <Text style={styles.joinFirstButtonText}>Find a Stable</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Popular Stables */}
        {popularStables.length > 0 && (
          <View style={styles.section}>
            <Text
              style={[styles.sectionTitle, { color: currentTheme.colors.text }]}
            >
              Popular Stables
            </Text>
            <FlatList
              data={popularStables}
              renderItem={renderPopularStable}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            />
          </View>
        )}
      </ScrollView>

      {/* Stable Selection Modal */}
      <StableSelection
        visible={showStableSelection}
        onClose={() => setShowStableSelection(false)}
        onSelect={handleJoinStable}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  backButtonText: {
    fontSize: 24,
    color: "#fff",
    fontWeight: "bold",
  },
  header: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    fontFamily: "Inder",
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  addButtonText: {
    fontSize: 24,
    color: "#fff",
    fontWeight: "bold",
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontFamily: "Inder",
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    fontFamily: "Inder",
    marginBottom: 16,
  },
  stableCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  stableHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  stableInfo: {
    flex: 1,
  },
  stableName: {
    fontSize: 18,
    fontWeight: "bold",
    fontFamily: "Inder",
    marginBottom: 4,
  },
  stableLocation: {
    fontSize: 14,
    fontFamily: "Inder",
    marginBottom: 6,
  },
  roleContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  roleText: {
    fontSize: 12,
    fontWeight: "bold",
    fontFamily: "Inder",
  },
  memberCount: {
    fontSize: 12,
    fontFamily: "Inder",
    marginLeft: 4,
  },
  stableActions: {
    alignItems: "flex-end",
  },
  leaveButton: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  leaveButtonText: {
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Inder",
  },
  stableDescription: {
    fontSize: 14,
    fontFamily: "Inder",
    lineHeight: 20,
    marginBottom: 12,
  },
  specialtiesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    marginBottom: 8,
  },
  specialtyTag: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 6,
    marginBottom: 4,
  },
  specialtyText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#fff",
    fontFamily: "Inder",
  },
  moreSpecialties: {
    fontSize: 10,
    fontFamily: "Inder",
    marginLeft: 4,
  },
  joinCodeContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  joinCodeLabel: {
    fontSize: 12,
    fontFamily: "Inder",
    marginRight: 8,
  },
  joinCodeText: {
    fontSize: 12,
    fontWeight: "bold",
    fontFamily: "Inder",
  },
  popularStableCard: {
    width: 200,
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  popularStableName: {
    fontSize: 16,
    fontWeight: "bold",
    fontFamily: "Inder",
    marginBottom: 4,
  },
  popularStableLocation: {
    fontSize: 12,
    fontFamily: "Inder",
    marginBottom: 4,
  },
  popularStableMembers: {
    fontSize: 11,
    fontFamily: "Inder",
    marginBottom: 12,
  },
  joinButton: {
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
  },
  joinButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inder",
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: "Inder",
    textAlign: "center",
    marginBottom: 20,
  },
  joinFirstButton: {
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  joinFirstButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inder",
  },
  horizontalList: {
    paddingRight: 20,
  },
});

export default StableScreen;
