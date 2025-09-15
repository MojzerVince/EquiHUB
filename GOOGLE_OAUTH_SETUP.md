# Google OAuth Setup Guide for EquiHUB

## Overview

This guide helps you set up Google OAuth with native sign-in (modal popup) instead of web browser redirect.

## What Changed

- ✅ Removed web-based OAuth (no more browser redirects)
- ✅ Added native Google Sign-In with account picker modal
- ✅ Uses `@react-native-google-signin/google-signin` package
- ✅ Shows familiar Google account selection popup

## Setup Steps

### 1. Get Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.developers.google.com/)
2. Select your project or create a new one
3. Navigate to **"Credentials"** in the **"API & Services"** section
4. Click **"Create Credentials"** → **"OAuth 2.0 Client ID"**
5. Select **"Web application"** as the application type
6. Add your authorized redirect URIs (if required)
7. Copy the **Client ID** (it looks like: `123456789-abc123.apps.googleusercontent.com`)

### 2. Configure the OAuth Service

1. Open `lib/oauthService.ts`
2. Find the line: `webClientId: 'YOUR_GOOGLE_WEB_CLIENT_ID_HERE.apps.googleusercontent.com'`
3. Replace `YOUR_GOOGLE_WEB_CLIENT_ID_HERE.apps.googleusercontent.com` with your actual client ID

### 3. Configure app.json (if needed)

1. Open `app.json`
2. Find the Google Sign-In plugin configuration
3. Replace `YOUR_IOS_CLIENT_ID` with your iOS client ID (if you have one)

### 4. Test the Implementation

1. Run `npx expo start`
2. Test on Android/iOS device
3. The Google sign-in should show a native modal with account selection

## How It Works Now

### Before (Web OAuth)

- User taps "Sign in with Google"
- Opens web browser
- User signs in on Google's website
- Redirects back to app

### After (Native OAuth)

- User taps "Sign in with Google"
- Shows native Google modal/popup
- User selects account from list
- Signs in directly in the app

## Benefits

- ✅ No browser switching
- ✅ Familiar Google account picker UI
- ✅ Faster sign-in process
- ✅ Better user experience
- ✅ Works offline with cached accounts

## Troubleshooting

### "Google Play Services not available"

- This happens on emulators without Google Play
- Test on real device or emulator with Google Play

### "No ID token received"

- Check your webClientId configuration
- Ensure you're using the Web client ID, not Android/iOS client ID

### "Sign-in cancelled"

- User cancelled the sign-in process
- This is normal behavior

## Files Modified

- `lib/oauthService.ts` - Updated to use native Google Sign-In
- `app.json` - Added Google Sign-In plugin
- `components/OAuthButtons.tsx` - UI remains the same

## Next Steps

1. Replace the placeholder client ID with your actual Google client ID
2. Test the sign-in flow on a real device
3. Configure Supabase to accept Google OAuth tokens (if not already done)
