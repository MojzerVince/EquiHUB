import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Stable, StableAPI } from "../lib/stableAPI";

interface StableSelectionProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (stable: Stable | null, joinCode?: string) => void;
  selectedStable?: Stable | null;
}

const StableSelection: React.FC<StableSelectionProps> = ({
  visible,
  onClose,
  onSelect,
  selectedStable,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [stables, setStables] = useState<Stable[]>([]);
  const [popularStables, setPopularStables] = useState<Stable[]>(
    []
  );
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"popular" | "search" | "code">(
    "popular"
  );

  useEffect(() => {
    if (visible) {
      loadPopularStables();
    }
  }, [visible]);

  const loadPopularStables = async () => {
    setLoading(true);
    try {
      const { stables: popularList, error } = await StableAPI.getPopularStables(
        20
      );
      if (error) {
        Alert.alert("Error", error);
      } else {
        setPopularStables(popularList);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to load popular stables");
    } finally {
      setLoading(false);
    }
  };

  const searchStables = async () => {
    if (!searchQuery.trim()) {
      setStables([]);
      return;
    }

    setSearchLoading(true);
    try {
      const { stables: searchResults, error } = await StableAPI.searchStables(
        searchQuery.trim(),
        undefined,
        undefined,
        undefined,
        20,
        0
      );
      if (error) {
        Alert.alert("Error", error);
      } else {
        setStables(searchResults);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to search stables");
    } finally {
      setSearchLoading(false);
    }
  };

  const handleJoinByCode = async () => {
    if (!joinCode.trim()) {
      Alert.alert("Error", "Please enter a join code");
      return;
    }

    setLoading(true);
    try {
      const { stable, error } = await StableAPI.getStableByJoinCode(
        joinCode.trim()
      );
      if (error || !stable) {
        Alert.alert("Error", error || "Stable not found with that join code");
      } else {
        onSelect(stable, joinCode.trim());
        onClose();
      }
    } catch (error) {
      Alert.alert("Error", "Failed to find stable with that join code");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectStable = (stable: Stable) => {
    onSelect(stable);
    onClose();
  };

  const handleSkip = () => {
    onSelect(null);
    onClose();
  };

  const renderStableItem = ({ item }: { item: Stable }) => (
    <TouchableOpacity
      style={styles.stableItem}
      onPress={() => handleSelectStable(item)}
      activeOpacity={0.7}
    >
      <View style={styles.stableInfo}>
        <Text style={styles.stableName}>{item.name}</Text>
        <Text style={styles.stableLocation}>
          {item.city && item.state_province
            ? `${item.city}, ${item.state_province}`
            : item.location || "Location not specified"}
        </Text>
        <View style={styles.stableStats}>
        </View>
        {item.join_code && (
          <Text style={styles.joinCode}>Code: {item.join_code}</Text>
        )}
      </View>
      <View style={styles.selectButton}>
        <Text style={styles.selectButtonText}>Select</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Choose a Stable</Text>
          <Text style={styles.subtitle}>
            Join an existing stable or skip to join one later
          </Text>
        </View>

        {/* Tab Selection */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === "popular" && styles.activeTab]}
            onPress={() => setActiveTab("popular")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "popular" && styles.activeTabText,
              ]}
            >
              Popular
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === "search" && styles.activeTab]}
            onPress={() => setActiveTab("search")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "search" && styles.activeTabText,
              ]}
            >
              Search
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === "code" && styles.activeTab]}
            onPress={() => setActiveTab("code")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "code" && styles.activeTabText,
              ]}
            >
              Join Code
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {activeTab === "popular" && (
            <View style={styles.tabContent}>
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#335C67" />
                  <Text style={styles.loadingText}>
                    Loading popular stables...
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={popularStables}
                  renderItem={renderStableItem}
                  keyExtractor={(item) => item.id}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.listContainer}
                  ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                      <Text style={styles.emptyText}>No stables found</Text>
                    </View>
                  }
                />
              )}
            </View>
          )}

          {activeTab === "search" && (
            <View style={styles.tabContent}>
              <View style={styles.searchContainer}>
                <TextInput
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search by name, location, or specialty..."
                  placeholderTextColor="#999"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={styles.searchButton}
                  onPress={searchStables}
                  disabled={searchLoading}
                >
                  {searchLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.searchButtonText}>Search</Text>
                  )}
                </TouchableOpacity>
              </View>

              <FlatList
                data={stables}
                renderItem={renderStableItem}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listContainer}
                ListEmptyComponent={
                  searchQuery.trim() ? (
                    <View style={styles.emptyContainer}>
                      <Text style={styles.emptyText}>
                        {searchLoading ? "Searching..." : "No stables found"}
                      </Text>
                    </View>
                  ) : null
                }
              />
            </View>
          )}

          {activeTab === "code" && (
            <View style={styles.tabContent}>
              <Text style={styles.codeInstructions}>
                If you have a join code from a stable, enter it below:
              </Text>
              <TextInput
                style={styles.codeInput}
                value={joinCode}
                onChangeText={setJoinCode}
                placeholder="Enter join code (e.g., SUNSET)"
                placeholderTextColor="#999"
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={10}
              />
              <TouchableOpacity
                style={[
                  styles.joinButton,
                  !joinCode.trim() && styles.disabledButton,
                ]}
                onPress={handleJoinByCode}
                disabled={!joinCode.trim() || loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.joinButtonText}>Join Stable</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Bottom Actions */}
        <View style={styles.bottomActions}>
          <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
            <Text style={styles.skipButtonText}>Skip for Now</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
    backgroundColor: "#335C67",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    fontFamily: "Inder",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#B8D4DA",
    textAlign: "center",
    marginTop: 8,
    fontFamily: "Inder",
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#F8F9FA",
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: "#335C67",
  },
  tabText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#666",
    fontFamily: "Inder",
  },
  activeTabText: {
    color: "#fff",
  },
  content: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
    padding: 16,
  },
  searchContainer: {
    flexDirection: "row",
    marginBottom: 16,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontFamily: "Inder",
    backgroundColor: "#f9f9f9",
  },
  searchButton: {
    backgroundColor: "#335C67",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: "center",
    minWidth: 80,
  },
  searchButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
    fontFamily: "Inder",
    textAlign: "center",
  },
  codeInstructions: {
    fontSize: 16,
    color: "#666",
    marginBottom: 16,
    textAlign: "center",
    fontFamily: "Inder",
  },
  codeInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 18,
    fontFamily: "Inder",
    backgroundColor: "#f9f9f9",
    textAlign: "center",
    marginBottom: 20,
  },
  joinButton: {
    backgroundColor: "#335C67",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  joinButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "Inder",
  },
  disabledButton: {
    backgroundColor: "#ccc",
  },
  listContainer: {
    paddingBottom: 20,
  },
  stableItem: {
    flexDirection: "row",
    backgroundColor: "#f9f9f9",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  stableInfo: {
    flex: 1,
  },
  stableName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    fontFamily: "Inder",
    marginBottom: 4,
  },
  stableLocation: {
    fontSize: 14,
    color: "#666",
    fontFamily: "Inder",
    marginBottom: 4,
  },
  stableDescription: {
    fontSize: 14,
    color: "#666",
    fontFamily: "Inder",
    lineHeight: 18,
    marginBottom: 8,
  },
  stableStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 4,
  },
  statText: {
    fontSize: 12,
    color: "#999",
    fontFamily: "Inder",
    marginRight: 8,
  },
  joinCode: {
    fontSize: 12,
    color: "#335C67",
    fontWeight: "600",
    fontFamily: "Inder",
  },
  selectButton: {
    backgroundColor: "#335C67",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  selectButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
    fontFamily: "Inder",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
    fontFamily: "Inder",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: "#999",
    fontFamily: "Inder",
  },
  bottomActions: {
    flexDirection: "row",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
    gap: 12,
  },
  skipButton: {
    flex: 1,
    backgroundColor: "#f0f0f0",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  skipButtonText: {
    color: "#666",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inder",
  },
  cancelButton: {
    flex: 1,
    backgroundColor: "#335C67",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inder",
  },
});

export default StableSelection;
