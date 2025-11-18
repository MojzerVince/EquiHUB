import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

/**
 * OAuth Callback Handler
 * This screen handles the OAuth callback after successful authentication with Google
 */
export default function AuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams();

  useEffect(() => {
    handleOAuthCallback();
  }, []);

  const handleOAuthCallback = async () => {
    try {
      console.log('🔄 OAuth callback received');
      console.log('📋 Callback params:', params);

      // The AuthContext should handle the session establishment
      // We just need to wait a bit and then navigate to let ProtectedRoute handle the rest
      console.log('⏳ Waiting for AuthContext to process session...');
      
      // Wait a short time for any async session processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('✅ OAuth callback complete, navigating to main app');
      // Navigate to tabs - ProtectedRoute and AuthContext will handle the rest
      router.replace('/(tabs)/map');
      
    } catch (error) {
      console.error('❌ OAuth callback error:', error);
      router.replace('/login');
    }
  };

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#335C67" />
      <Text style={styles.text}>Completing sign in...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  text: {
    marginTop: 16,
    fontSize: 16,
    color: '#335C67',
    fontFamily: 'Inder',
  },
});
