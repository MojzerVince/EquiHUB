import { BackgroundFallDetectionAPI } from "../lib/backgroundFallDetectionAPI";
import { FallDetectionAPI } from "../lib/fallDetectionAPI";

/**
 * Test suite for background fall detection functionality
 * Run these tests to verify the implementation works correctly
 */

// Mock user ID for testing
const TEST_USER_ID = "test_user_123";

/**
 * Test 1: Basic Background Fall Detection Setup
 * Verifies that background monitoring can be started and stopped
 */
export async function testBackgroundFallDetectionSetup(): Promise<boolean> {
  console.log("🧪 Testing background fall detection setup...");
  
  try {
    // Test starting background monitoring
    const started = await BackgroundFallDetectionAPI.startBackgroundMonitoring(TEST_USER_ID);
    console.log(`✅ Background monitoring started: ${started}`);
    
    if (!started) {
      console.error("❌ Failed to start background monitoring");
      return false;
    }
    
    // Test monitoring status
    const isActive = BackgroundFallDetectionAPI.isMonitoringActive();
    console.log(`✅ Background monitoring active: ${isActive}`);
    
    if (!isActive) {
      console.error("❌ Background monitoring not reported as active");
      return false;
    }
    
    // Test stopping background monitoring
    await BackgroundFallDetectionAPI.stopBackgroundMonitoring();
    const isStillActive = BackgroundFallDetectionAPI.isMonitoringActive();
    console.log(`✅ Background monitoring stopped: ${!isStillActive}`);
    
    if (isStillActive) {
      console.error("❌ Background monitoring still active after stop");
      return false;
    }
    
    console.log("✅ Background fall detection setup test PASSED");
    return true;
    
  } catch (error) {
    console.error("❌ Background fall detection setup test FAILED:", error);
    return false;
  }
}

/**
 * Test 2: Configuration Management
 * Verifies that configuration can be updated and retrieved
 */
export async function testConfigurationManagement(): Promise<boolean> {
  console.log("🧪 Testing configuration management...");
  
  try {
    // Test default configuration
    const defaultConfig = await BackgroundFallDetectionAPI.getConfig();
    console.log("✅ Got default config:", defaultConfig);
    
    // Test updating configuration
    const newConfig = {
      accelerationThreshold: 3.0,
      gyroscopeThreshold: 6.0,
      recoveryTimeout: 15000,
    };
    
    await BackgroundFallDetectionAPI.updateConfig(newConfig);
    console.log("✅ Updated configuration");
    
    // Test retrieving updated configuration
    const updatedConfig = await BackgroundFallDetectionAPI.getConfig();
    console.log("✅ Retrieved updated config:", updatedConfig);
    
    // Verify the updates were applied
    if (updatedConfig.accelerationThreshold !== 3.0 || 
        updatedConfig.gyroscopeThreshold !== 6.0 || 
        updatedConfig.recoveryTimeout !== 15000) {
      console.error("❌ Configuration update verification failed");
      return false;
    }
    
    console.log("✅ Configuration management test PASSED");
    return true;
    
  } catch (error) {
    console.error("❌ Configuration management test FAILED:", error);
    return false;
  }
}

/**
 * Test 3: Enhanced Fall Detection API
 * Verifies that the main API properly handles background integration
 */
export async function testEnhancedFallDetectionAPI(): Promise<boolean> {
  console.log("🧪 Testing enhanced fall detection API...");
  
  try {
    // Test starting monitoring with background enabled
    const started = await FallDetectionAPI.startMonitoring(TEST_USER_ID, true);
    console.log(`✅ Enhanced monitoring started: ${started}`);
    
    if (!started) {
      console.error("❌ Failed to start enhanced monitoring");
      return false;
    }
    
    // Test foreground monitoring status
    const isForegroundActive = FallDetectionAPI.isActivelyMonitoring();
    console.log(`✅ Foreground monitoring active: ${isForegroundActive}`);
    
    // Test background monitoring status
    const isBackgroundActive = FallDetectionAPI.isBackgroundMonitoringActive();
    console.log(`✅ Background monitoring active: ${isBackgroundActive}`);
    
    // Test getting all fall events (should include background events)
    const allEvents = await FallDetectionAPI.getAllFallEvents();
    console.log(`✅ Retrieved ${allEvents.length} fall events (including background)`);
    
    // Test stopping monitoring (should stop both foreground and background)
    await FallDetectionAPI.stopMonitoring();
    
    const isForegroundStillActive = FallDetectionAPI.isActivelyMonitoring();
    const isBackgroundStillActive = FallDetectionAPI.isBackgroundMonitoringActive();
    
    console.log(`✅ Foreground monitoring stopped: ${!isForegroundStillActive}`);
    console.log(`✅ Background monitoring stopped: ${!isBackgroundStillActive}`);
    
    if (isForegroundStillActive || isBackgroundStillActive) {
      console.error("❌ Some monitoring still active after stop");
      return false;
    }
    
    console.log("✅ Enhanced fall detection API test PASSED");
    return true;
    
  } catch (error) {
    console.error("❌ Enhanced fall detection API test FAILED:", error);
    return false;
  }
}

/**
 * Test 4: Storage and Retrieval
 * Verifies that fall events are properly stored and can be retrieved
 */
export async function testStorageAndRetrieval(): Promise<boolean> {
  console.log("🧪 Testing storage and retrieval...");
  
  try {
    // Start background monitoring
    await BackgroundFallDetectionAPI.startBackgroundMonitoring(TEST_USER_ID);
    
    // Get initial events count
    const initialEvents = await BackgroundFallDetectionAPI.getStoredFallEvents();
    console.log(`✅ Initial stored events: ${initialEvents.length}`);
    
    // Note: We can't easily simulate a real fall event in testing
    // without actually triggering the sensors, so we'll just verify
    // the storage mechanism is working by checking the method exists
    // and returns the correct type
    
    if (!Array.isArray(initialEvents)) {
      console.error("❌ Stored events should return an array");
      return false;
    }
    
    // Clean up
    await BackgroundFallDetectionAPI.stopBackgroundMonitoring();
    
    console.log("✅ Storage and retrieval test PASSED");
    return true;
    
  } catch (error) {
    console.error("❌ Storage and retrieval test FAILED:", error);
    return false;
  }
}

/**
 * Run all tests
 */
export async function runAllBackgroundFallDetectionTests(): Promise<void> {
  console.log("🚀 Starting background fall detection tests...");
  
  const tests = [
    testBackgroundFallDetectionSetup,
    testConfigurationManagement,
    testEnhancedFallDetectionAPI,
    testStorageAndRetrieval,
  ];
  
  let passedTests = 0;
  let totalTests = tests.length;
  
  for (const test of tests) {
    try {
      const passed = await test();
      if (passed) {
        passedTests++;
      }
    } catch (error) {
      console.error("❌ Test execution error:", error);
    }
    console.log(""); // Add spacing between tests
  }
  
  console.log(`📊 Test Results: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log("🎉 All background fall detection tests PASSED!");
  } else {
    console.log("⚠️ Some tests failed. Check the logs above for details.");
  }
}

// Usage example:
// import { runAllBackgroundFallDetectionTests } from './tests/backgroundFallDetectionTests';
// runAllBackgroundFallDetectionTests();
