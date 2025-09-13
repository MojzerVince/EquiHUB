# Google OAuth Client Secret Guide

## Current Status
You have: Android Client ID (`645905000706-r5d9rejr3lakueqrhl1tk7ldmpv2jt2v.apps.googleusercontent.com`)
You need: Web Application Client ID + Client Secret for Supabase

## Step-by-Step: Getting Client Secret

### 1. Google Cloud Console Setup
- URL: https://console.cloud.google.com
- Make sure you're in your EquiHUB project

### 2. Create Web Application OAuth Client
```
APIs & Services → Credentials → + CREATE CREDENTIALS → OAuth client ID
```

**Configuration:**
- Application type: `Web application`
- Name: `EquiHUB Web`
- Authorized redirect URIs: 
  - `https://grdsqxwghajehneksxik.supabase.co/auth/v1/callback`

### 3. After Creation - You'll Get:
```
Client ID: 645905000706-XXXXXXXXXX.apps.googleusercontent.com
Client secret: GOCSPX-XXXXXXXXXXXXXXXXX
```

### 4. What Goes Where:

**In Supabase (Authentication → Providers → Google):**
- Client ID: `[Your Web Client ID]`
- Client Secret: `[Your Web Client Secret]`

**In Your App (`oauthConfig.ts`):**
- androidClientId: `645905000706-r5d9rejr3lakueqrhl1tk7ldmpv2jt2v.apps.googleusercontent.com` ✅ (you have this)
- webClientId: `[Your Web Client ID]` ❌ (need to add)
- iosClientId: `[Your iOS Client ID]` ❌ (need to create for iOS)

## Important Notes:

1. **Android Client ID** ≠ **Web Client ID**
   - Android: Used by the mobile app
   - Web: Used by Supabase server

2. **You need BOTH**:
   - Web credentials for Supabase backend
   - Mobile credentials for app frontend

3. **Client Secret** only exists for Web Application type
   - Android/iOS clients don't have secrets
   - Only Web application clients have secrets

## Next Steps:
1. Create Web Application OAuth client in Google Cloud Console
2. Copy Web Client ID + Secret to Supabase
3. Add Web Client ID to your `oauthConfig.ts`
4. Test OAuth flow

## Quick Check:
- [ ] Web Application OAuth client created
- [ ] Client Secret obtained
- [ ] Added to Supabase Authentication settings
- [ ] Updated oauthConfig.ts with Web Client ID
