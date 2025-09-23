# Firebase FCM Setup Guide for EquiHUB Emergency Notifications

## Overview

This guide will help you set up Firebase Cloud Messaging (FCM) to enable push notifications that work even when the app is closed or in the background.

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or "Create a project"
3. Name your project: `EquiHUB` (or similar)
4. Choose whether to enable Google Analytics (recommended for app metrics)
5. Complete the project creation

## Step 2: Add Android App to Firebase

1. In your Firebase project, click "Add app" and select Android
2. Fill in the required information:

   - **Android package name**: This should match your `app.json` `android.package` field
   - **App nickname**: `EquiHUB Android` (optional)
   - **Debug signing certificate SHA-1**: Get this by running:
     ```bash
     cd android
     ./gradlew signingReport
     ```
     Look for the SHA1 under "Variant: debug"

3. Download the `google-services.json` file
4. Place it in your project at: `android/app/google-services.json`

## Step 3: Add iOS App to Firebase (if building for iOS)

1. In Firebase console, click "Add app" and select iOS
2. Fill in the required information:

   - **iOS bundle ID**: This should match your `app.json` `ios.bundleIdentifier` field
   - **App nickname**: `EquiHUB iOS` (optional)

3. Download the `GoogleService-Info.plist` file
4. Place it in your project at: `ios/GoogleService-Info.plist`

## Step 4: Install Firebase Dependencies

Run this command in your project root:

```bash
npx expo install @react-native-firebase/app @react-native-firebase/messaging
```

## Step 5: Configure app.json

Add Firebase configuration to your `app.json`:

```json
{
  "expo": {
    // ... existing config
    "plugins": [
      // ... existing plugins
      "@react-native-firebase/app",
      [
        "@react-native-firebase/messaging",
        {
          "iosDisplayName": "EquiHUB"
        }
      ]
    ],
    "android": {
      // ... existing android config
      "googleServicesFile": "./google-services.json"
    },
    "ios": {
      // ... existing ios config
      "googleServicesFile": "./GoogleService-Info.plist"
    }
  }
}
```

## Step 6: Environment Variables

Create or update your `.env` file with Firebase configuration:

```env
# Firebase Configuration
FIREBASE_API_KEY=your_api_key_here
FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_app_id
```

You can find these values in Firebase Console > Project Settings > General > Your apps

## Step 7: Configure Android Permissions

Your `android/app/src/main/AndroidManifest.xml` should include:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
<uses-permission android:name="android.permission.VIBRATE" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
```

## Step 8: Test FCM Setup

After completing the setup:

1. Build a development build: `npx expo run:android` or `npx expo run:ios`
2. Test that FCM tokens are generated
3. Send test notifications from Firebase Console > Messaging

## Troubleshooting

### Common Issues:

1. **"Default FirebaseApp is not initialized"**: Make sure `google-services.json` is in the correct location
2. **Package name mismatch**: Ensure Firebase package name matches `app.json`
3. **Build errors**: Run `npx expo run:android --clear` to clear cache

### Testing Push Notifications:

1. Use Firebase Console > Messaging to send test notifications
2. Test with app in foreground, background, and closed states
3. Check device logs for FCM token registration

## Next Steps

Once Firebase is set up, the notification service will automatically use FCM for reliable push notifications to emergency contacts even when the app is closed.
