import { makeRedirectUri, useAuthRequest } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

// Google OAuth configuration
const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

// Replace with your actual Google OAuth client IDs
const GOOGLE_CLIENT_IDS = {
  android: '645905000706-r5d9rejr3lakueqrhl1tk7ldmpv2jt2v.apps.googleusercontent.com',
  web: '645905000706-84poben7qoa735imq8ukp765ho5k0d97.apps.googleusercontent.com',
 // ios: 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com', // Optional for future iOS support
};

export const useGoogleAuth = () => {
  const clientId = Platform.select({
    android: GOOGLE_CLIENT_IDS.android,
    web: GOOGLE_CLIENT_IDS.web,
    //ios: GOOGLE_CLIENT_IDS.ios,
    default: GOOGLE_CLIENT_IDS.android,
  });

  const redirectUri = makeRedirectUri();

  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: clientId!,
      scopes: ['openid', 'profile', 'email'],
      redirectUri,
    },
    discovery
  );

  return { request, response, promptAsync };
};

export const fetchGoogleUserInfo = async (accessToken: string) => {
  try {
    const response = await fetch(
      `https://www.googleapis.com/oauth2/v1/userinfo?access_token=${accessToken}`
    );
    const userInfo = await response.json();
    return userInfo;
  } catch (error) {
    console.error('Error fetching Google user info:', error);
    throw error;
  }
};

export interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  locale: string;
}