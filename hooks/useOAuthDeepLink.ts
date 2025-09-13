import * as Linking from 'expo-linking';
import { useEffect } from 'react';
import { OAuthService } from '../lib/oauthService';

export const useOAuthDeepLink = () => {
  useEffect(() => {
    // Handle deep links when app is already open
    const subscription = Linking.addEventListener('url', handleDeepLink);

    // Handle deep link when app is opened via URL
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    return () => subscription?.remove();
  }, []);

  const handleDeepLink = ({ url }: { url: string }) => {
    console.log('📱 Deep link received:', url);
    
    // Check if this is an OAuth callback
    if (OAuthService.handleAuthCallback(url)) {
      console.log('✅ OAuth callback handled');
    }
  };
};
