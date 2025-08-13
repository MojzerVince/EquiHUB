# 🔐 API Keys Setup Guide

All API keys have been removed from the codebase for security reasons and replaced with `API_KEY_HERE`. Before building or running the application, you need to replace these placeholders with your actual API keys.

## Files that need API key configuration:

### 1. `lib/supabase.ts`

Replace the following:

- `supabaseUrl`: Your Supabase project URL (e.g., `https://yourproject.supabase.co`)
- `supabaseAnonKey`: Your Supabase anon/public key

### 2. `lib/horseAPI.ts`

Replace all instances of:

- `API_KEY_HERE` with your Supabase URL and anon key (same as above)

### 3. `app/(tabs)/profile.tsx`

Replace all instances of:

- `API_KEY_HERE` with your Supabase URL and anon key (same as above)

### 4. `app.json`

Replace:

- `projectId`: Your EAS project ID (if using Expo Application Services)

## Google Maps API (if using maps)

If you're using Google Maps, you'll also need to add your Google Maps API key to:

- `app.json` in the `ios.config.googleMapsApiKey` and `android.config.googleMaps.apiKey` sections

## Security Best Practices:

1. **Never commit API keys to version control**
2. **Use environment variables** for production builds
3. **Regenerate keys** if they've been exposed
4. **Use different keys** for development and production environments

## Getting Your API Keys:

### Supabase:

1. Go to [supabase.com](https://supabase.com)
2. Navigate to your project
3. Go to Settings > API
4. Copy the Project URL and anon/public key

### Google Maps API:

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Enable the Maps SDK for Android and iOS
3. Create API credentials
4. Copy the API key

### EAS Project ID:

1. Run `eas init` in your project
2. Or check your Expo dashboard for existing project ID

## Environment Variables (Recommended for Production):

Consider using environment variables instead of hardcoding keys:

```bash
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
EXPO_PUBLIC_GOOGLE_MAPS_KEY=your_google_maps_key
```
