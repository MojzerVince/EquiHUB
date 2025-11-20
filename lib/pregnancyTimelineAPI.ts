/**
 * Pregnancy Timeline API
 * Handles pregnancy tracking for horses with local storage sync
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { hasWiFiConnection } from './networkUtils';
import { getSupabase } from './supabase';

export interface PregnancyEvent {
  id: string;
  date: string;
  type: 'ultrasound' | 'vet_visit' | 'vaccination' | 'milestone' | 'note' | 'other';
  title: string;
  description?: string;
  attachments?: string[];
  created_at: string;
}

export interface PregnancyTimeline {
  id?: string;
  user_id: string;
  horse_id: string;
  horse_name: string;
  stallion_name?: string;
  cover_date: string;
  expected_due_date: string;
  actual_birth_date?: string;
  pregnancy_status: 'active' | 'completed' | 'terminated';
  foal_name?: string;
  foal_gender?: 'male' | 'female';
  veterinarian_name?: string;
  notes?: string;
  events: PregnancyEvent[];
  created_at?: string;
  updated_at?: string;
  // Local storage fields
  pendingSync?: boolean;
  localId?: string;
}

const STORAGE_KEY = 'pregnancy_timelines';
const PENDING_STORAGE_KEY = 'pending_pregnancy_timelines';

/**
 * Calculate expected due date from cover date (average 340 days gestation)
 */
export function calculateDueDate(coverDate: Date): Date {
  const dueDate = new Date(coverDate);
  dueDate.setDate(dueDate.getDate() + 340);
  return dueDate;
}

/**
 * Get local pregnancy timelines from AsyncStorage
 */
async function getLocalTimelines(): Promise<PregnancyTimeline[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error getting local timelines:', error);
    return [];
  }
}

/**
 * Save pregnancy timelines to local storage
 */
async function saveLocalTimelines(timelines: PregnancyTimeline[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(timelines));
  } catch (error) {
    console.error('Error saving local timelines:', error);
    throw error;
  }
}

/**
 * Get pending pregnancy timelines (not yet synced)
 */
export async function getPendingTimelines(): Promise<{
  success: boolean;
  timelines?: PregnancyTimeline[];
  error?: string;
}> {
  try {
    const data = await AsyncStorage.getItem(PENDING_STORAGE_KEY);
    const timelines: PregnancyTimeline[] = data ? JSON.parse(data) : [];
    return { success: true, timelines };
  } catch (error) {
    console.error('Error getting pending timelines:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Save pending pregnancy timeline
 */
async function savePendingTimeline(
  timeline: Omit<PregnancyTimeline, 'id' | 'created_at' | 'updated_at'>
): Promise<{ success: boolean; localId?: string; error?: string }> {
  try {
    const localId = `pending_pregnancy_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const pendingTimeline: PregnancyTimeline = {
      ...timeline,
      localId,
      pendingSync: true,
    };

    const { success, timelines } = await getPendingTimelines();
    const existingTimelines = success && timelines ? timelines : [];
    existingTimelines.push(pendingTimeline);

    await AsyncStorage.setItem(PENDING_STORAGE_KEY, JSON.stringify(existingTimelines));
    
    console.log('Pregnancy timeline saved to local storage with ID:', localId);
    return { success: true, localId };
  } catch (error) {
    console.error('Error saving pending timeline:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Create a new pregnancy timeline
 */
export async function createPregnancyTimeline(
  timeline: Omit<PregnancyTimeline, 'id' | 'created_at' | 'updated_at'>
): Promise<{ success: boolean; timeline?: PregnancyTimeline; localId?: string; isPending?: boolean; error?: string }> {
  try {
    const hasWiFi = await hasWiFiConnection();

    if (hasWiFi) {
      // Upload to cloud
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('pregnancy_timelines')
        .insert([timeline])
        .select()
        .single();

      if (error) {
        console.error('Error creating pregnancy timeline:', error);
        return { success: false, error: error.message };
      }

      // Also save to local storage for offline access
      const localTimelines = await getLocalTimelines();
      localTimelines.push(data);
      await saveLocalTimelines(localTimelines);

      console.log('Pregnancy timeline created successfully:', data.id);
      return { success: true, timeline: data, isPending: false };
    } else {
      // No WiFi - save locally
      console.log('No WiFi - saving pregnancy timeline locally');
      const result = await savePendingTimeline(timeline);
      return { ...result, isPending: true };
    }
  } catch (error) {
    console.error('Error creating pregnancy timeline:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Get pregnancy timeline for a specific horse
 */
export async function getPregnancyTimelineByHorse(
  horseId: string,
  checkCloud: boolean = true
): Promise<{ success: boolean; timeline?: PregnancyTimeline; error?: string }> {
  try {
    // First check local storage
    const localTimelines = await getLocalTimelines();
    const localTimeline = localTimelines.find(
      t => t.horse_id === horseId && t.pregnancy_status === 'active'
    );

    if (localTimeline && !checkCloud) {
      return { success: true, timeline: localTimeline };
    }

    // Check pending timelines
    const { success: pendingSuccess, timelines: pendingTimelines } = await getPendingTimelines();
    if (pendingSuccess && pendingTimelines) {
      const pendingTimeline = pendingTimelines.find(
        t => t.horse_id === horseId && t.pregnancy_status === 'active'
      );
      if (pendingTimeline) {
        return { success: true, timeline: pendingTimeline };
      }
    }

    // Check cloud if requested
    if (checkCloud) {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('pregnancy_timelines')
        .select('*')
        .eq('horse_id', horseId)
        .eq('pregnancy_status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching pregnancy timeline:', error);
        return { success: false, error: error.message };
      }

      if (data) {
        // Update local storage with cloud data
        const updatedTimelines = localTimelines.filter(t => t.horse_id !== horseId);
        updatedTimelines.push(data);
        await saveLocalTimelines(updatedTimelines);
        
        return { success: true, timeline: data };
      }
    }

    // Return local timeline if found
    if (localTimeline) {
      return { success: true, timeline: localTimeline };
    }

    return { success: true, timeline: undefined };
  } catch (error) {
    console.error('Error getting pregnancy timeline:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Update pregnancy timeline
 */
export async function updatePregnancyTimeline(
  timelineId: string,
  updates: Partial<PregnancyTimeline>
): Promise<{ success: boolean; timeline?: PregnancyTimeline; error?: string }> {
  try {
    const hasWiFi = await hasWiFiConnection();

    // Update local storage first
    const localTimelines = await getLocalTimelines();
    const timelineIndex = localTimelines.findIndex(t => t.id === timelineId || t.localId === timelineId);
    
    if (timelineIndex >= 0) {
      localTimelines[timelineIndex] = {
        ...localTimelines[timelineIndex],
        ...updates,
        updated_at: new Date().toISOString(),
      };
      await saveLocalTimelines(localTimelines);
    }

    if (hasWiFi && !timelineId.startsWith('pending_')) {
      // Update in cloud
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('pregnancy_timelines')
        .update(updates)
        .eq('id', timelineId)
        .select()
        .single();

      if (error) {
        console.error('Error updating pregnancy timeline:', error);
        return { success: false, error: error.message };
      }

      return { success: true, timeline: data };
    }

    return { 
      success: true, 
      timeline: timelineIndex >= 0 ? localTimelines[timelineIndex] : undefined 
    };
  } catch (error) {
    console.error('Error updating pregnancy timeline:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Sync pending pregnancy timeline to cloud
 */
export async function syncPendingTimeline(
  localId: string
): Promise<{ success: boolean; timelineId?: string; error?: string }> {
  try {
    const { success, timelines } = await getPendingTimelines();
    if (!success || !timelines) {
      return { success: false, error: 'Failed to get pending timelines' };
    }

    const timelineToSync = timelines.find(t => t.localId === localId);
    if (!timelineToSync) {
      return { success: false, error: 'Timeline not found' };
    }

    const hasWiFi = await hasWiFiConnection();
    if (!hasWiFi) {
      return { success: false, error: 'WiFi connection required for sync' };
    }

    // Remove temporary fields
    const { localId: _, pendingSync: __, ...timelineData } = timelineToSync;

    // Upload to cloud
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('pregnancy_timelines')
      .insert([timelineData])
      .select()
      .single();

    if (error) {
      console.error('Error syncing pregnancy timeline:', error);
      return { success: false, error: error.message };
    }

    // Remove from pending
    const remainingTimelines = timelines.filter(t => t.localId !== localId);
    await AsyncStorage.setItem(PENDING_STORAGE_KEY, JSON.stringify(remainingTimelines));

    // Add to local storage
    const localTimelines = await getLocalTimelines();
    localTimelines.push(data);
    await saveLocalTimelines(localTimelines);

    console.log('Pregnancy timeline synced successfully:', data.id);
    return { success: true, timelineId: data.id };
  } catch (error) {
    console.error('Error syncing pregnancy timeline:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Delete pregnancy timeline
 */
export async function deletePregnancyTimeline(
  timelineId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Remove from local storage
    const localTimelines = await getLocalTimelines();
    const updatedTimelines = localTimelines.filter(
      t => t.id !== timelineId && t.localId !== timelineId
    );
    await saveLocalTimelines(updatedTimelines);

    // If it's a pending timeline
    if (timelineId.startsWith('pending_')) {
      const { success, timelines } = await getPendingTimelines();
      if (success && timelines) {
        const updatedPending = timelines.filter(t => t.localId !== timelineId);
        await AsyncStorage.setItem(PENDING_STORAGE_KEY, JSON.stringify(updatedPending));
      }
      return { success: true };
    }

    // Delete from cloud
    const supabase = getSupabase();
    const { error } = await supabase
      .from('pregnancy_timelines')
      .delete()
      .eq('id', timelineId);

    if (error) {
      console.error('Error deleting pregnancy timeline:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error deleting pregnancy timeline:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Get all pregnancy timelines for a user
 */
export async function getAllPregnancyTimelines(
  userId: string
): Promise<{ success: boolean; timelines?: PregnancyTimeline[]; error?: string }> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('pregnancy_timelines')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching pregnancy timelines:', error);
      return { success: false, error: error.message };
    }

    // Update local storage
    await saveLocalTimelines(data || []);

    return { success: true, timelines: data || [] };
  } catch (error) {
    console.error('Error getting pregnancy timelines:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Add event to pregnancy timeline
 */
export async function addPregnancyEvent(
  timelineId: string,
  event: Omit<PregnancyEvent, 'id' | 'created_at'>
): Promise<{ success: boolean; timeline?: PregnancyTimeline; error?: string }> {
  try {
    const newEvent: PregnancyEvent = {
      ...event,
      id: `event_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      created_at: new Date().toISOString(),
    };

    // Get current timeline
    const localTimelines = await getLocalTimelines();
    const timeline = localTimelines.find(t => t.id === timelineId || t.localId === timelineId);

    if (!timeline) {
      return { success: false, error: 'Timeline not found' };
    }

    const updatedEvents = [...(timeline.events || []), newEvent];
    
    return await updatePregnancyTimeline(timelineId, { events: updatedEvents });
  } catch (error) {
    console.error('Error adding pregnancy event:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Update pregnancy event
 */
export async function updatePregnancyEvent(
  timelineId: string,
  eventId: string,
  updates: Partial<PregnancyEvent>
): Promise<{ success: boolean; timeline?: PregnancyTimeline; error?: string }> {
  try {
    const localTimelines = await getLocalTimelines();
    const timeline = localTimelines.find(t => t.id === timelineId || t.localId === timelineId);

    if (!timeline) {
      return { success: false, error: 'Timeline not found' };
    }

    const updatedEvents = timeline.events.map(event =>
      event.id === eventId ? { ...event, ...updates } : event
    );

    return await updatePregnancyTimeline(timelineId, { events: updatedEvents });
  } catch (error) {
    console.error('Error updating pregnancy event:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Delete pregnancy event
 */
export async function deletePregnancyEvent(
  timelineId: string,
  eventId: string
): Promise<{ success: boolean; timeline?: PregnancyTimeline; error?: string }> {
  try {
    const localTimelines = await getLocalTimelines();
    const timeline = localTimelines.find(t => t.id === timelineId || t.localId === timelineId);

    if (!timeline) {
      return { success: false, error: 'Timeline not found' };
    }

    const updatedEvents = timeline.events.filter(event => event.id !== eventId);

    return await updatePregnancyTimeline(timelineId, { events: updatedEvents });
  } catch (error) {
    console.error('Error deleting pregnancy event:', error);
    return { success: false, error: String(error) };
  }
}
