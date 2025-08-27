/**
 * App Initialization with Secure Configuration
 * Initialize secure config before any components load
 */

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { secureConfig } from '../lib/secureConfig';
import { initializeSupabase } from '../lib/supabase';

interface AppInitializerProps {
  children: React.ReactNode;
}

export const AppInitializer: React.FC<AppInitializerProps> = ({ children }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      console.log('🔧 Initializing secure configuration...');
      
      // Initialize secure configuration first
      await secureConfig.initialize();
      console.log('✅ Secure configuration loaded');
      
      // Initialize Supabase with secure config
      await initializeSupabase();
      console.log('✅ Supabase initialized securely');
      
      setIsInitialized(true);
    } catch (error) {
      console.error('❌ App initialization failed:', error);
      setInitError(error instanceof Error ? error.message : 'Unknown error');
    }
  };

  if (initError) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorTitle}>Configuration Error</Text>
        <Text style={styles.errorText}>{initError}</Text>
        <Text style={styles.errorHelp}>
          Please check your environment configuration and try again.
        </Text>
      </View>
    );
  }

  if (!isInitialized) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Initializing secure configuration...</Text>
      </View>
    );
  }

  return <>{children}</>;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF3B30',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorHelp: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default AppInitializer;
