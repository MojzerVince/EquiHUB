import { getSupabase } from "./supabase";

const getSupabaseClient = () => getSupabase();

export interface PlannedSession {
  id: string;
  userId: string;
  horseId: string;
  horseName: string;
  trainingType: string;
  title: string;
  description?: string;
  plannedDate: string; // ISO string
  reminderEnabled: boolean;
  repeatEnabled: boolean;
  repeatPattern?: "daily" | "weekly" | "biweekly" | "monthly";
  imageUrl?: string;
  isCompleted: boolean;
  completedAt?: string;
  actualSessionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePlannedSessionInput {
  horseId: string;
  horseName: string;
  trainingType: string;
  title: string;
  description?: string;
  plannedDate: Date;
  reminderEnabled: boolean;
  repeatEnabled: boolean;
  repeatPattern?: "daily" | "weekly" | "biweekly" | "monthly";
  imageUrl?: string;
}

export interface UpdatePlannedSessionInput {
  horseId?: string;
  horseName?: string;
  trainingType?: string;
  title?: string;
  description?: string;
  plannedDate?: Date;
  reminderEnabled?: boolean;
  repeatEnabled?: boolean;
  repeatPattern?: "daily" | "weekly" | "biweekly" | "monthly";
  imageUrl?: string;
  isCompleted?: boolean;
  completedAt?: Date;
  actualSessionId?: string;
}

/**
 * Create a new planned session
 */
export async function createPlannedSession(
  input: CreatePlannedSessionInput
): Promise<{ success: boolean; data?: PlannedSession; error?: string }> {
  try {
    const supabase = getSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "User not authenticated" };
    }

    const { data, error } = await supabase
      .from("planned_sessions")
      .insert({
        user_id: user.id,
        horse_id: input.horseId,
        horse_name: input.horseName,
        training_type: input.trainingType,
        title: input.title,
        description: input.description,
        planned_date: input.plannedDate.toISOString(),
        reminder_enabled: input.reminderEnabled,
        repeat_enabled: input.repeatEnabled,
        repeat_pattern: input.repeatPattern,
        image_url: input.imageUrl,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating planned session:", error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: {
        id: data.id,
        userId: data.user_id,
        horseId: data.horse_id,
        horseName: data.horse_name,
        trainingType: data.training_type,
        title: data.title,
        description: data.description,
        plannedDate: data.planned_date,
        reminderEnabled: data.reminder_enabled,
        repeatEnabled: data.repeat_enabled,
        repeatPattern: data.repeat_pattern,
        imageUrl: data.image_url,
        isCompleted: data.is_completed,
        completedAt: data.completed_at,
        actualSessionId: data.actual_session_id,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      },
    };
  } catch (error) {
    console.error("Error creating planned session:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get planned sessions for a specific date range
 * This function handles repeating sessions by generating virtual instances
 */
export async function getPlannedSessions(
  startDate: Date,
  endDate: Date
): Promise<{ success: boolean; data?: PlannedSession[]; error?: string }> {
  try {
    const supabase = getSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "User not authenticated" };
    }

    // Fetch all sessions that could potentially appear in this date range
    // For repeating sessions, we need to check if their original date could repeat into this range
    const { data, error } = await supabase
      .from("planned_sessions")
      .select("*")
      .eq("user_id", user.id)
      .order("planned_date", { ascending: true });

    if (error) {
      console.error("Error fetching planned sessions:", error);
      return { success: false, error: error.message };
    }

    const allSessions: PlannedSession[] = [];

    (data || []).forEach((session: any) => {
      const baseSession: PlannedSession = {
        id: session.id,
        userId: session.user_id,
        horseId: session.horse_id,
        horseName: session.horse_name,
        trainingType: session.training_type,
        title: session.title,
        description: session.description,
        plannedDate: session.planned_date,
        reminderEnabled: session.reminder_enabled,
        repeatEnabled: session.repeat_enabled,
        repeatPattern: session.repeat_pattern,
        imageUrl: session.image_url,
        isCompleted: session.is_completed,
        completedAt: session.completed_at,
        actualSessionId: session.actual_session_id,
        createdAt: session.created_at,
        updatedAt: session.updated_at,
      };

      const sessionDate = new Date(session.planned_date);

      // Check if original session falls in range
      if (sessionDate >= startDate && sessionDate <= endDate) {
        allSessions.push(baseSession);
      }

      // Handle repeating sessions
      if (session.repeat_enabled && session.repeat_pattern) {
        const instances = generateRepeatingInstances(
          baseSession,
          sessionDate,
          startDate,
          endDate
        );
        allSessions.push(...instances);
      }
    });

    // Sort by planned date
    allSessions.sort((a, b) => 
      new Date(a.plannedDate).getTime() - new Date(b.plannedDate).getTime()
    );

    return { success: true, data: allSessions };
  } catch (error) {
    console.error("Error fetching planned sessions:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Generate repeating instances of a session within a date range
 */
function generateRepeatingInstances(
  baseSession: PlannedSession,
  originalDate: Date,
  startDate: Date,
  endDate: Date
): PlannedSession[] {
  const instances: PlannedSession[] = [];
  
  if (!baseSession.repeatPattern) return instances;

  let currentDate = new Date(originalDate);
  
  // Start from the next occurrence after the original date
  switch (baseSession.repeatPattern) {
    case "daily":
      currentDate.setDate(currentDate.getDate() + 1);
      break;
    case "weekly":
      currentDate.setDate(currentDate.getDate() + 7);
      break;
    case "biweekly":
      currentDate.setDate(currentDate.getDate() + 14);
      break;
    case "monthly":
      currentDate.setMonth(currentDate.getMonth() + 1);
      break;
  }

  // Generate instances up to 1 year from original date or end date, whichever is sooner
  const maxDate = new Date(originalDate);
  maxDate.setFullYear(maxDate.getFullYear() + 1);
  const limitDate = endDate < maxDate ? endDate : maxDate;

  while (currentDate <= limitDate) {
    // Only include if it falls within the requested range
    if (currentDate >= startDate && currentDate <= endDate) {
      instances.push({
        ...baseSession,
        // Create a virtual ID for this instance
        id: `${baseSession.id}_repeat_${currentDate.toISOString()}`,
        plannedDate: currentDate.toISOString(),
        // Virtual instances are never completed (only the original can be marked complete)
        isCompleted: false,
        completedAt: undefined,
        actualSessionId: undefined,
      });
    }

    // Move to next occurrence
    const nextDate = new Date(currentDate);
    switch (baseSession.repeatPattern) {
      case "daily":
        nextDate.setDate(nextDate.getDate() + 1);
        break;
      case "weekly":
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case "biweekly":
        nextDate.setDate(nextDate.getDate() + 14);
        break;
      case "monthly":
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
    }
    currentDate = nextDate;
  }

  return instances;
}

/**
 * Get today's planned sessions (not completed)
 * Uses getPlannedSessions to handle repeating sessions
 */
export async function getTodayPlannedSessions(): Promise<{
  success: boolean;
  data?: PlannedSession[];
  error?: string;
}> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Use getPlannedSessions which handles repeating sessions
    const result = await getPlannedSessions(today, tomorrow);
    
    if (!result.success || !result.data) {
      return result;
    }

    // Filter out completed sessions
    const incompleteSessions = result.data.filter(session => !session.isCompleted);

    return { success: true, data: incompleteSessions };
  } catch (error) {
    console.error("Error fetching today's planned sessions:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Update a planned session
 */
export async function updatePlannedSession(
  sessionId: string,
  input: UpdatePlannedSessionInput
): Promise<{ success: boolean; data?: PlannedSession; error?: string }> {
  try {
    const supabase = getSupabaseClient();
    const updateData: any = {};

    if (input.horseId !== undefined) updateData.horse_id = input.horseId;
    if (input.horseName !== undefined) updateData.horse_name = input.horseName;
    if (input.trainingType !== undefined)
      updateData.training_type = input.trainingType;
    if (input.title !== undefined) updateData.title = input.title;
    if (input.description !== undefined)
      updateData.description = input.description;
    if (input.plannedDate !== undefined)
      updateData.planned_date = input.plannedDate.toISOString();
    if (input.reminderEnabled !== undefined)
      updateData.reminder_enabled = input.reminderEnabled;
    if (input.repeatEnabled !== undefined)
      updateData.repeat_enabled = input.repeatEnabled;
    if (input.repeatPattern !== undefined)
      updateData.repeat_pattern = input.repeatPattern;
    if (input.imageUrl !== undefined) updateData.image_url = input.imageUrl;
    if (input.isCompleted !== undefined)
      updateData.is_completed = input.isCompleted;
    if (input.completedAt !== undefined)
      updateData.completed_at = input.completedAt.toISOString();
    if (input.actualSessionId !== undefined)
      updateData.actual_session_id = input.actualSessionId;

    const { data, error } = await supabase
      .from("planned_sessions")
      .update(updateData)
      .eq("id", sessionId)
      .select()
      .single();

    if (error) {
      console.error("Error updating planned session:", error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: {
        id: data.id,
        userId: data.user_id,
        horseId: data.horse_id,
        horseName: data.horse_name,
        trainingType: data.training_type,
        title: data.title,
        description: data.description,
        plannedDate: data.planned_date,
        reminderEnabled: data.reminder_enabled,
        repeatEnabled: data.repeat_enabled,
        repeatPattern: data.repeat_pattern,
        imageUrl: data.image_url,
        isCompleted: data.is_completed,
        completedAt: data.completed_at,
        actualSessionId: data.actual_session_id,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      },
    };
  } catch (error) {
    console.error("Error updating planned session:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Delete a planned session
 */
export async function deletePlannedSession(
  sessionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getSupabaseClient();
    
    // Extract base UUID from compound ID (for repeating sessions)
    // Format: "uuid_repeat_timestamp" -> extract just "uuid"
    const baseId = sessionId.includes('_repeat_') 
      ? sessionId.split('_repeat_')[0] 
      : sessionId;
    
    const { error } = await supabase
      .from("planned_sessions")
      .delete()
      .eq("id", baseId);

    if (error) {
      console.error("Error deleting planned session:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Error deleting planned session:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Mark a planned session as completed
 */
export async function markPlannedSessionCompleted(
  sessionId: string,
  actualSessionId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getSupabaseClient();
    
    // Extract base UUID from compound ID (for repeating sessions)
    // Format: "uuid_repeat_timestamp" -> extract just "uuid"
    const baseId = sessionId.includes('_repeat_') 
      ? sessionId.split('_repeat_')[0] 
      : sessionId;
    
    const { error } = await supabase
      .from("planned_sessions")
      .update({
        is_completed: true,
        completed_at: new Date().toISOString(),
        actual_session_id: actualSessionId,
      })
      .eq("id", baseId);

    if (error) {
      console.error("Error marking planned session as completed:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Error marking planned session as completed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
