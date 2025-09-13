# Google OAuth Setup for EquiHUB

## Step 1: Google Cloud Console Setup

1. **Go to Google Cloud Console**: https://console.cloud.google.com
2. **Select or Create Project**: Choose your EquiHUB project
3. **Enable APIs**:
   - Go to "APIs & Services" → "Library"
   - Search and enable: "Google+ API" and "People API"

## Step 2: Create OAuth 2.0 Credentials

### Create Web Application Credentials (for Supabase):

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Choose "Web application"
4. Name: "EquiHUB Web"
5. **Authorized redirect URIs**:
   - `https://grdsqxwghajehneksxik.supabase.co/auth/v1/callback`

### Create iOS Application Credentials:

1. Click "Create Credentials" → "OAuth client ID"
2. Choose "iOS"
3. Name: "EquiHUB iOS"
4. **Bundle ID**: `com.mojzi1969.EquiHUB`

### Create Android Application Credentials:

1. Click "Create Credentials" → "OAuth client ID"
2. Choose "Android"
3. Name: "EquiHUB Android"
4. **Package name**: `com.mojzi1969.EquiHUB`
5. **SHA-1 certificate fingerprint**: (You'll need to get this from your development keystore)

## Step 3: Get SHA-1 Fingerprint for Android

Run this command in your project directory:

```bash
cd android && ./gradlew signingReport
```

Or for development, use:

```bash
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
```

## Step 4: Configure Supabase

1. Go to your Supabase dashboard: https://supabase.com/dashboard/project/grdsqxwghajehneksxik
2. Navigate to Authentication → Providers
3. Enable Google provider
4. Add your **Web Client ID** and **Client Secret** from Google Cloud Console
5. Redirect URL should be: `https://grdsqxwghajehneksxik.supabase.co/auth/v1/callback`

## Step 5: Update Your App Configuration

After getting the credentials, update `lib/oauthConfig.ts` with your actual client IDs.

## Temporary Workaround

If you want to test quickly, you can temporarily disable OAuth and use email/password authentication while setting up Google OAuth properly.
