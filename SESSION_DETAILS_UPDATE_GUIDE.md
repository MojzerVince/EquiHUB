# Session Details Update - Implementation Guide

## Overview

Update session-details.tsx to display and allow editing of the new session feedback fields:

- Rider Performance (1-10)
- Horse Performance (1-10)
- Ground Type (Soft/Medium/Hard/Mixed)
- Notes

## Changes Needed

### 1. Add State Variables

```typescript
const [riderPerformance, setRiderPerformance] = useState<number>(5);
const [horsePerformance, setHorsePerformance] = useState<number>(5);
const [groundType, setGroundType] = useState<string>("Medium");
const [notes, setNotes] = useState<string>("");
const [isEditing, setIsEditing] = useState<boolean>(false);
const [isSaving, setIsSaving] = useState<boolean>(false);
```

### 2. Load Data from Database

In the `loadSession` function, after converting the DB session, add:

```typescript
// Load feedback fields
setRiderPerformance(dbSession.rider_performance || 5);
setHorsePerformance(dbSession.horse_performance || 5);
setGroundType(dbSession.ground_type || "Medium");
setNotes(dbSession.notes || "");
```

### 3. Create Update Function

```typescript
const updateSessionFeedback = async () => {
  if (!session?.id || !user?.id) return;

  setIsSaving(true);
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from("sessions")
      .update({
        rider_performance: riderPerformance,
        horse_performance: horsePerformance,
        ground_type: groundType,
        notes: notes.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", session.id);

    if (error) throw error;

    Alert.alert("Success", "Session feedback updated successfully");
    setIsEditing(false);
  } catch (error) {
    console.error("Error updating session:", error);
    Alert.alert("Error", "Failed to update session feedback");
  } finally {
    setIsSaving(false);
  }
};
```

### 4. Add UI Components

Add after the existing session stats section:

```typescript
{
  /* Performance Section */
}
<View style={styles.section}>
  <View style={styles.sectionHeader}>
    <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>
      Performance Feedback
    </Text>
    {!isEditing && (
      <TouchableOpacity onPress={() => setIsEditing(true)}>
        <Text
          style={[styles.editButton, { color: currentTheme.colors.primary }]}
        >
          Edit
        </Text>
      </TouchableOpacity>
    )}
  </View>

  {isEditing ? (
    <>
      <View style={styles.performanceItem}>
        <Text
          style={[styles.performanceLabel, { color: currentTheme.colors.text }]}
        >
          Rider Performance
        </Text>
        <View style={styles.ratingContainer}>
          <Text
            style={[styles.ratingValue, { color: currentTheme.colors.primary }]}
          >
            {riderPerformance}/10
          </Text>
          <Slider
            style={styles.slider}
            minimumValue={1}
            maximumValue={10}
            value={riderPerformance}
            onValueChange={(value) => setRiderPerformance(Math.round(value))}
            minimumTrackTintColor={currentTheme.colors.primary}
            maximumTrackTintColor={currentTheme.colors.accent}
            thumbTintColor={currentTheme.colors.primary}
            step={1}
          />
        </View>
      </View>

      <View style={styles.performanceItem}>
        <Text
          style={[styles.performanceLabel, { color: currentTheme.colors.text }]}
        >
          Horse Performance
        </Text>
        <View style={styles.ratingContainer}>
          <Text
            style={[styles.ratingValue, { color: currentTheme.colors.primary }]}
          >
            {horsePerformance}/10
          </Text>
          <Slider
            style={styles.slider}
            minimumValue={1}
            maximumValue={10}
            value={horsePerformance}
            onValueChange={(value) => setHorsePerformance(Math.round(value))}
            minimumTrackTintColor={currentTheme.colors.primary}
            maximumTrackTintColor={currentTheme.colors.accent}
            thumbTintColor={currentTheme.colors.primary}
            step={1}
          />
        </View>
      </View>

      <View style={styles.performanceItem}>
        <Text
          style={[styles.performanceLabel, { color: currentTheme.colors.text }]}
        >
          Ground Type
        </Text>
        <View style={styles.groundTypeContainer}>
          {["Soft", "Medium", "Hard", "Mixed"].map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.groundTypeButton,
                {
                  backgroundColor:
                    groundType === type
                      ? currentTheme.colors.primary
                      : currentTheme.colors.surface,
                  borderColor: currentTheme.colors.accent,
                },
              ]}
              onPress={() => setGroundType(type)}
            >
              <Text
                style={[
                  styles.groundTypeText,
                  {
                    color:
                      groundType === type ? "#fff" : currentTheme.colors.text,
                  },
                ]}
              >
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.performanceItem}>
        <Text
          style={[styles.performanceLabel, { color: currentTheme.colors.text }]}
        >
          Notes
        </Text>
        <TextInput
          style={[
            styles.notesInput,
            {
              backgroundColor: currentTheme.colors.surface,
              color: currentTheme.colors.text,
              borderColor: currentTheme.colors.accent,
            },
          ]}
          placeholder="Add notes about this session..."
          placeholderTextColor={currentTheme.colors.textSecondary}
          multiline
          numberOfLines={4}
          value={notes}
          onChangeText={setNotes}
        />
      </View>

      <View style={styles.editButtons}>
        <TouchableOpacity
          style={[
            styles.cancelButton,
            { backgroundColor: currentTheme.colors.accent },
          ]}
          onPress={() => {
            setIsEditing(false);
            // Reset to original values
            loadSession();
          }}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.saveButton,
            { backgroundColor: currentTheme.colors.primary },
          ]}
          onPress={updateSessionFeedback}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </View>
    </>
  ) : (
    <>
      <View style={styles.performanceRow}>
        <View style={styles.performanceReadOnly}>
          <Text
            style={[
              styles.performanceLabel,
              { color: currentTheme.colors.textSecondary },
            ]}
          >
            Rider Performance
          </Text>
          <Text
            style={[
              styles.performanceValue,
              { color: currentTheme.colors.text },
            ]}
          >
            {riderPerformance}/10
          </Text>
        </View>
        <View style={styles.performanceReadOnly}>
          <Text
            style={[
              styles.performanceLabel,
              { color: currentTheme.colors.textSecondary },
            ]}
          >
            Horse Performance
          </Text>
          <Text
            style={[
              styles.performanceValue,
              { color: currentTheme.colors.text },
            ]}
          >
            {horsePerformance}/10
          </Text>
        </View>
      </View>
      <View style={styles.performanceRow}>
        <View style={styles.performanceReadOnly}>
          <Text
            style={[
              styles.performanceLabel,
              { color: currentTheme.colors.textSecondary },
            ]}
          >
            Ground Type
          </Text>
          <Text
            style={[
              styles.performanceValue,
              { color: currentTheme.colors.text },
            ]}
          >
            {groundType}
          </Text>
        </View>
      </View>
      {notes && (
        <View style={styles.performanceItem}>
          <Text
            style={[
              styles.performanceLabel,
              { color: currentTheme.colors.textSecondary },
            ]}
          >
            Notes
          </Text>
          <Text
            style={[
              styles.performanceValue,
              { color: currentTheme.colors.text },
            ]}
          >
            {notes}
          </Text>
        </View>
      )}
    </>
  )}
</View>;
```

### 5. Add Required Imports

```typescript
import Slider from "@react-native-community/slider";
import { getSupabase } from "../lib/supabase";
```

### 6. Add Styles

Add these to the StyleSheet at the end:

```typescript
section: {
  marginBottom: 20,
  backgroundColor: '#fff',
  borderRadius: 12,
  padding: 15,
},
sectionHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 15,
},
sectionTitle: {
  fontSize: 18,
  fontFamily: 'Inder',
  fontWeight: '600',
},
editButton: {
  fontSize: 16,
  fontFamily: 'Inder',
  fontWeight: '500',
},
performanceItem: {
  marginBottom: 20,
},
performanceLabel: {
  fontSize: 14,
  fontFamily: 'Inder',
  marginBottom: 8,
},
performanceRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  marginBottom: 15,
},
performanceReadOnly: {
  flex: 1,
  marginHorizontal: 5,
},
performanceValue: {
  fontSize: 18,
  fontFamily: 'Inder',
  fontWeight: '600',
},
ratingContainer: {
  alignItems: 'center',
},
ratingValue: {
  fontSize: 28,
  fontFamily: 'Inder',
  fontWeight: '700',
  marginBottom: 10,
},
slider: {
  width: '100%',
  height: 40,
},
groundTypeContainer: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 10,
},
groundTypeButton: {
  paddingVertical: 10,
  paddingHorizontal: 18,
  borderRadius: 10,
  borderWidth: 2,
  minWidth: '47%',
  alignItems: 'center',
},
groundTypeText: {
  fontSize: 16,
  fontFamily: 'Inder',
  fontWeight: '500',
},
notesInput: {
  borderRadius: 10,
  borderWidth: 1,
  padding: 12,
  fontSize: 16,
  fontFamily: 'Inder',
  textAlignVertical: 'top',
  minHeight: 100,
},
editButtons: {
  flexDirection: 'row',
  gap: 10,
  marginTop: 10,
},
cancelButton: {
  flex: 1,
  paddingVertical: 12,
  borderRadius: 10,
  alignItems: 'center',
},
cancelButtonText: {
  color: '#333',
  fontSize: 16,
  fontFamily: 'Inder',
  fontWeight: '600',
},
saveButton: {
  flex: 1,
  paddingVertical: 12,
  borderRadius: 10,
  alignItems: 'center',
},
saveButtonText: {
  color: '#fff',
  fontSize: 16,
  fontFamily: 'Inder',
  fontWeight: '600',
},
```

## Notes

- The trimming feature is NOT added to session-details.tsx as it's only available once during session completion
- All other fields (rider/horse performance, ground type, notes) are editable from session details
- Data is loaded from database and can be updated with PATCH request to Supabase
