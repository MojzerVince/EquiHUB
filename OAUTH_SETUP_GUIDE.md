# OAuth Authentication Setup Guide for EquiHUB

## Overview

This guide helps you set up **platform-specific OAuth authentication** with Google, Apple, and Facebook for your EquiHUB app.

## Platform Support Matrix

| Provider | iOS | Android | Web |
| -------- | --- | ------- | --- |
| Google   | ✅  | ✅      | ✅  |
| Apple    | ✅  | ❌      | ❌  |
| Facebook | ✅  | ✅      | ✅  |

## What's Implemented

### ✅ Platform-Specific UI

- **Apple Sign-In**: Only shows on iOS devices
- **Google Sign-In**: Shows on all platforms
- **Facebook Sign-In**: Shows on all platforms
- **Automatic Supabase Integration**: All sign-ins save to your database

### ✅ Features

- Platform detection and conditional rendering
- Haptic feedback on button press
- Loading states and error handling
- Automatic user profile creation/update in Supabase
- Session management

## Setup Instructions

### 1. Google OAuth Setup

#### A. Get Google Credentials

1. Go to [Google Cloud Console](https://console.developers.google.com/)
2. Create/select your project
3. Navigate to **"Credentials"** → **"Create Credentials"** → **"OAuth 2.0 Client ID"**
4. Create credentials for:
   - **Web application** (for general use)
   - **Android** (optional, for better native integration)

#### B. Configure Environment Variables

Add to your `.env` file:

```env
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=your-android-client-id.apps.googleusercontent.com
```

### 2. Apple Sign-In Setup (iOS Only)

#### A. Apple Developer Configuration

1. Go to [Apple Developer Console](https://developer.apple.com/)
2. Navigate to **"Certificates, Identifiers & Profiles"**
3. Create/configure your App ID with **"Sign In with Apple"** capability
4. No additional code changes needed - works automatically on iOS!

#### B. Supabase Apple Configuration

1. In your Supabase project, go to **Authentication** → **Providers**
2. Enable **Apple** provider
3. Configure with your Apple Developer credentials

### 3. Facebook Login Setup

#### A. Facebook App Setup

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Create a new app or select existing
3. Add **Facebook Login** product
4. Configure OAuth redirect URIs:
   - `exp://localhost:19000/--/` (for development)
   - Your production URLs

#### B. Configure Environment Variables

Add to your `.env` file:

```env
EXPO_PUBLIC_FACEBOOK_APP_ID=your-facebook-app-id
```

#### C. Update app.json

Replace `YOUR_FACEBOOK_APP_ID` in `app.json`:

```json
[
  "expo-facebook",
  {
    "appId": "your-actual-facebook-app-id",
    "displayName": "EquiHUB"
  }
]
```

### 4. Supabase Database Setup

Create a `users` table in your Supabase database:

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  provider TEXT NOT NULL, -- 'google', 'apple', 'facebook'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_sign_in_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create RLS policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);
```

## Usage in Your App

```tsx
import { OAuthButtons } from "@/components/OAuthButtons";

const LoginScreen = () => {
  const handleAuthSuccess = (result) => {
    console.log("User signed in:", result.user);
    // Navigate to main app or update UI
  };

  const handleAuthError = (error) => {
    console.error("Auth error:", error);
    // Show error message
  };

  return (
    <OAuthButtons
      onSuccess={handleAuthSuccess}
      onError={handleAuthError}
      disabled={loading}
    />
  );
};
```

## Platform-Specific Behavior

### iOS Device

- Shows Google, Apple, and Facebook buttons
- Apple Sign-In uses native iOS modal
- Google Sign-In uses web OAuth (reliable on all Expo setups)

### Android Device

- Shows Google and Facebook buttons only
- Apple Sign-In button is automatically hidden
- Google Sign-In uses web OAuth

### Development vs Production

#### Development (Expo Go)

- Uses web OAuth for Google (opens browser)
- Apple Sign-In works natively on iOS
- Facebook works with proper app configuration

#### Production (Development Builds)

- Same behavior as development
- More reliable native integrations
- Better performance

## Troubleshooting

### Common Issues

#### "Apple Sign-In not available"

- Only works on physical iOS devices
- Not available on simulators or Android

#### "Google OAuth popup blocked"

- Enable popups in browser settings
- Ensure correct redirect URLs

#### "Facebook App ID not configured"

- Check `EXPO_PUBLIC_FACEBOOK_APP_ID` environment variable
- Verify app.json configuration

### Error Messages

The system provides helpful error messages:

- **Platform availability**: "Apple Sign-In is only available on iOS"
- **Configuration issues**: "Facebook App ID not configured"
- **User cancellation**: "Google sign-in was cancelled"

## Files Modified

- `lib/oauthService.ts` - Complete OAuth implementation
- `components/OAuthButtons.tsx` - Platform-specific UI
- `app.json` - Facebook plugin configuration

## Testing Checklist

- [ ] Google sign-in works on iOS
- [ ] Google sign-in works on Android
- [ ] Apple sign-in works on iOS (hidden on Android)
- [ ] Facebook sign-in works on both platforms
- [ ] Users are saved to Supabase database
- [ ] Error handling works properly
- [ ] Loading states display correctly
