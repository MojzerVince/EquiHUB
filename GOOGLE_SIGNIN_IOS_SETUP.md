# Google Sign-In iOS Setup Guide

## Issue
When building for iOS, you got the error:
```
RNGoogleSignin: `androidClientId` is not a valid configuration parameter
```

## What Was Fixed

### 1. Platform-Specific Configuration
Updated `/lib/googleAuth.ts` to use platform-specific client IDs:

**Before:**
```typescript
const config = {
  webClientId: GOOGLE_CONFIG.webClientId,
  androidClientId: GOOGLE_CONFIG.androidClientId, // ❌ This breaks iOS!
  offlineAccess: GOOGLE_CONFIG.offlineAccess,
  forceCodeForRefreshToken: GOOGLE_CONFIG.forceCodeForRefreshToken,
};
```

**After:**
```typescript
const config: any = {
  webClientId: GOOGLE_CONFIG.webClientId,
  offlineAccess: GOOGLE_CONFIG.offlineAccess,
  forceCodeForRefreshToken: GOOGLE_CONFIG.forceCodeForRefreshToken,
};

// Add platform-specific client IDs
if (Platform.OS === 'ios') {
  // iOS only accepts webClientId and iosClientId (if available)
  if (GOOGLE_CONFIG.iosClientId) {
    config.iosClientId = GOOGLE_CONFIG.iosClientId;
  }
} else if (Platform.OS === 'android') {
  // Android can use androidClientId
  if (GOOGLE_CONFIG.androidClientId) {
    config.androidClientId = GOOGLE_CONFIG.androidClientId;
  }
}
```

## Next Steps for iOS Google Sign-In

### Step 1: Get iOS OAuth Client ID from Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to **APIs & Services > Credentials**
4. Click **+ CREATE CREDENTIALS > OAuth client ID**
5. Select **iOS** as the application type
6. Enter your Bundle ID: `com.mojzi1969.EquiHUB`
7. Click **CREATE**
8. Copy the **Client ID** that starts with something like `123456789.apps.googleusercontent.com`

### Step 2: Download GoogleService-Info.plist

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (or create one if you don't have it)
3. Click the gear icon ⚙️ > **Project settings**
4. Scroll to **Your apps** section
5. Click on your iOS app (or add one if not exists)
   - iOS bundle ID: `com.mojzi1969.EquiHUB`
6. Download the `GoogleService-Info.plist` file
7. Place it in your project root: `/Users/mojzervince/Desktop/EquiHUB/GoogleService-Info.plist`

### Step 3: Add Environment Variable

Create a `.env` file in your project root (if it doesn't exist) and add:

```bash
# Google OAuth Client IDs
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=your-android-client-id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=your-ios-client-id.apps.googleusercontent.com
```

> **Note:** If you don't have a separate iOS client ID, you can use the same Web Client ID for both. The `webClientId` is required, but `iosClientId` is optional.

### Step 4: Update app.json (if using GoogleService-Info.plist)

If you're using Firebase, you may need to configure the iOS section in `app.json`:

```json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.mojzi1969.EquiHUB",
      "googleServicesFile": "./GoogleService-Info.plist",
      "config": {
        "googleMapsApiKey": "AIzaSyB_ZII2Yw2nnuJAYXOeaGr4ifWSgVJmXHg"
      }
    }
  }
}
```

### Step 5: Configure URL Scheme

The iOS app needs to handle the OAuth callback. Update `app.json`:

```json
{
  "expo": {
    "scheme": "EquiHUB",
    "ios": {
      "bundleIdentifier": "com.mojzi1969.EquiHUB",
      "infoPlist": {
        "CFBundleURLTypes": [
          {
            "CFBundleURLSchemes": ["com.googleusercontent.apps.YOUR-IOS-CLIENT-ID-REVERSED"]
          }
        ]
      }
    }
  }
}
```

Replace `YOUR-IOS-CLIENT-ID-REVERSED` with your iOS Client ID reversed. For example:
- If your iOS Client ID is: `123456789-abc123.apps.googleusercontent.com`
- Your reversed scheme is: `com.googleusercontent.apps.123456789-abc123`

### Step 6: Rebuild the iOS App

After making these changes, rebuild your iOS app:

```bash
# Clean build
rm -rf ios/build
cd ios && pod install && cd ..

# Rebuild
npx expo run:ios
```

## Alternative: Use Web Client ID Only

If you don't want to set up a separate iOS client ID, you can use just the Web Client ID:

1. Make sure `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` is set in your environment
2. The code will work with just the `webClientId` - the `iosClientId` is optional
3. The app will use the web OAuth flow if native sign-in fails

## Troubleshooting

### Error: "No client ID provided"
- Make sure `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` is set in your `.env` file
- Restart the Metro bundler after adding environment variables

### Error: "Google Play Services not available"
- This is expected on iOS - the app will fall back to web OAuth flow
- Make sure the web flow is working properly

### Error: "Invalid client ID"
- Double-check your client IDs in Google Cloud Console
- Make sure the bundle ID matches: `com.mojzi1969.EquiHUB`
- Verify the URL scheme is correctly configured

### Still seeing "androidClientId" error?
- Make sure you've rebuilt the app completely
- Try clearing Metro cache: `npx expo start -c`
- Check that the changes in `googleAuth.ts` are saved

## Current Configuration Status

✅ **Fixed:** Platform-specific client ID configuration in `googleAuth.ts`
✅ **Fixed:** iOS configuration only uses `webClientId` and optional `iosClientId`
✅ **Fixed:** Android configuration uses `androidClientId`

⚠️ **Needs Setup:** 
- iOS OAuth Client ID from Google Cloud Console
- GoogleService-Info.plist (optional, for Firebase)
- Environment variables for client IDs
- URL scheme configuration in app.json

## Files Modified

1. `/lib/googleAuth.ts` - Platform-specific configuration logic
2. This guide created: `/GOOGLE_SIGNIN_IOS_SETUP.md`

## References

- [React Native Google Sign-In Documentation](https://github.com/react-native-google-signin/google-signin)
- [Expo Authentication with Google](https://docs.expo.dev/guides/authentication/#google)
- [Google OAuth 2.0 Setup](https://developers.google.com/identity/protocols/oauth2)
