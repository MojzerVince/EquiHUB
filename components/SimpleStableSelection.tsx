import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { SimpleStable, SimpleStableAPI } from "../lib/simpleStableAPI";

interface SimpleStableSelectionProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (
    stable: SimpleStable | null,
    isNewStable?: boolean,
    newStableData?: any
  ) => void;
  selectedStable?: SimpleStable | null;
}

const SimpleStableSelection: React.FC<SimpleStableSelectionProps> = ({
  visible,
  onClose,
  onSelect,
  selectedStable,
}) => {
  const { currentTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<"popular" | "search" | "create">(
    "popular"
  );
  const [popularStables, setPopularStables] = useState<SimpleStable[]>([]);
  const [searchResults, setSearchResults] = useState<SimpleStable[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  // New stable creation state
  const [newStableName, setNewStableName] = useState("");
  const [newStableLocation, setNewStableLocation] = useState("");
  const [newStableCity, setNewStableCity] = useState("");
  const [newStableState, setNewStableState] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (visible) {
      loadPopularStables();
    }
  }, [visible]);

  const loadPopularStables = async () => {
    setLoading(true);
    try {
      const { stables, error } = await SimpleStableAPI.getPopularStables(10);
      if (!error) {
        setPopularStables(stables);
      }
    } catch (error) {
      console.error("Error loading popular stables:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || searchQuery.length < 2) return;

    setSearching(true);
    try {
      const { stables, error } = await SimpleStableAPI.searchStables(
        searchQuery
      );
      if (!error) {
        setSearchResults(stables);
      }
    } catch (error) {
      console.error("Error searching stables:", error);
    } finally {
      setSearching(false);
    }
  };

  const handleCreateStable = () => {
    if (!newStableName.trim()) return;

    const newStableData = {
      name: newStableName.trim(),
      location: newStableLocation.trim() || undefined,
      city: newStableCity.trim() || undefined,
      state_province: newStableState.trim() || undefined,
    };

    onSelect(null, true, newStableData);
    onClose();
  };

  const renderStableItem = (stable: SimpleStable, onPress: () => void) => (
    <TouchableOpacity
      key={stable.id}
      style={[
        styles.stableItem,
        { backgroundColor: currentTheme.colors.surface },
        selectedStable?.id === stable.id && {
          borderColor: currentTheme.colors.primary,
          borderWidth: 2,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.stableInfo}>
        <View style={styles.stableNameContainer}>
          <Text style={[styles.stableName, { color: currentTheme.colors.text }]}>
            {stable.name}
          </Text>
          {stable.is_verified && (
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedBadgeText}>✓ Verified</Text>
            </View>
          )}
        </View>
        <Text
          style={[
            styles.stableLocation,
            { color: currentTheme.colors.textSecondary },
          ]}
        >
          {stable.city && stable.state_province
            ? `${stable.city}, ${stable.state_province}`
            : stable.location || "Location not specified"}
        </Text>
      </View>
      <View
        style={[
          styles.selectButton,
          { backgroundColor: currentTheme.colors.primary },
        ]}
      >
        <Text style={styles.selectButtonText}>Select</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View
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
          <Text style={styles.headerTitle}>Choose a Stable</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === "popular" && {
                backgroundColor: currentTheme.colors.primary,
              },
            ]}
            onPress={() => setActiveTab("popular")}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color:
                    activeTab === "popular"
                      ? "#fff"
                      : currentTheme.colors.textSecondary,
                },
              ]}
            >
              Popular
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === "search" && {
                backgroundColor: currentTheme.colors.primary,
              },
            ]}
            onPress={() => setActiveTab("search")}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color:
                    activeTab === "search"
                      ? "#fff"
                      : currentTheme.colors.textSecondary,
                },
              ]}
            >
              Search
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === "create" && {
                backgroundColor: currentTheme.colors.primary,
              },
            ]}
            onPress={() => setActiveTab("create")}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color:
                    activeTab === "create"
                      ? "#fff"
                      : currentTheme.colors.textSecondary,
                },
              ]}
            >
              Create New
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
        >
          {activeTab === "popular" && (
            <View>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: currentTheme.colors.text },
                ]}
              >
                Popular Stables
              </Text>
              {loading ? (
                <View style={styles.loadingContainer}>
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
                    Loading stables...
                  </Text>
                </View>
              ) : popularStables.length > 0 ? (
                popularStables.map((stable) =>
                  renderStableItem(stable, () => {
                    onSelect(stable);
                    onClose();
                  })
                )
              ) : (
                <Text
                  style={[
                    styles.emptyText,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  No popular stables found
                </Text>
              )}
            </View>
          )}

          {activeTab === "search" && (
            <View>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: currentTheme.colors.text },
                ]}
              >
                Search Stables
              </Text>
              <View style={styles.searchContainer}>
                <TextInput
                  style={[
                    styles.searchInput,
                    {
                      backgroundColor: currentTheme.colors.surface,
                      color: currentTheme.colors.text,
                    },
                  ]}
                  placeholder="Search by name or location..."
                  placeholderTextColor={currentTheme.colors.textSecondary}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onSubmitEditing={handleSearch}
                />
                <TouchableOpacity
                  style={[
                    styles.searchButton,
                    { backgroundColor: currentTheme.colors.primary },
                  ]}
                  onPress={handleSearch}
                  disabled={searching || searchQuery.length < 2}
                >
                  {searching ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.searchButtonText}>Search</Text>
                  )}
                </TouchableOpacity>
              </View>
              {searchResults.length > 0 && (
                <View style={styles.searchResults}>
                  {searchResults.map((stable) =>
                    renderStableItem(stable, () => {
                      onSelect(stable);
                      onClose();
                    })
                  )}
                </View>
              )}
              {searchQuery.length >= 2 &&
                searchResults.length === 0 &&
                !searching && (
                  <Text
                    style={[
                      styles.emptyText,
                      { color: currentTheme.colors.textSecondary },
                    ]}
                  >
                    No stables found matching "{searchQuery}"
                  </Text>
                )}
            </View>
          )}

          {activeTab === "create" && (
            <View>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: currentTheme.colors.text },
                ]}
              >
                Create New Stable
              </Text>
              <View style={styles.formContainer}>
                <View style={styles.inputGroup}>
                  <Text
                    style={[
                      styles.inputLabel,
                      { color: currentTheme.colors.text },
                    ]}
                  >
                    Stable Name *
                  </Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      {
                        backgroundColor: currentTheme.colors.surface,
                        color: currentTheme.colors.text,
                      },
                    ]}
                    placeholder="Enter stable name"
                    placeholderTextColor={currentTheme.colors.textSecondary}
                    value={newStableName}
                    onChangeText={setNewStableName}
                    maxLength={100}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text
                    style={[
                      styles.inputLabel,
                      { color: currentTheme.colors.text },
                    ]}
                  >
                    City
                  </Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      {
                        backgroundColor: currentTheme.colors.surface,
                        color: currentTheme.colors.text,
                      },
                    ]}
                    placeholder="Enter city"
                    placeholderTextColor={currentTheme.colors.textSecondary}
                    value={newStableCity}
                    onChangeText={setNewStableCity}
                    maxLength={50}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text
                    style={[
                      styles.inputLabel,
                      { color: currentTheme.colors.text },
                    ]}
                  >
                    State/Province
                  </Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      {
                        backgroundColor: currentTheme.colors.surface,
                        color: currentTheme.colors.text,
                      },
                    ]}
                    placeholder="Enter state or province"
                    placeholderTextColor={currentTheme.colors.textSecondary}
                    value={newStableState}
                    onChangeText={setNewStableState}
                    maxLength={50}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text
                    style={[
                      styles.inputLabel,
                      { color: currentTheme.colors.text },
                    ]}
                  >
                    Full Address (Optional)
                  </Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      {
                        backgroundColor: currentTheme.colors.surface,
                        color: currentTheme.colors.text,
                      },
                    ]}
                    placeholder="Enter full address"
                    placeholderTextColor={currentTheme.colors.textSecondary}
                    value={newStableLocation}
                    onChangeText={setNewStableLocation}
                    maxLength={200}
                    multiline
                  />
                </View>
                <TouchableOpacity
                  style={[
                    styles.createButton,
                    {
                      backgroundColor: newStableName.trim()
                        ? currentTheme.colors.primary
                        : currentTheme.colors.textSecondary,
                    },
                  ]}
                  onPress={handleCreateStable}
                  disabled={!newStableName.trim() || creating}
                >
                  {creating ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.createButtonText}>Create Stable</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.skipButton,
              { backgroundColor: currentTheme.colors.surface },
            ]}
            onPress={() => {
              onSelect(null);
              onClose();
            }}
          >
            <Text
              style={[
                styles.skipButtonText,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              Skip - Join Later
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
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
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 20,
    position: "relative",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
    fontFamily: "Inder",
  },
  closeButton: {
    position: "absolute",
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  closeButtonText: {
    fontSize: 20,
    color: "#fff",
    fontWeight: "bold",
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#f5f5f5",
    margin: 16,
    borderRadius: 8,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: "center",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inder",
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    fontFamily: "Inder",
    marginBottom: 16,
  },
  stableItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "transparent",
  },
  stableInfo: {
    flex: 1,
  },
  stableName: {
    fontSize: 16,
    fontWeight: "bold",
    fontFamily: "Inder",
    marginBottom: 4,
  },
  stableLocation: {
    fontSize: 14,
    fontFamily: "Inder",
    marginBottom: 2,
  },
  selectButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  selectButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inder",
  },
  searchContainer: {
    flexDirection: "row",
    marginBottom: 16,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 16,
    fontFamily: "Inder",
  },
  searchButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 80,
  },
  searchButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inder",
  },
  searchResults: {
    marginTop: 8,
  },
  formContainer: {
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inder",
    marginBottom: 8,
  },
  textInput: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 16,
    fontFamily: "Inder",
    minHeight: 48,
  },
  createButton: {
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  createButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inder",
  },
  skipButton: {
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 20,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inder",
  },
  loadingContainer: {
    alignItems: "center",
    padding: 20,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    fontFamily: "Inder",
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inder",
    textAlign: "center",
    padding: 20,
  },
  stableNameContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  verifiedBadge: {
    backgroundColor: "#4CAF50",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  verifiedBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Inder",
  },
});

export default SimpleStableSelection;
