// SMS Character Count Verification
// This script helps verify that SMS messages are under 153 characters

// Fall Detection Alert (without location URL)
const fallAlert = `🚨 FALL DETECTED 🚨
EquiHUB: Fall during ride
Time: ${new Date().toLocaleTimeString()}
Impact: 8.2g
Check safety!`;

// Manual Emergency Alert (without location URL)  
const manualAlert = `🚨 EMERGENCY 🚨
EquiHUB rider needs help
Time: ${new Date().toLocaleTimeString()}
Check safety now!`;

// Test Alert (without location URL)
const testAlert = `🧪 TEST 🧪
EquiHUB emergency test
Time: ${new Date().toLocaleTimeString()}
System working!`;

// Test message from SMS utility
const testMessage = "🧪 TEST: Manual EquiHUB emergency alert - please disregard";

console.log("SMS Character Count Verification");
console.log("================================");
console.log(`Fall Alert: ${fallAlert.length} characters`);
console.log(`Manual Alert: ${manualAlert.length} characters`);
console.log(`Test Alert: ${testAlert.length} characters`);
console.log(`Test Message: ${testMessage.length} characters`);
console.log("\nNote: Location URLs will add ~35-50 additional characters");
console.log("Total with location should be under 153 characters");

// Sample with location (typical Google Maps URL length)
const sampleLocationUrl = "\n\nLocation: https://maps.google.com/?q=37.7749,-122.4194";
console.log(`\nSample with location URL: ${(fallAlert + sampleLocationUrl).length} characters`);
