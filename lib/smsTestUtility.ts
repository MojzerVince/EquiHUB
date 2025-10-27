import { ServerSMSAPI } from "./serverSMSAPI";

export class SMSTestUtility {
  // Test server SMS functionality
  static async testServerSMS(userId: string): Promise<void> {
    console.log("🧪 Testing server SMS functionality...");

    try {
      // Test 1: Basic connectivity test
      console.log("📡 Test 1: Testing server connectivity...");
      
      const testResult = await ServerSMSAPI.sendTestAlert(userId, {
        latitude: 37.7749,
        longitude: -122.4194, // San Francisco coordinates for testing
      });

      if (testResult.success) {
        console.log("✅ Test 1 PASSED: Server SMS connectivity working");
        console.log(`📊 Sent to ${testResult.sentCount} contacts`);
        
        if (testResult.messageId) {
          // Test 2: Status checking
          console.log("📋 Test 2: Testing status checking...");
          
          // Wait a moment for status to update
          setTimeout(async () => {
            try {
              const status = await ServerSMSAPI.getSMSStatus(testResult.messageId!);
              console.log("✅ Test 2 PASSED: Status checking working");
              console.log(`📊 Status: ${status.status}`);
            } catch (error) {
              console.log("❌ Test 2 FAILED: Status checking failed", error);
            }
          }, 2000);
        }
      } else {
        console.log("❌ Test 1 FAILED: Server SMS not working");
        console.log(`💬 Error: ${testResult.error}`);
      }
    } catch (error) {
      console.log("❌ Test FAILED: Exception occurred", error);
    }
  }

  // Test fall detection SMS
  static async testFallDetectionSMS(userId: string, riderName?: string): Promise<void> {
    console.log("🚨 Testing fall detection SMS...");

    try {
      const result = await ServerSMSAPI.sendFallAlert(
        userId,
        3.2, // acceleration magnitude
        {
          latitude: 37.7749,
          longitude: -122.4194,
        },
        riderName || "Test Rider"
      );

      if (result.success) {
        console.log("✅ Fall detection SMS test PASSED");
        console.log(`📊 Sent to ${result.sentCount} contacts`);
      } else {
        console.log("❌ Fall detection SMS test FAILED");
        console.log(`💬 Error: ${result.error}`);
      }
    } catch (error) {
      console.log("❌ Fall detection SMS test FAILED with exception", error);
    }
  }

  // Test manual emergency SMS
  static async testManualEmergencySMS(userId: string): Promise<void> {
    console.log("🆘 Testing manual emergency SMS...");

    try {
      const result = await ServerSMSAPI.sendManualAlert(
        userId,
        "🧪 TEST: Manual EquiHUB emergency alert - please disregard",
        {
          latitude: 37.7749,
          longitude: -122.4194,
        }
      );

      if (result.success) {
        console.log("✅ Manual emergency SMS test PASSED");
        console.log(`📊 Sent to ${result.sentCount} contacts`);
      } else {
        console.log("❌ Manual emergency SMS test FAILED");
        console.log(`💬 Error: ${result.error}`);
      }
    } catch (error) {
      console.log("❌ Manual emergency SMS test FAILED with exception", error);
    }
  }

  // Run all tests
  static async runAllTests(userId: string, riderName?: string): Promise<void> {
    console.log("🔍 Running all SMS tests...");
    
    await this.testServerSMS(userId);
    
    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    await this.testFallDetectionSMS(userId, riderName);
    
    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    await this.testManualEmergencySMS(userId);
    
    console.log("🏁 All SMS tests completed");
  }

  // Validate SMS setup
  static async validateSetup(userId: string): Promise<{
    isSetup: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
      // Check if user has emergency contacts (this would need to be implemented)
      // For now, we'll just test the server connection
      
      console.log("🔍 Validating SMS setup...");
      
      const testResult = await ServerSMSAPI.sendTestAlert(userId);
      
      if (!testResult.success) {
        issues.push("Server SMS is not working: " + testResult.error);
        
        if (testResult.error?.includes("no emergency contacts")) {
          recommendations.push("Add emergency contacts in the app settings");
        } else if (testResult.error?.includes("server")) {
          recommendations.push("Check Supabase Edge Function deployment");
        } else if (testResult.error?.includes("SMS service not configured")) {
          recommendations.push("Configure Twilio credentials in Supabase secrets");
        }
      }
      
      if (testResult.sentCount === 0) {
        issues.push("No SMS messages were sent");
        recommendations.push("Verify emergency contacts are enabled");
      }
      
    } catch (error) {
      issues.push("Failed to connect to SMS server: " + error);
      recommendations.push("Check internet connection and Supabase configuration");
    }

    return {
      isSetup: issues.length === 0,
      issues,
      recommendations,
    };
  }

  // Quick test - just test basic SMS functionality
  static async quickSMSTest(userId: string, riderName?: string): Promise<boolean> {
    console.log("⚡ Running quick SMS test...");
    
    try {
      const result = await ServerSMSAPI.sendTestAlert(userId, {
        latitude: 37.7749,
        longitude: -122.4194,
      });

      const success = result.success && result.sentCount > 0;
      
      if (success) {
        console.log("✅ Quick SMS test PASSED");
        console.log(`📊 Sent to ${result.sentCount} contacts`);
      } else {
        console.log("❌ Quick SMS test FAILED");
        console.log(`💬 Error: ${result.error || 'No SMS sent'}`);
      }
      
      return success;
    } catch (error) {
      console.log("❌ Quick SMS test FAILED with exception", error);
      return false;
    }
  }
}
