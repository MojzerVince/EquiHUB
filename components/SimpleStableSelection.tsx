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
          <Text
            style={[styles.stableName, { color: currentTheme.colors.text }]}
          >
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
      <View style={styles.modalOverlay}>
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
              { backgroundColor: currentTheme.colors.background },
            ]}
          >
            <View style={styles.headerContent}>
              <Text
                style={[
                  styles.headerTitle,
                  { color: currentTheme.colors.text },
                ]}
              >
                Choose a Stable
              </Text>
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text
              style={[
                styles.headerSubtitle,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              Find a stable to connect with or create your own
            </Text>
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
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  container: {
    flex: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 0, 0, 0.05)",
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 16,
    lineHeight: 22,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    justifyContent: "center",
    alignItems: "center",
  },
  closeButtonText: {
    fontSize: 18,
    color: "#666",
    fontWeight: "600",
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#f8f9fa",
    marginHorizontal: 24,
    marginVertical: 4,
    marginTop: 12,
    borderRadius: 20,
    padding: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: "center",
  },
  tabText: {
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  stableItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: "transparent",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  stableInfo: {
    flex: 1,
    marginRight: 16,
  },
  stableName: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  stableLocation: {
    fontSize: 15,
    marginBottom: 4,
    lineHeight: 20,
  },
  selectButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  selectButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  searchContainer: {
    flexDirection: "row",
    marginBottom: 20,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    fontSize: 16,
    borderWidth: 2,
    borderColor: "rgba(0, 0, 0, 0.05)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  searchButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 90,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  searchButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  searchResults: {
    marginTop: 12,
  },
  formContainer: {
    marginBottom: 32,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 10,
    letterSpacing: -0.1,
  },
  textInput: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 16,
    fontSize: 16,
    minHeight: 56,
    borderWidth: 2,
    borderColor: "rgba(0, 0, 0, 0.05)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  createButton: {
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  createButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  skipButton: {
    paddingVertical: 12,
    borderRadius: 20,
    alignItems: "center",
    marginTop: 32,
    borderWidth: 2,
    borderColor: "rgba(0, 0, 0, 0.08)",
    backgroundColor: "transparent",
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  loadingContainer: {
    alignItems: "center",
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    letterSpacing: 0.1,
  },
  emptyText: {
    fontSize: 15,
    textAlign: "center",
    padding: 32,
    lineHeight: 22,
  },
  stableNameContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  verifiedBadge: {
    backgroundColor: "#10b981",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 12,
  },
  verifiedBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
});

export default SimpleStableSelection;
