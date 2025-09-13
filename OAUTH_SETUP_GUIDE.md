# OAuth Setup Guide for EquiHUB

This guide will help you configure Google and Apple OAuth authentication for your EquiHUB app.

## Prerequisites

- Supabase project with authentication enabled
- Google Cloud Console account (for Google OAuth)
- Apple Developer account (for Apple Sign-In, iOS only)

## 1. Supabase OAuth Configuration

### Enable OAuth Providers in Supabase

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** > **Providers**
3. Enable **Google** and **Apple** providers

### Configure Redirect URLs

Add these redirect URLs in your Supabase Auth settings:

- `equihub://auth/callback` (for mobile deep linking)
- `https://your-project-id.supabase.co/auth/v1/callback` (for web fallback)

## 2. Google OAuth Setup

### Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select an existing one
3. Enable the **Google+ API** and **People API**

### Configure OAuth Consent Screen

1. Go to **APIs & Services** > **OAuth consent screen**
2. Configure your app information:
   - App name: "EquiHUB"
   - User support email: Your email
   - Developer contact: Your email
3. Add scopes:
   - `openid`
   - `email`
   - `profile`

### Create OAuth 2.0 Client IDs

Create separate client IDs for each platform:

#### Web Client ID

1. **APIs & Services** > **Credentials** > **Create Credentials** > **OAuth client ID**
2. Application type: **Web application**
3. Name: "EquiHUB Web"
4. Authorized redirect URIs: `https://your-project-id.supabase.co/auth/v1/callback`

#### iOS Client ID

1. **APIs & Services** > **Credentials** > **Create Credentials** > **OAuth client ID**
2. Application type: **iOS**
3. Name: "EquiHUB iOS"
4. Bundle ID: `com.yourcompany.equihub` (must match your app.json)

#### Android Client ID

1. **APIs & Services** > **Credentials** > **Create Credentials** > **OAuth client ID**
2. Application type: **Android**
3. Name: "EquiHUB Android"
4. Package name: `com.yourcompany.equihub`
5. SHA-1 certificate fingerprint: Get from your keystore

### Update oauthConfig.ts

Replace the placeholder values in `lib/oauthConfig.ts`:

```typescript
export const oauthConfig = {
  google: {
    webClientId: "your-web-client-id.googleusercontent.com",
    iosClientId: "your-ios-client-id.googleusercontent.com",
    androidClientId: "your-android-client-id.googleusercontent.com",
    // ... rest of config
  },
  // ... rest of config
};
```

### Add Google Services Files

#### For iOS (GoogleService-Info.plist)

1. Download `GoogleService-Info.plist` from Google Cloud Console
2. Place it in your project root (where app.json is)
3. The file is already configured in `app.json`

#### For Android (google-services.json)

1. Download `google-services.json` from Google Cloud Console
2. Place it in your project root (where app.json is)
3. The file is already configured in `app.json`

## 3. Apple Sign-In Setup (iOS Only)

### Enable Sign In with Apple

1. Go to [Apple Developer Portal](https://developer.apple.com)
2. **Certificates, Identifiers & Profiles** > **Identifiers**
3. Select your App ID
4. Enable **Sign In with Apple** capability
5. Configure domains and redirect URLs:
   - Domain: `your-project-id.supabase.co`
   - Redirect URL: `https://your-project-id.supabase.co/auth/v1/callback`

### Configure Supabase Apple Provider

1. In Supabase Auth settings, configure Apple provider:
   - **Client ID**: Your app's bundle identifier (e.g., `com.yourcompany.equihub`)
   - **Secret**: Generate from Apple Developer Portal

### Generate Apple Secret

1. **Apple Developer Portal** > **Keys**
2. **Create a new key** with **Sign In with Apple** enabled
3. Download the `.p8` key file
4. Use Apple's JWT tool or online generator to create the secret

## 4. Update Supabase Configuration

### Add OAuth Client IDs to Supabase

1. **Supabase Dashboard** > **Authentication** > **Providers**
2. **Google Provider**:
   - Client ID: Your web client ID
   - Client Secret: Your Google client secret (from credentials)
3. **Apple Provider**:
   - Client ID: Your app bundle identifier
   - Secret: Generated JWT secret

## 5. Test OAuth Flow

### Test Google OAuth

1. Build your app with Expo/EAS
2. Test on both iOS and Android devices
3. Verify user creation in Supabase Auth dashboard

### Test Apple Sign-In (iOS Only)

1. Test on iOS device (doesn't work in simulator for Apple Sign-In)
2. Verify Apple ID integration
3. Check user data in Supabase

## 6. Production Considerations

### Security

- Keep all client secrets secure
- Use environment variables for sensitive config
- Regularly rotate secrets and keys

### App Store Compliance

- Apple requires Apple Sign-In if you offer other social logins
- Test thoroughly on actual devices
- Follow Apple's Human Interface Guidelines

### Error Handling

- Implement proper error handling for network issues
- Handle cancellation scenarios gracefully
- Provide fallback to email/password login

## Troubleshooting

### Common Issues

1. **"Invalid client" error**:

   - Check client IDs in oauthConfig.ts
   - Verify bundle ID matches everywhere

2. **Redirect URI mismatch**:

   - Check Supabase redirect URLs
   - Verify app.json scheme configuration

3. **Apple Sign-In not working**:

   - Test on real device, not simulator
   - Check Apple Developer Portal configuration

4. **Google Sign-In failing**:
   - Verify SHA-1 fingerprint for Android
   - Check Google Services files are in place

### Debug Mode

Enable debug logging in your app:

```typescript
// In your app, add this for debugging
console.log("OAuth Config:", oauthConfig);
```

## Support

If you encounter issues:

1. Check Supabase Auth logs
2. Review Expo/React Native logs
3. Verify all configuration files are in place
4. Test each platform separately

Remember to test on actual devices for the most accurate results, especially for Apple Sign-In which doesn't work in simulators.
