/**
 * Session API
 * Handles uploading and retrieving GPS tracking sessions from Supabase
 * Sessions are accessible across EquiHUB, EquiHUB Advisory, and EquiHUB Trainers apps
 */

import { getSupabase } from './supabase';

export interface TrackingSession {
  id?: string;
  user_id: string;
  horse_id?: string;
  horse_name?: string;
  training_type: string;
  session_data: {
    coordinates: Array<{
      latitude: number;
      longitude: number;
      timestamp: string;
      speed?: number;
      altitude?: number;
      accuracy?: number;
    }>;
    metadata?: {
      weather?: string;
      notes?: string;
      planned_session_id?: string;
      [key: string]: any;
    };
  };
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  distance_meters: number;
  max_speed_kmh?: number;
  avg_speed_kmh?: number;
  created_at?: string;
  updated_at?: string;
}

/**
 * Upload a completed tracking session to the database
 * Supports both old format (object) and new format (individual parameters)
 */
export async function uploadSession(
  userIdOrSession: string | Omit<TrackingSession, 'id' | 'created_at' | 'updated_at'>,
  horseId?: string | null,
  horseName?: string | null,
  trainingType?: string,
  sessionData?: any,
  startedAt?: Date,
  endedAt?: Date,
  durationSeconds?: number,
  distanceMeters?: number,
  maxSpeedKmh?: number,
  avgSpeedKmh?: number,
  riderPerformance?: number,
  horsePerformance?: number,
  groundType?: string,
  notes?: string | null
): Promise<{ success: boolean; sessionId?: string; error?: string }> {
  try {
    const supabase = getSupabase();
    
    // Handle both old and new function signatures
    let sessionToInsert: any;
    
    if (typeof userIdOrSession === 'string') {
      // New format with individual parameters
      sessionToInsert = {
        user_id: userIdOrSession,
        horse_id: horseId,
        horse_name: horseName,
        training_type: trainingType,
        session_data: sessionData,
        started_at: startedAt?.toISOString(),
        ended_at: endedAt?.toISOString(),
        duration_seconds: durationSeconds,
        distance_meters: distanceMeters,
        max_speed_kmh: maxSpeedKmh,
        avg_speed_kmh: avgSpeedKmh,
        rider_performance: riderPerformance,
        horse_performance: horsePerformance,
        ground_type: groundType,
        notes: notes,
      };
    } else {
      // Old format with session object
      sessionToInsert = userIdOrSession;
    }
    
    const { data, error } = await supabase
      .from('sessions')
      .insert([sessionToInsert])
      .select('id')
      .single();

    if (error) {
      console.error('Error uploading session:', error);
      return { success: false, error: error.message };
    }

    console.log('Session uploaded successfully:', data.id);
    return { success: true, sessionId: data.id };
  } catch (error) {
    console.error('Error uploading session:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Get the start and end dates for a specific week
 * Week starts on Monday
 */
function getWeekBounds(date: Date): { start: Date; end: Date } {
  const current = new Date(date);
  const day = current.getDay();
  const diff = current.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
  
  const start = new Date(current.setDate(diff));
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  
  return { start, end };
}

/**
 * Retrieve sessions for a specific week
 * @param userId - User ID to fetch sessions for
 * @param weekDate - Any date within the desired week (defaults to current week)
 */
export async function getSessionsForWeek(
  userId: string, 
  weekDate: Date = new Date()
): Promise<{ success: boolean; sessions?: TrackingSession[]; error?: string }> {
  try {
    const supabase = getSupabase();
    const { start, end } = getWeekBounds(weekDate);
    
    console.log(`Fetching sessions for week: ${start.toISOString()} to ${end.toISOString()}`);
    
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('user_id', userId)
      .gte('started_at', start.toISOString())
      .lte('started_at', end.toISOString())
      .order('started_at', { ascending: false });

    if (error) {
      console.error('Error fetching sessions:', error);
      return { success: false, error: error.message };
    }

    console.log(`Found ${data?.length || 0} sessions for the week`);
    return { success: true, sessions: data || [] };
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Get sessions for the current week
 */
export async function getCurrentWeekSessions(
  userId: string
): Promise<{ success: boolean; sessions?: TrackingSession[]; error?: string }> {
  return getSessionsForWeek(userId, new Date());
}

/**
 * Get sessions for the previous week
 */
export async function getPreviousWeekSessions(
  userId: string,
  currentWeekDate: Date = new Date()
): Promise<{ success: boolean; sessions?: TrackingSession[]; error?: string }> {
  const previousWeek = new Date(currentWeekDate);
  previousWeek.setDate(previousWeek.getDate() - 7);
  return getSessionsForWeek(userId, previousWeek);
}

/**
 * Get sessions for the next week
 */
export async function getNextWeekSessions(
  userId: string,
  currentWeekDate: Date = new Date()
): Promise<{ success: boolean; sessions?: TrackingSession[]; error?: string }> {
  const nextWeek = new Date(currentWeekDate);
  nextWeek.setDate(nextWeek.getDate() + 7);
  return getSessionsForWeek(userId, nextWeek);
}

/**
 * Delete a session
 */
export async function deleteSession(sessionId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getSupabase();
    
    const { error } = await supabase
      .from('sessions')
      .delete()
      .eq('id', sessionId);

    if (error) {
      console.error('Error deleting session:', error);
      return { success: false, error: error.message };
    }

    console.log('Session deleted successfully');
    return { success: true };
  } catch (error) {
    console.error('Error deleting session:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Get a single session by ID
 */
export async function getSessionById(sessionId: string): Promise<{ success: boolean; session?: TrackingSession; error?: string }> {
  try {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error) {
      console.error('Error fetching session:', error);
      return { success: false, error: error.message };
    }

    return { success: true, session: data };
  } catch (error) {
    console.error('Error fetching session:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Get all sessions for a user (paginated)
 */
export async function getAllSessions(
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<{ success: boolean; sessions?: TrackingSession[]; error?: string }> {
  try {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching sessions:', error);
      return { success: false, error: error.message };
    }

    return { success: true, sessions: data || [] };
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Get week statistics
 */
export function getWeekStats(sessions: TrackingSession[]): {
  totalDistance: number;
  totalDuration: number;
  totalSessions: number;
  avgSpeed: number;
  maxSpeed: number;
} {
  if (!sessions || sessions.length === 0) {
    return {
      totalDistance: 0,
      totalDuration: 0,
      totalSessions: 0,
      avgSpeed: 0,
      maxSpeed: 0,
    };
  }

  const totalDistance = sessions.reduce((sum, s) => sum + (s.distance_meters || 0), 0);
  const totalDuration = sessions.reduce((sum, s) => sum + (s.duration_seconds || 0), 0);
  const avgSpeed = sessions.reduce((sum, s) => sum + (s.avg_speed_kmh || 0), 0) / sessions.length;
  const maxSpeed = Math.max(...sessions.map(s => s.max_speed_kmh || 0));

  return {
    totalDistance,
    totalDuration,
    totalSessions: sessions.length,
    avgSpeed,
    maxSpeed,
  };
}
