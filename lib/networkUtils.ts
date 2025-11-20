/**
 * Network Utility Functions
 * Handles network connectivity checks for session syncing
 */

import NetInfo from '@react-native-community/netinfo';

/**
 * Check if device has WiFi connection
 * @returns Promise<boolean> - true if connected to WiFi
 */
export async function hasWiFiConnection(): Promise<boolean> {
  try {
    const netInfo = await NetInfo.fetch();
    
    // Check if connected to WiFi
    const isWiFi = netInfo.type === 'wifi' && netInfo.isConnected === true;
    
    console.log('Network check:', {
      type: netInfo.type,
      isConnected: netInfo.isConnected,
      isWiFi
    });
    
    return isWiFi;
  } catch (error) {
    console.error('Error checking WiFi connection:', error);
    return false;
  }
}

/**
 * Check if device has any internet connection
 * @returns Promise<boolean> - true if connected to internet (WiFi or cellular)
 */
export async function hasInternetConnection(): Promise<boolean> {
  try {
    const netInfo = await NetInfo.fetch();
    return netInfo.isConnected === true;
  } catch (error) {
    console.error('Error checking internet connection:', error);
    return false;
  }
}

/**
 * Get current network type
 * @returns Promise<string> - 'wifi', 'cellular', 'none', or 'unknown'
 */
export async function getNetworkType(): Promise<string> {
  try {
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      return 'none';
    }
    return netInfo.type || 'unknown';
  } catch (error) {
    console.error('Error getting network type:', error);
    return 'unknown';
  }
}
