import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../contexts/AuthContext";
import { useDialog } from "../contexts/DialogContext";
import { useTheme } from "../contexts/ThemeContext";
import {
  PregnancyEvent,
  PregnancyTimeline,
  addPregnancyEvent,
  calculateDueDate,
  createPregnancyTimeline,
  deletePregnancyEvent,
  getPregnancyTimelineByHorse,
  syncPendingTimeline,
  updatePregnancyEvent,
} from "../lib/pregnancyTimelineAPI";

const PregnancyTimelineScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const { currentTheme } = useTheme();
  const { showError, showDialog } = useDialog();

  const horseId = params.horseId as string;
  const horseName = params.horseName as string;

  const [loading, setLoading] = useState(true);
  const [timeline, setTimeline] = useState<PregnancyTimeline | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Form state for creating new timeline
  const [stallionName, setStallionName] = useState("");
  const [coverDate, setCoverDate] = useState(new Date());
  const [veterinarianName, setVeterinarianName] = useState("");
  const [notes, setNotes] = useState("");

  // Event form state
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<PregnancyEvent | null>(null);
  const [eventTitle, setEventTitle] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventType, setEventType] = useState<PregnancyEvent["type"]>("note");
  const [eventDate, setEventDate] = useState(new Date());

  // Load timeline
  const loadTimeline = useCallback(async () => {
    if (!user?.id || !horseId) return;

    setLoading(true);
    try {
      // Check cloud for existing timeline (handles device changes)
      const result = await getPregnancyTimelineByHorse(horseId, true);

      if (result.success && result.timeline) {
        setTimeline(result.timeline);
      } else if (result.error) {
        console.error("Error loading timeline:", result.error);
      }
    } catch (error) {
      console.error("Error loading pregnancy timeline:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, horseId]);

  useEffect(() => {
    loadTimeline();
  }, [loadTimeline]);

  // Handle create timeline
  const handleCreateTimeline = async () => {
    if (!user?.id || !horseId) return;

    if (!stallionName.trim()) {
      showError("Please enter the stallion's name");
      return;
    }

    setIsCreating(true);
    try {
      const expectedDueDate = calculateDueDate(coverDate);

      const newTimeline: Omit<
        PregnancyTimeline,
        "id" | "created_at" | "updated_at"
      > = {
        user_id: user.id,
        horse_id: horseId,
        horse_name: horseName,
        stallion_name: stallionName,
        cover_date: coverDate.toISOString(),
        expected_due_date: expectedDueDate.toISOString(),
        pregnancy_status: "active",
        veterinarian_name: veterinarianName || undefined,
        notes: notes || undefined,
        events: [],
      };

      const result = await createPregnancyTimeline(newTimeline);

      if (result.success) {
        if (result.isPending) {
          Alert.alert(
            "Saved Locally",
            "Pregnancy timeline saved locally. It will sync to cloud when WiFi is available."
          );
        } else {
          Alert.alert("Success", "Pregnancy timeline created successfully!");
        }

        // Reload to show the new timeline
        await loadTimeline();
      } else {
        showError(result.error || "Failed to create pregnancy timeline");
      }
    } catch (error) {
      console.error("Error creating timeline:", error);
      showError("An unexpected error occurred");
    } finally {
      setIsCreating(false);
    }
  };

  // Handle sync timeline
  const handleSyncTimeline = async () => {
    if (!timeline?.localId) return;

    setIsSyncing(true);
    try {
      const result = await syncPendingTimeline(timeline.localId);

      if (result.success) {
        Alert.alert("Success", "Pregnancy timeline synced successfully!");
        await loadTimeline();
      } else {
        showError(
          result.error || "Failed to sync. Please check your WiFi connection."
        );
      }
    } catch (error) {
      console.error("Error syncing timeline:", error);
      showError("An unexpected error occurred");
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle add/edit event
  const handleSaveEvent = async () => {
    if (!timeline) return;

    if (!eventTitle.trim()) {
      showError("Please enter an event title");
      return;
    }

    try {
      if (editingEvent) {
        // Update existing event
        const result = await updatePregnancyEvent(
          timeline.id || timeline.localId!,
          editingEvent.id,
          {
            title: eventTitle,
            description: eventDescription,
            type: eventType,
            date: eventDate.toISOString(),
          }
        );

        if (result.success && result.timeline) {
          setTimeline(result.timeline);
          setShowEventForm(false);
          setEditingEvent(null);
          resetEventForm();
        } else {
          showError(result.error || "Failed to update event");
        }
      } else {
        // Add new event
        const result = await addPregnancyEvent(
          timeline.id || timeline.localId!,
          {
            title: eventTitle,
            description: eventDescription,
            type: eventType,
            date: eventDate.toISOString(),
          }
        );

        if (result.success && result.timeline) {
          setTimeline(result.timeline);
          setShowEventForm(false);
          resetEventForm();
        } else {
          showError(result.error || "Failed to add event");
        }
      }
    } catch (error) {
      console.error("Error saving event:", error);
      showError("An unexpected error occurred");
    }
  };

  // Handle delete event
  const handleDeleteEvent = async (eventId: string) => {
    if (!timeline) return;

    Alert.alert("Delete Event", "Are you sure you want to delete this event?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const result = await deletePregnancyEvent(
            timeline.id || timeline.localId!,
            eventId
          );

          if (result.success && result.timeline) {
            setTimeline(result.timeline);
          } else {
            showError(result.error || "Failed to delete event");
          }
        },
      },
    ]);
  };

  const resetEventForm = () => {
    setEventTitle("");
    setEventDescription("");
    setEventType("note");
    setEventDate(new Date());
  };

  // Calculate days pregnant
  const getDaysPregnant = () => {
    if (!timeline) return 0;
    const start = new Date(timeline.cover_date);
    const now = new Date();
    const diff = now.getTime() - start.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  // Calculate days until due
  const getDaysUntilDue = () => {
    if (!timeline) return 0;
    const due = new Date(timeline.expected_due_date);
    const now = new Date();
    const diff = due.getTime() - now.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  const getEventIcon = (type: PregnancyEvent["type"]) => {
    switch (type) {
      case "ultrasound":
        return "🔬";
      case "vet_visit":
        return "🩺";
      case "vaccination":
        return "💉";
      case "milestone":
        return "🎯";
      case "note":
        return "📝";
      default:
        return "📌";
    }
  };

  if (loading) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: currentTheme.colors.background },
        ]}
      >
        <ActivityIndicator size="large" color={currentTheme.colors.primary} />
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
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.header}>Pregnancy Timeline</Text>
        </View>
      </SafeAreaView>

      <ScrollView
        style={[
          styles.viewPort,
          { backgroundColor: currentTheme.colors.background },
        ]}
      >
        <View style={styles.contentContainer}>
          {!timeline ? (
            // Create new timeline form
            <View style={styles.createForm}>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: currentTheme.colors.text },
                ]}
              >
                Create Pregnancy Timeline for {horseName}
              </Text>

              <View style={styles.inputGroup}>
                <Text
                  style={[
                    styles.inputLabel,
                    { color: currentTheme.colors.text },
                  ]}
                >
                  Stallion Name *
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      color: currentTheme.colors.text,
                      borderColor: currentTheme.colors.border,
                    },
                  ]}
                  value={stallionName}
                  onChangeText={setStallionName}
                  placeholder="Enter stallion's name"
                  placeholderTextColor={currentTheme.colors.textSecondary}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text
                  style={[
                    styles.inputLabel,
                    { color: currentTheme.colors.text },
                  ]}
                >
                  Veterinarian (Optional)
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      color: currentTheme.colors.text,
                      borderColor: currentTheme.colors.border,
                    },
                  ]}
                  value={veterinarianName}
                  onChangeText={setVeterinarianName}
                  placeholder="Enter veterinarian's name"
                  placeholderTextColor={currentTheme.colors.textSecondary}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text
                  style={[
                    styles.inputLabel,
                    { color: currentTheme.colors.text },
                  ]}
                >
                  Notes (Optional)
                </Text>
                <TextInput
                  style={[
                    styles.textArea,
                    {
                      color: currentTheme.colors.text,
                      borderColor: currentTheme.colors.border,
                    },
                  ]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Add any notes about the pregnancy"
                  placeholderTextColor={currentTheme.colors.textSecondary}
                  multiline
                  numberOfLines={4}
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.createButton,
                  { backgroundColor: currentTheme.colors.primary },
                ]}
                onPress={handleCreateTimeline}
                disabled={isCreating}
              >
                {isCreating ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.createButtonText}>Create Timeline</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            // Show existing timeline
            <View style={styles.timelineView}>
              {/* Sync badge if pending */}
              {timeline.pendingSync && (
                <View
                  style={[
                    styles.syncBanner,
                    { backgroundColor: "#FFA50020", borderColor: "#FFA500" },
                  ]}
                >
                  <Text style={styles.syncBannerText}>
                    ⚠️ This timeline needs to be synced to cloud
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.syncButton,
                      { backgroundColor: currentTheme.colors.primary },
                    ]}
                    onPress={handleSyncTimeline}
                    disabled={isSyncing}
                  >
                    {isSyncing ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.syncButtonText}>☁️ Sync Now</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {/* Pregnancy info */}
              <View
                style={[
                  styles.infoCard,
                  {
                    backgroundColor: currentTheme.colors.surface,
                    borderColor: currentTheme.colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.infoTitle,
                    { color: currentTheme.colors.text },
                  ]}
                >
                  🐴 {horseName} × {timeline.stallion_name}
                </Text>

                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text
                      style={[
                        styles.statValue,
                        { color: currentTheme.colors.primary },
                      ]}
                    >
                      {getDaysPregnant()}
                    </Text>
                    <Text
                      style={[
                        styles.statLabel,
                        { color: currentTheme.colors.textSecondary },
                      ]}
                    >
                      Days Pregnant
                    </Text>
                  </View>

                  <View style={styles.statItem}>
                    <Text
                      style={[
                        styles.statValue,
                        { color: currentTheme.colors.primary },
                      ]}
                    >
                      {getDaysUntilDue()}
                    </Text>
                    <Text
                      style={[
                        styles.statLabel,
                        { color: currentTheme.colors.textSecondary },
                      ]}
                    >
                      Days Until Due
                    </Text>
                  </View>
                </View>

                <Text
                  style={[
                    styles.dueDate,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  Expected Due:{" "}
                  {new Date(timeline.expected_due_date).toLocaleDateString()}
                </Text>
              </View>

              {/* Events section */}
              <View style={styles.eventsSection}>
                <View style={styles.eventsSectionHeader}>
                  <Text
                    style={[
                      styles.sectionTitle,
                      { color: currentTheme.colors.text },
                    ]}
                  >
                    Timeline Events
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.addEventButton,
                      { backgroundColor: currentTheme.colors.primary },
                    ]}
                    onPress={() => setShowEventForm(true)}
                  >
                    <Text style={styles.addEventButtonText}>+ Add Event</Text>
                  </TouchableOpacity>
                </View>

                {timeline.events.length === 0 ? (
                  <Text
                    style={[
                      styles.noEventsText,
                      { color: currentTheme.colors.textSecondary },
                    ]}
                  >
                    No events yet. Add your first event!
                  </Text>
                ) : (
                  timeline.events
                    .sort(
                      (a, b) =>
                        new Date(b.date).getTime() - new Date(a.date).getTime()
                    )
                    .map((event) => (
                      <View
                        key={event.id}
                        style={[
                          styles.eventCard,
                          {
                            backgroundColor: currentTheme.colors.surface,
                            borderColor: currentTheme.colors.border,
                          },
                        ]}
                      >
                        <View style={styles.eventHeader}>
                          <Text style={styles.eventIcon}>
                            {getEventIcon(event.type)}
                          </Text>
                          <View style={styles.eventInfo}>
                            <Text
                              style={[
                                styles.eventTitle,
                                { color: currentTheme.colors.text },
                              ]}
                            >
                              {event.title}
                            </Text>
                            <Text
                              style={[
                                styles.eventDate,
                                { color: currentTheme.colors.textSecondary },
                              ]}
                            >
                              {new Date(event.date).toLocaleDateString()}
                            </Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => handleDeleteEvent(event.id)}
                          >
                            <Text style={styles.deleteIcon}>🗑️</Text>
                          </TouchableOpacity>
                        </View>
                        {event.description && (
                          <Text
                            style={[
                              styles.eventDescription,
                              { color: currentTheme.colors.textSecondary },
                            ]}
                          >
                            {event.description}
                          </Text>
                        )}
                      </View>
                    ))
                )}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Event Form Modal */}
      {showEventForm && (
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: currentTheme.colors.background },
            ]}
          >
            <Text
              style={[styles.modalTitle, { color: currentTheme.colors.text }]}
            >
              {editingEvent ? "Edit Event" : "Add Event"}
            </Text>

            <View style={styles.inputGroup}>
              <Text
                style={[styles.inputLabel, { color: currentTheme.colors.text }]}
              >
                Event Title *
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    color: currentTheme.colors.text,
                    borderColor: currentTheme.colors.border,
                  },
                ]}
                value={eventTitle}
                onChangeText={setEventTitle}
                placeholder="Enter event title"
                placeholderTextColor={currentTheme.colors.textSecondary}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text
                style={[styles.inputLabel, { color: currentTheme.colors.text }]}
              >
                Description
              </Text>
              <TextInput
                style={[
                  styles.textArea,
                  {
                    color: currentTheme.colors.text,
                    borderColor: currentTheme.colors.border,
                  },
                ]}
                value={eventDescription}
                onChangeText={setEventDescription}
                placeholder="Enter event description"
                placeholderTextColor={currentTheme.colors.textSecondary}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.cancelButton,
                  { borderColor: currentTheme.colors.border },
                ]}
                onPress={() => {
                  setShowEventForm(false);
                  setEditingEvent(null);
                  resetEventForm();
                }}
              >
                <Text
                  style={[
                    styles.cancelButtonText,
                    { color: currentTheme.colors.text },
                  ]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.saveButton,
                  { backgroundColor: currentTheme.colors.primary },
                ]}
                onPress={handleSaveEvent}
              >
                <Text style={styles.saveButtonText}>Save Event</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {},
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  backButton: {
    padding: 5,
  },
  backText: {
    fontSize: 30,
    color: "#FFFFFF",
  },
  header: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginLeft: 15,
  },
  viewPort: {
    flex: 1,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  contentContainer: {
    padding: 20,
  },
  createForm: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: "top",
  },
  createButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 20,
  },
  createButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
  },
  timelineView: {
    marginTop: 10,
  },
  syncBanner: {
    padding: 15,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  syncBannerText: {
    flex: 1,
    fontSize: 14,
    color: "#FFA500",
    fontWeight: "600",
  },
  syncButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 10,
  },
  syncButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  infoCard: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 15,
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 32,
    fontWeight: "bold",
  },
  statLabel: {
    fontSize: 14,
    marginTop: 5,
  },
  dueDate: {
    fontSize: 14,
    textAlign: "center",
    fontStyle: "italic",
  },
  eventsSection: {
    marginTop: 10,
  },
  eventsSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  addEventButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addEventButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  noEventsText: {
    fontSize: 16,
    textAlign: "center",
    fontStyle: "italic",
    paddingVertical: 30,
  },
  eventCard: {
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  eventHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  eventIcon: {
    fontSize: 24,
    marginRight: 10,
  },
  eventInfo: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  eventDate: {
    fontSize: 14,
  },
  deleteIcon: {
    fontSize: 20,
    padding: 5,
  },
  eventDescription: {
    fontSize: 14,
    marginTop: 10,
    paddingLeft: 34,
    lineHeight: 20,
  },
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "90%",
    maxWidth: 400,
    padding: 20,
    borderRadius: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginHorizontal: 5,
  },
  cancelButton: {
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  saveButton: {},
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default PregnancyTimelineScreen;
