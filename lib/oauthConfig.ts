// OAuth Configuration for Google and Apple Sign In
export const oauthConfig = {
  google: {
    // You'll need to replace these with your actual OAuth 2.0 client IDs from Google Cloud Console
    //iosClientId: 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com',
    androidClientId: '645905000706-r5d9rejr3lakueqrhl1tk7ldmpv2jt2v.apps.googleusercontent.com',
    webClientId: '645905000706-84poben7qoa735imq8ukp765ho5k0d97.apps.googleusercontent.com', // This is the web client ID that should be used for Supabase
    scopes: ['openid', 'profile', 'email'],
  },
  apple: {
    // Apple Sign In configuration
    scopes: ['fullName', 'email'],
    // Apple doesn't require client IDs like Google
  },
  supabase: {
    // Redirect URLs for OAuth
    redirectUrl: 'equihub://auth/callback',
    // You can also add additional redirect URLs for different environments
    redirectUrls: {
      development: 'exp://localhost:19000/--/auth/callback',
      production: 'equihub://auth/callback',
    }
  }
};

// Instructions for setup:
// 1. Go to Google Cloud Console (console.cloud.google.com)
// 2. Create a new project or select existing
// 3. Enable Google+ API and Google Sign-In API
// 4. Go to "Credentials" and create OAuth 2.0 client IDs for:
//    - iOS application (bundle ID: com.mojzi1969.EquiHUB)
//    - Android application (package name: com.mojzi1969.EquiHUB, SHA-1: get from EAS build)
//    - Web application (for Supabase server-side verification)
// 5. In Supabase Dashboard, go to Authentication > Providers
// 6. Enable Google and Apple providers
// 7. Add your Google Web Client ID and Client Secret to Supabase
// 8. Add redirect URLs: equihub://auth/callback
