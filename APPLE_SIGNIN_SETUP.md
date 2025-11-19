# Apple Sign-In Setup Guide

Apple Sign-In is already implemented in your EquiHUB app! This guide will help you complete the configuration.

## ✅ Already Implemented

1. **Code Implementation**

   - ✅ `OAuthButtons` component with Apple button (iOS only)
   - ✅ `oauthService.signInWithApple()` method
   - ✅ Apple authentication icon
   - ✅ `expo-apple-authentication` dependency
   - ✅ Plugin added to `app.config.js`

2. **Integration**
   - ✅ Login screen (`/app/login.tsx`) uses OAuthButtons
   - ✅ Register screen (`/app/register-simple.tsx`) uses OAuthButtons
   - ✅ Handles both new and existing users

## 🔧 Configuration Required

### 1. Apple Developer Account Setup

#### Step 1: Enable Sign In with Apple Capability

1. Go to [Apple Developer Portal](https://developer.apple.com/account)
2. Navigate to **Certificates, Identifiers & Profiles**
3. Select **Identifiers**
4. Find your app identifier: `com.mojzi1969.EquiHUB`
5. Click on it to edit
6. Scroll down and check **Sign In with Apple**
7. Click **Edit** next to Sign In with Apple
8. Select **Enable as a primary App ID**
9. Click **Save**
10. Click **Save** again on the main identifier page

#### Step 2: Create a Services ID (for Supabase)

1. In **Certificates, Identifiers & Profiles**, click the **+** button
2. Select **Services IDs** and click **Continue**
3. Fill in:
   - **Description**: EquiHUB Web Auth
   - **Identifier**: `com.mojzi1969.EquiHUB.auth` (or similar)
4. Click **Continue** and **Register**
5. Click on your new Services ID
6. Check **Sign In with Apple**
7. Click **Configure**
8. In the configuration:
   - **Primary App ID**: Select `com.mojzi1969.EquiHUB`
   - **Website URLs**:
     - **Domains**: `grdsqxwghajehneksxik.supabase.co`
     - **Return URLs**: `https://grdsqxwghajehneksxik.supabase.co/auth/v1/callback`
9. Click **Save**
10. Click **Continue** and **Save**

#### Step 3: Create a Key for Apple Sign In

1. Go to **Keys** section
2. Click the **+** button
3. Fill in:
   - **Key Name**: EquiHUB Apple Auth Key
4. Check **Sign In with Apple**
5. Click **Configure**
6. Select your Primary App ID: `com.mojzi1969.EquiHUB`
7. Click **Save**
8. Click **Continue** and **Register**
9. **IMPORTANT**: Download the key file (`.p8`) - you can only download it once!
10. Note down:
    - **Key ID** (shown after creation) D99G99S9CQ
    - **Team ID** (shown at the top right of the page) NLMGF499CX

### 2. Supabase Configuration

#### Generate the OAuth Secret Key

Before configuring Supabase, you need to generate the OAuth secret key (JWT token):

**Option A: Use the Script (Recommended)**

1. Make sure you have Node.js installed
2. Install jsonwebtoken:
   ```bash
   cd /Users/mojzervince/Desktop/EquiHUB
   npm install jsonwebtoken
   ```
3. Place your `.p8` key file in the `scripts/` directory
4. Run the generator script:
   ```bash
   node scripts/generate-apple-secret.js
   ```
5. Copy the generated secret key (valid for 6 months)

**Option B: Use an Online Tool**

1. Go to https://developer.okta.com/blog/2019/06/04/what-the-heck-is-sign-in-with-apple#how-sign-in-with-apple-works-hint-it-uses-oauth-and-oidc
2. Use their JWT generator with:
   - Team ID: `NLMGF499CX`
   - Key ID: `D99G99S9CQ`
   - Client ID: `com.mojzi1969.EquiHUB.auth`
   - Your `.p8` key content

#### Configure in Supabase Dashboard

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your EquiHUB project
3. Go to **Authentication** → **Providers**
4. Find **Apple** in the list and click on it
5. Enable **Apple enabled**
6. Fill in the required fields:

   **Client IDs:**

   ```
   com.mojzi1969.EquiHUB.auth,com.mojzi1969.EquiHUB
   ```

   _(First is Services ID for web/OAuth, second is iOS Bundle ID for native)_

   **Secret Key (for OAuth):**

   - Paste the JWT token you generated in the step above
   - This is NOT the raw `.p8` file content
   - This is a JWT token that expires in 6 months

   **Allow users without an email:**

   - ✅ Check this box
   - Allows users who choose "Hide My Email" to still authenticate

   **Callback URL (for OAuth):**

   ```
   https://grdsqxwghajehneksxik.supabase.co/auth/v1/callback
   ```

   _(This should be pre-filled by Supabase)_

7. Click **Save**

#### Important Notes:

- ⏰ The secret key expires every 6 months - you'll need to regenerate it
- 📧 Enable "Allow users without an email" to support Apple's "Hide My Email" feature
- 🔄 Set a reminder to regenerate the secret key before it expires

### 3. Update Your iOS Bundle

If you haven't already, make sure your iOS app is configured with the correct bundle identifier:

1. Open your project in Xcode or rebuild with EAS
2. Ensure the bundle identifier matches: `com.mojzi1969.EquiHUB`
3. Ensure the Sign In with Apple capability is enabled in Xcode:
   - Select your target
   - Go to **Signing & Capabilities**
   - Click **+ Capability**
   - Add **Sign In with Apple**

### 4. Rebuild Your App

After making these changes, rebuild your app:

```bash
# For development build
npx expo run:ios

# Or for EAS build
eas build --platform ios --profile development
```

## 🧪 Testing

1. Run the app on a real iOS device (Apple Sign-In doesn't work on simulators without extra setup)
2. Navigate to the login or register screen
3. You should see the "Continue with Apple" button
4. Tap it and follow the Apple authentication flow

### Expected Behavior

**For New Users:**

1. User taps "Continue with Apple"
2. Apple authentication sheet appears
3. User authenticates with Face ID/Touch ID/Password
4. App checks if profile exists in database
5. If no profile exists → redirects to profile completion screen
6. If profile exists → logs user in and navigates to app

**For Existing Users:**

1. User taps "Continue with Apple"
2. Apple authentication sheet appears
3. User authenticates
4. App logs them in and navigates to app

## 🐛 Troubleshooting

### "Apple Sign-In is not available on this device"

- Make sure you're testing on a real iOS device, not a simulator
- Ensure you're signed in to iCloud on the device

### "No identity token received from Apple"

- Check that Sign In with Apple capability is enabled in Apple Developer Portal
- Verify the bundle identifier matches exactly
- Rebuild the app after making changes

### "Failed to sign in with Apple"

- Check Supabase Apple provider configuration
- Verify the Services ID matches
- Ensure the `.p8` key content is correct
- Check that the Team ID and Key ID are correct

### "Apple Sign-In was cancelled"

- This is normal - user cancelled the authentication
- No action needed

## 📱 Platform Availability

- ✅ **iOS**: Fully supported with native Apple Sign-In
- ❌ **Android**: Apple Sign-In button is hidden on Android (platform-specific rendering)
- ❌ **Web**: Not configured (can be added later if needed)

## 🔐 Security Features

The implementation includes:

- ✅ Nonce generation for each authentication request
- ✅ SHA-256 hashing of nonce
- ✅ Supabase session management
- ✅ Automatic token refresh
- ✅ Secure credential handling

## 📝 User Data Handling

When a user signs in with Apple, the app receives:

- User ID (from Apple)
- Email (if user chooses to share)
- Full Name (only on first sign-in, if user chooses to share)
- Avatar URL (if available)

**Note**: Apple allows users to hide their email. In this case, Apple provides a private relay email address.

## 🚀 Next Steps

1. Complete Apple Developer Portal setup
2. Configure Supabase Apple provider
3. Rebuild your iOS app
4. Test on a real device
5. Submit app for review (Apple Sign-In is required if you offer other social logins)

## 📚 Additional Resources

- [Apple Sign In with Supabase](https://supabase.com/docs/guides/auth/social-login/auth-apple)
- [Expo Apple Authentication](https://docs.expo.dev/versions/latest/sdk/apple-authentication/)
- [Apple Sign In Guidelines](https://developer.apple.com/design/human-interface-guidelines/sign-in-with-apple/overview/)
