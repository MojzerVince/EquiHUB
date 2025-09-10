import { getSupabase } from "./supabase";

export interface Feedback {
  id: string;
  user_id: string;
  subject: string;
  message: string;
  status: "pending" | "reviewed" | "resolved" | "closed";
  created_at: string;
  updated_at: string;
}

export interface CreateFeedbackRequest {
  subject: string;
  message: string;
}

export interface FeedbackResponse {
  success: boolean;
  error?: string;
  feedback?: Feedback;
}

export class FeedbackAPI {
  /**
   * Submit new feedback
   */
  static async submitFeedback(
    userId: string,
    feedbackData: CreateFeedbackRequest
  ): Promise<FeedbackResponse> {
    try {
      const supabase = getSupabase();

      // Validate input
      if (!feedbackData.subject?.trim()) {
        return {
          success: false,
          error: "Subject is required",
        };
      }

      if (!feedbackData.message?.trim()) {
        return {
          success: false,
          error: "Message is required",
        };
      }

      if (feedbackData.subject.trim().length > 200) {
        return {
          success: false,
          error: "Subject must be less than 200 characters",
        };
      }

      if (feedbackData.message.trim().length > 2000) {
        return {
          success: false,
          error: "Message must be less than 2000 characters",
        };
      }

      // Insert feedback into database
      const { data, error } = await supabase
        .from("feedbacks")
        .insert([
          {
            user_id: userId,
            subject: feedbackData.subject.trim(),
            message: feedbackData.message.trim(),
            status: "pending",
          },
        ])
        .select()
        .single();

      if (error) {
        console.error("Error submitting feedback:", error);
        return {
          success: false,
          error: "Failed to submit feedback. Please try again.",
        };
      }

      return {
        success: true,
        feedback: data,
      };
    } catch (error) {
      console.error("Error in submitFeedback:", error);
      return {
        success: false,
        error: "An unexpected error occurred. Please try again.",
      };
    }
  }

  /**
   * Get user's feedback history
   */
  static async getUserFeedbacks(userId: string): Promise<{
    feedbacks: Feedback[];
    error: string | null;
  }> {
    try {
      const supabase = getSupabase();

      const { data, error } = await supabase
        .from("feedbacks")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error getting user feedbacks:", error);
        return {
          feedbacks: [],
          error: "Failed to load feedback history",
        };
      }

      return {
        feedbacks: data || [],
        error: null,
      };
    } catch (error) {
      console.error("Error in getUserFeedbacks:", error);
      return {
        feedbacks: [],
        error: "An unexpected error occurred",
      };
    }
  }

  /**
   * Update feedback (only for pending status)
   */
  static async updateFeedback(
    feedbackId: string,
    updates: Partial<CreateFeedbackRequest>
  ): Promise<FeedbackResponse> {
    try {
      const supabase = getSupabase();

      // Validate input if provided
      if (updates.subject !== undefined) {
        if (!updates.subject?.trim()) {
          return {
            success: false,
            error: "Subject is required",
          };
        }
        if (updates.subject.trim().length > 200) {
          return {
            success: false,
            error: "Subject must be less than 200 characters",
          };
        }
      }

      if (updates.message !== undefined) {
        if (!updates.message?.trim()) {
          return {
            success: false,
            error: "Message is required",
          };
        }
        if (updates.message.trim().length > 2000) {
          return {
            success: false,
            error: "Message must be less than 2000 characters",
          };
        }
      }

      // Prepare update object
      const updateData: any = {};
      if (updates.subject !== undefined) {
        updateData.subject = updates.subject.trim();
      }
      if (updates.message !== undefined) {
        updateData.message = updates.message.trim();
      }

      const { data, error } = await supabase
        .from("feedbacks")
        .update(updateData)
        .eq("id", feedbackId)
        .eq("status", "pending") // Only allow updates to pending feedback
        .select()
        .single();

      if (error) {
        console.error("Error updating feedback:", error);
        return {
          success: false,
          error: "Failed to update feedback. It may have already been reviewed.",
        };
      }

      return {
        success: true,
        feedback: data,
      };
    } catch (error) {
      console.error("Error in updateFeedback:", error);
      return {
        success: false,
        error: "An unexpected error occurred. Please try again.",
      };
    }
  }

  /**
   * Delete feedback (only for pending status)
   */
  static async deleteFeedback(feedbackId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const supabase = getSupabase();

      const { error } = await supabase
        .from("feedbacks")
        .delete()
        .eq("id", feedbackId)
        .eq("status", "pending"); // Only allow deletion of pending feedback

      if (error) {
        console.error("Error deleting feedback:", error);
        return {
          success: false,
          error: "Failed to delete feedback. It may have already been reviewed.",
        };
      }

      return {
        success: true,
      };
    } catch (error) {
      console.error("Error in deleteFeedback:", error);
      return {
        success: false,
        error: "An unexpected error occurred. Please try again.",
      };
    }
  }
}
