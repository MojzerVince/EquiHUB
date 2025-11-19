/**
 * Apple Sign-In Secret Generator for Supabase
 * 
 * This script generates the OAuth secret key (JWT) needed for Apple Sign-In in Supabase.
 * 
 * Prerequisites:
 * 1. You must have downloaded the .p8 key file from Apple Developer Portal
 * 2. Install jsonwebtoken: npm install jsonwebtoken
 * 
 * Usage:
 * 1. Save your .p8 key file in this directory
 * 2. Update the constants below with your values
 * 3. Run: node scripts/generate-apple-secret.js
 */

const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

// ============================================
// UPDATE THESE VALUES WITH YOUR INFORMATION
// ============================================

const TEAM_ID = 'NLMGF499CX';  // Your Apple Team ID (10 characters)
const KEY_ID = 'D99G99S9CQ';   // Your Key ID from Apple (10 characters)
const SERVICE_ID = 'com.mojzi1969.EquiHUB.auth';  // Your Services ID created in Apple Developer Portal
const P8_KEY_FILE = 'AuthKey_D99G99S9CQ.p8';  // Name of your .p8 file

// ============================================
// DO NOT MODIFY BELOW THIS LINE
// ============================================

try {
  console.log('🔐 Apple Sign-In Secret Generator\n');
  console.log('Configuration:');
  console.log(`  Team ID: ${TEAM_ID}`);
  console.log(`  Key ID: ${KEY_ID}`);
  console.log(`  Service ID: ${SERVICE_ID}`);
  console.log(`  Key File: ${P8_KEY_FILE}\n`);

  // Read the .p8 private key file
  const keyPath = path.join(__dirname, P8_KEY_FILE);
  
  if (!fs.existsSync(keyPath)) {
    console.error('❌ Error: .p8 key file not found!');
    console.error(`   Expected location: ${keyPath}`);
    console.error('\nPlease:');
    console.error('1. Download your .p8 key from Apple Developer Portal');
    console.error('2. Place it in the scripts/ directory');
    console.error('3. Update the P8_KEY_FILE constant in this script');
    process.exit(1);
  }

  const privateKey = fs.readFileSync(keyPath, 'utf8');
  console.log('✅ Private key file loaded\n');

  // Generate the JWT (valid for 6 months = 15780000 seconds)
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + 15780000; // 6 months from now

  const token = jwt.sign(
    {
      iss: TEAM_ID,
      iat: now,
      exp: expiresAt,
      aud: 'https://appleid.apple.com',
      sub: SERVICE_ID,
    },
    privateKey,
    {
      algorithm: 'ES256',
      keyid: KEY_ID,
      header: {
        alg: 'ES256',
        kid: KEY_ID,
      },
    }
  );

  console.log('🎉 Secret Key Generated Successfully!\n');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('Copy the following secret key and paste it into Supabase:');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(token);
  console.log('\n═══════════════════════════════════════════════════════════\n');
  
  const expiryDate = new Date(expiresAt * 1000);
  console.log(`⏰ This secret expires on: ${expiryDate.toLocaleDateString()}`);
  console.log('   Remember to generate a new one before this date!\n');

  console.log('📝 Next Steps:');
  console.log('1. Copy the secret key above');
  console.log('2. Go to Supabase Dashboard → Authentication → Providers → Apple');
  console.log('3. Paste it in the "Secret Key (for OAuth)" field');
  console.log('4. Save your changes\n');

} catch (error) {
  console.error('❌ Error generating secret:', error.message);
  
  if (error.message.includes('jsonwebtoken')) {
    console.error('\n💡 Please install jsonwebtoken:');
    console.error('   npm install jsonwebtoken');
  }
  
  process.exit(1);
}
