# Google Maps API Setup Instructions

## Steps to get your Google Maps API Key:

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/

2. **Create or Select a Project**
   - Create a new project or select an existing one

3. **Enable Required APIs**
   - Go to "APIs & Services" > "Library"
   - Search for and enable:
     - Maps SDK for Android
     - Maps SDK for iOS
     - Places API (optional, for future features)

4. **Create API Key**
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "API Key"
   - Copy the generated API key

5. **Secure your API Key (Recommended)**
   - Click on your API key to edit it
   - Under "Application restrictions":
     - For Android: Select "Android apps" and add your package name: `com.mojzi1969.EquiHUB`
     - For iOS: Select "iOS apps" and add your bundle identifier
   - Under "API restrictions": Select "Restrict key" and choose the APIs you enabled

6. **Add API Key to your app**
   - Open `app.json`
   - Replace `YOUR_GOOGLE_MAPS_API_KEY_HERE` with your actual API key

7. **Rebuild your app**
   - Run `npx expo prebuild --clean`
   - Then build for your platform

## Important Notes:

- Keep your API key secure and never commit it to public repositories
- Consider using environment variables for production apps
- Monitor your API usage in Google Cloud Console to avoid unexpected charges
- The Google Maps API has a generous free tier, but check current pricing

## Troubleshooting:

- If maps show as blank/gray: Check that your API key is correct and the APIs are enabled
- If you get permission errors: Ensure your app's package name/bundle ID matches what's configured in Google Cloud Console
- For development: You might want to allow unrestricted key usage initially, then restrict it later

## Alternative: Use Default Map Provider

If you prefer not to use Google Maps, you can change the MapView provider back to default:
- In `app/(tabs)/map.tsx`, remove `provider={PROVIDER_GOOGLE}` from the MapView component
- This will use Apple Maps on iOS and OpenStreetMap on Android
