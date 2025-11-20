/**
 * Pregnancy Timeline API
 * Handles pregnancy timeline data synchronization with Supabase
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabase } from './supabase';

/**
 * Generate a UUID v4
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Types matching the frontend Pregnancy interface
export type PregnancyStatus = 'active' | 'foaled' | 'lost';
export type BreedingMethod = 'natural' | 'AI' | 'ICSI';
export type CheckType = 'US-14-16' | 'Heartbeat-25-30' | 'US-40-60' | 'Sexing-55-70' | 'Sexing-110-150' | 'Fall-check';
export type VaccineType = 'EHV-1' | 'Core-prefoal';
export type AlertType = 'red-bag' | 'placenta>3h' | 'discharge' | 'fever' | 'udder-premature';

export interface PregnancyCheck {
  type: CheckType;
  date?: string;
  due?: string;
  result?: string;
  fetusSex?: string;
  notes?: string;
  done?: boolean;
}

export interface PregnancyVaccine {
  type: VaccineType;
  due: string;
  date?: string;
  done?: boolean;
  notes?: string;
}

export interface PregnancyHusbandry {
  bcsTarget?: string;
  fescueRemovedOn?: string | null;
  dietNotes?: string;
}

export interface PregnancyDeworming {
  type: 'pre-foaling';
  due: string;
  date?: string;
  drug?: 'ivermectin' | 'benzimidazole';
  done?: boolean;
  notes?: string;
}

export interface MilkCalciumReading {
  date: string;
  ppm: number;
  notes?: string;
}

export interface PregnancyPhoto {
  date: string;
  dayPregnant: number;
  view: 'left-lateral';
  url: string;
  month?: number;
}

export interface PregnancyAlert {
  type: AlertType;
  active: boolean;
  date: string;
  notes?: string;
}

export interface FoalingDetails {
  date: string;
  time?: string;
  foalSex?: string;
  foalWeight?: number;
  placentaPassedTime?: string;
  foalStoodTime?: string;
  foalNursedTime?: string;
  placentaPhoto?: string;
  complications?: string;
  notes?: string;
}

export interface PregnancyTimeline {
  id: string;
  horseId: string;
  horseName?: string;
  status: PregnancyStatus;
  coverDate: string;
  ovulationDate?: string;
  dueDateEstimate: string;
  dueWindowStart: string;
  dueWindowEnd: string;
  stallion?: string;
  method?: BreedingMethod;
  vet?: {
    name?: string;
    phone?: string;
  };
  checks: PregnancyCheck[];
  vaccines: PregnancyVaccine[];
  husbandry?: PregnancyHusbandry;
  deworming: PregnancyDeworming[];
  milkCalcium: MilkCalciumReading[];
  photos: PregnancyPhoto[];
  alerts: PregnancyAlert[];
  notes?: string;
  foalingDetails?: FoalingDetails;
  createdAt: string;
  updatedAt: string;
}

// Database row interface
interface PregnancyTimelineRow {
  id: string;
  user_id: string;
  horse_id: string;
  horse_name: string;
  status: PregnancyStatus;
  cover_date: string;
  ovulation_date?: string;
  due_date_estimate: string;
  due_window_start: string;
  due_window_end: string;
  stallion?: string;
  breeding_method?: BreedingMethod;
  vet_info?: any;
  events: any;
  foaling_details?: any;
  notes?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Convert database row to frontend PregnancyTimeline
 */
function rowToPregnancy(row: PregnancyTimelineRow): PregnancyTimeline {
  return {
    id: row.id,
    horseId: row.horse_id,
    horseName: row.horse_name,
    status: row.status,
    coverDate: row.cover_date,
    ovulationDate: row.ovulation_date,
    dueDateEstimate: row.due_date_estimate,
    dueWindowStart: row.due_window_start,
    dueWindowEnd: row.due_window_end,
    stallion: row.stallion,
    method: row.breeding_method,
    vet: row.vet_info,
    checks: row.events?.checks || [],
    vaccines: row.events?.vaccines || [],
    husbandry: row.events?.husbandry,
    deworming: row.events?.deworming || [],
    milkCalcium: row.events?.milkCalcium || [],
    photos: row.events?.photos || [],
    alerts: row.events?.alerts || [],
    notes: row.notes,
    foalingDetails: row.foaling_details,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Convert frontend PregnancyTimeline to database row
 */
function pregnancyToRow(pregnancy: PregnancyTimeline, userId: string): Partial<PregnancyTimelineRow> {
  return {
    id: pregnancy.id,
    user_id: userId,
    horse_id: pregnancy.horseId,
    horse_name: pregnancy.horseName || '',
    status: pregnancy.status,
    cover_date: pregnancy.coverDate,
    ovulation_date: pregnancy.ovulationDate,
    due_date_estimate: pregnancy.dueDateEstimate,
    due_window_start: pregnancy.dueWindowStart,
    due_window_end: pregnancy.dueWindowEnd,
    stallion: pregnancy.stallion,
    breeding_method: pregnancy.method,
    vet_info: pregnancy.vet,
    events: {
      checks: pregnancy.checks,
      vaccines: pregnancy.vaccines,
      husbandry: pregnancy.husbandry,
      deworming: pregnancy.deworming,
      milkCalcium: pregnancy.milkCalcium,
      photos: pregnancy.photos,
      alerts: pregnancy.alerts,
    },
    foaling_details: pregnancy.foalingDetails,
    notes: pregnancy.notes,
  };
}

export { generateUUID };

/**
 * Get pregnancy timeline for a specific horse
 */
export async function getPregnancyForHorse(
  horseId: string
): Promise<{ success: boolean; pregnancy?: PregnancyTimeline; error?: string }> {
  try {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .from('pregnancy_timelines')
      .select('*')
      .eq('horse_id', horseId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      // No pregnancy found is not an error
      if (error.code === 'PGRST116') {
        return { success: true, pregnancy: undefined };
      }
      console.error('Error fetching pregnancy:', error);
      return { success: false, error: error.message };
    }

    return { success: true, pregnancy: rowToPregnancy(data) };
  } catch (error) {
    console.error('Error fetching pregnancy:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Get all pregnancy timelines for current user
 */
export async function getAllPregnancies(): Promise<{
  success: boolean;
  pregnancies?: Record<string, PregnancyTimeline>;
  error?: string;
}> {
  try {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .from('pregnancy_timelines')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching pregnancies:', error);
      return { success: false, error: error.message };
    }

    // Convert array to Record<horseId, Pregnancy>
    const pregnanciesMap: Record<string, PregnancyTimeline> = {};
    data?.forEach((row: PregnancyTimelineRow) => {
      pregnanciesMap[row.horse_id] = rowToPregnancy(row);
    });

    return { success: true, pregnancies: pregnanciesMap };
  } catch (error) {
    console.error('Error fetching pregnancies:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Create or update pregnancy timeline
 */
export async function upsertPregnancy(
  pregnancy: PregnancyTimeline,
  userId: string
): Promise<{ success: boolean; pregnancy?: PregnancyTimeline; error?: string }> {
  try {
    const supabase = getSupabase();
    const row = pregnancyToRow(pregnancy, userId);

    // If ID doesn't look like a UUID, let database generate one
    const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(pregnancy.id);
    if (!isValidUUID) {
      delete row.id; // Let database generate UUID
    }

    const { data, error } = await supabase
      .from('pregnancy_timelines')
      .upsert([row])
      .select()
      .single();

    if (error) {
      console.error('Error upserting pregnancy:', error);
      return { success: false, error: error.message };
    }

    return { success: true, pregnancy: rowToPregnancy(data) };
  } catch (error) {
    console.error('Error upserting pregnancy:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Delete pregnancy timeline
 */
export async function deletePregnancy(
  pregnancyId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getSupabase();
    
    const { error } = await supabase
      .from('pregnancy_timelines')
      .delete()
      .eq('id', pregnancyId);

    if (error) {
      console.error('Error deleting pregnancy:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error deleting pregnancy:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Sync local pregnancies with cloud
 * - Uploads local changes to cloud
 * - Returns merged data (cloud takes precedence for conflicts)
 */
export async function syncPregnancies(
  localPregnancies: Record<string, PregnancyTimeline>,
  userId: string
): Promise<{ success: boolean; pregnancies?: Record<string, PregnancyTimeline>; error?: string }> {
  try {
    // Get cloud pregnancies
    const cloudResult = await getAllPregnancies();
    if (!cloudResult.success) {
      return { success: false, error: cloudResult.error };
    }

    const cloudPregnancies = cloudResult.pregnancies || {};
    const merged: Record<string, PregnancyTimeline> = { ...cloudPregnancies };

    // Upload local pregnancies that are newer or don't exist in cloud
    for (const [horseId, localPregnancy] of Object.entries(localPregnancies)) {
      const cloudPregnancy = cloudPregnancies[horseId];

      // Upload if doesn't exist in cloud or local is newer
      const shouldUpload = !cloudPregnancy || 
        new Date(localPregnancy.updatedAt) > new Date(cloudPregnancy.updatedAt);

      if (shouldUpload) {
        const uploadResult = await upsertPregnancy(localPregnancy, userId);
        if (uploadResult.success && uploadResult.pregnancy) {
          merged[horseId] = uploadResult.pregnancy;
        }
      }
    }

    // Save merged data to local storage
    await AsyncStorage.setItem(
      `pregnancies_${userId}`,
      JSON.stringify(merged)
    );

    return { success: true, pregnancies: merged };
  } catch (error) {
    console.error('Error syncing pregnancies:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Load pregnancies with cloud sync
 * - Loads from local storage first
 * - Checks cloud for updates
 * - Merges and returns latest data
 */
export async function loadPregnanciesWithSync(
  userId: string
): Promise<{ success: boolean; pregnancies?: Record<string, PregnancyTimeline>; error?: string }> {
  try {
    // Load from local storage
    const localData = await AsyncStorage.getItem(`pregnancies_${userId}`);
    const localPregnancies: Record<string, PregnancyTimeline> = localData 
      ? JSON.parse(localData) 
      : {};

    // Sync with cloud
    return await syncPregnancies(localPregnancies, userId);
  } catch (error) {
    console.error('Error loading pregnancies:', error);
    return { success: false, error: String(error) };
  }
}
