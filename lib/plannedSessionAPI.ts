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
  repeatPattern?: "daily" | "weekly" | "monthly";
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
  repeatPattern?: "daily" | "weekly" | "monthly";
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
  repeatPattern?: "daily" | "weekly" | "monthly";
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

    const { data, error } = await supabase
      .from("planned_sessions")
      .select("*")
      .eq("user_id", user.id)
      .gte("planned_date", startDate.toISOString())
      .lte("planned_date", endDate.toISOString())
      .order("planned_date", { ascending: true });

    if (error) {
      console.error("Error fetching planned sessions:", error);
      return { success: false, error: error.message };
    }

    const sessions: PlannedSession[] = (data || []).map((session: any) => ({
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
    }));

    return { success: true, data: sessions };
  } catch (error) {
    console.error("Error fetching planned sessions:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get today's planned sessions (not completed)
 */
export async function getTodayPlannedSessions(): Promise<{
  success: boolean;
  data?: PlannedSession[];
  error?: string;
}> {
  try {
    const supabase = getSupabaseClient();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "User not authenticated" };
    }

    const { data, error } = await supabase
      .from("planned_sessions")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_completed", false)
      .gte("planned_date", today.toISOString())
      .lt("planned_date", tomorrow.toISOString())
      .order("planned_date", { ascending: true });

    if (error) {
      console.error("Error fetching today's planned sessions:", error);
      return { success: false, error: error.message };
    }

    const sessions: PlannedSession[] = (data || []).map((session: any) => ({
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
    }));

    return { success: true, data: sessions };
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
    const { error } = await supabase
      .from("planned_sessions")
      .delete()
      .eq("id", sessionId);

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
    const { error } = await supabase
      .from("planned_sessions")
      .update({
        is_completed: true,
        completed_at: new Date().toISOString(),
        actual_session_id: actualSessionId,
      })
      .eq("id", sessionId);

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
