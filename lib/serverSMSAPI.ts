import { getSupabase } from "./supabase";

export interface EmergencyContact {
  id: string;
  name: string;
  phoneNumber: string;
  isEnabled: boolean;
  addedAt: number;
}

export interface SMSRequest {
  userId: string;
  message: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  emergencyType: "fall_detection" | "manual_emergency" | "test";
}

export interface SMSResponse {
  success: boolean;
  sentCount: number;
  error?: string;
  messageId?: string;
}

export class ServerSMSAPI {
  // Send emergency SMS through server
  static async sendEmergencyAlert(request: SMSRequest): Promise<SMSResponse> {
    try {
      console.log("📱 Sending emergency alert through server:", request.emergencyType);

      const supabase = getSupabase();

      // Call Supabase Edge Function for SMS
      const { data, error } = await supabase.functions.invoke("send-emergency-sms", {
        body: {
          userId: request.userId,
          message: request.message,
          location: request.location,
          emergencyType: request.emergencyType,
          timestamp: Date.now(),
        },
      });

      if (error) {
        console.error("❌ Server SMS error:", error);
        return {
          success: false,
          sentCount: 0,
          error: error.message || "Failed to send SMS through server",
        };
      }

      if (data) {
        console.log("✅ Server SMS response:", data);
        return {
          success: data.success || false,
          sentCount: data.sentCount || 0,
          error: data.error,
          messageId: data.messageId,
        };
      }

      return {
        success: false,
        sentCount: 0,
        error: "No response from SMS server",
      };
    } catch (error) {
      console.error("❌ Error calling SMS server:", error);
      return {
        success: false,
        sentCount: 0,
        error: "Failed to connect to SMS server",
      };
    }
  }

  // Send fall detection alert
  static async sendFallAlert(
    userId: string,
    magnitude: number,
    gyroscopeMagnitude: number,
    location?: { latitude: number; longitude: number }
  ): Promise<SMSResponse> {
    const alertMessage = `🚨 FALL DETECTED 🚨
EquiHUB: Fall during ride
Time: ${new Date().toLocaleTimeString()}
Impact: ${magnitude.toFixed(1)}g
Check safety!`;

    return this.sendEmergencyAlert({
      userId,
      message: alertMessage,
      location,
      emergencyType: "fall_detection",
    });
  }

  // Send manual emergency alert
  static async sendManualAlert(
    userId: string,
    customMessage?: string,
    location?: { latitude: number; longitude: number }
  ): Promise<SMSResponse> {
    const alertMessage = customMessage || `🚨 EMERGENCY 🚨
EquiHUB rider needs help
Time: ${new Date().toLocaleTimeString()}
Check safety now!`;

    return this.sendEmergencyAlert({
      userId,
      message: alertMessage,
      location,
      emergencyType: "manual_emergency",
    });
  }

  // Send test alert
  static async sendTestAlert(
    userId: string,
    location?: { latitude: number; longitude: number }
  ): Promise<SMSResponse> {
    const testMessage = `🧪 TEST 🧪
EquiHUB emergency test
Time: ${new Date().toLocaleTimeString()}
System working!`;

    return this.sendEmergencyAlert({
      userId,
      message: testMessage,
      location,
      emergencyType: "test",
    });
  }

  // Get SMS delivery status (if supported by SMS provider)
  static async getSMSStatus(messageId: string): Promise<{
    status: "pending" | "sent" | "delivered" | "failed";
    timestamp?: number;
    error?: string;
  }> {
    try {
      const supabase = getSupabase();
      
      const { data, error } = await supabase.functions.invoke("get-sms-status", {
        body: { messageId },
      });

      if (error) {
        return { status: "failed", error: error.message };
      }

      return data || { status: "pending" };
    } catch (error) {
      console.error("Error getting SMS status:", error);
      return { status: "failed", error: "Failed to check SMS status" };
    }
  }
}
