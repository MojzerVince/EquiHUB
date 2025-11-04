module.exports = {
  expo: {
    name: "EquiHUB",
    slug: "EquiHUB",
    version: "0.9.3",
    orientation: "portrait",
    icon: "./assets/icons/512x512.png",
    scheme: "EquiHUB",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      supportsTablet: false,
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          "This app needs location access to track your riding routes and show your position on the map.",
        NSLocationAlwaysAndWhenInUseUsageDescription:
          "This app needs location access to track your riding routes even when the app is in the background.",
        NSLocationAlwaysUsageDescription:
          "This app needs location access to track your riding routes, even when the app is in the background.",
        NSCameraUsageDescription:
          "This app needs camera access to take photos of your rides and horses.",
        NSPhotoLibraryUsageDescription:
          "This app needs photo library access to select photos of your rides and horses.",
        NSPhotoLibraryAddUsageDescription:
          "This app needs photo library access to save photos of your rides and horses.",
        UIBackgroundModes: ["location", "fetch"],
        CFBundleURLTypes: [
          {
            CFBundleURLSchemes: [
              `com.googleusercontent.apps.${
                process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.split("-")[0] ||
                "645905000706"
              }-79hvbfust1ggops4ftqijeul16eb0dvm`,
            ],
          },
        ],
      },
      config: {
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY,
      },
      bundleIdentifier: "com.mojzi1969.EquiHUB",
      buildNumber: "49",
      ITSAppUsesNonExemptEncryption: false,
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/icons/512x512.png",
        backgroundColor: "#ffffff",
      },
      edgeToEdgeEnabled: true,
      package: "com.mojzi1969.EquiHUB",
      versionCode: 44,
      permissions: [
        "INTERNET",
        "FOREGROUND_SERVICE",
        "FOREGROUND_SERVICE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION",
        "RECEIVE_BOOT_COMPLETED",
        "VIBRATE",
        "WAKE_LOCK",
        "POST_NOTIFICATIONS",
        "SCHEDULE_EXACT_ALARM",
        "USE_EXACT_ALARM",
        "com.android.vending.BILLING",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_FINE_LOCATION",
      ],
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY,
        },
      },
      foregroundService: {
        notificationTitle: "EquiHUB GPS Tracking",
        notificationBody: "Tracking your riding session",
        notificationColor: "#4A90E2",
        killServiceOnDestroy: false,
      },
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/favicon.png",
    },
    plugins: [
      "expo-router",
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission:
            "This app needs location access to track your riding routes and show your position on the map.",
          locationAlwaysPermission:
            "This app needs location access to track your riding routes even when the app is in the background.",
          locationWhenInUsePermission:
            "This app needs location access to track your riding routes and show your position on the map.",
        },
      ],
      ["expo-task-manager"],
      "expo-font",
      [
        "expo-notifications",
        {
          icon: "./assets/icons/512x512.png",
          color: "#ffffff",
          defaultChannel: "default",
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: "742e5e41-9412-4d33-82b8-499f96203513",
      },
      expoPublicApiServerUrl: "https://grdsqxwghajehneksxik.supabase.co",
      expoPublicBundleId: "com.mojzi1969.EquiHUB",
      expoPublicAppVersion: "0.9.3",
    },
  },
};
