import { EmergencyContactsAPI } from './lib/emergencyContactsAPI';

// Quick utility to sync existing emergency contacts to database
export async function syncExistingContactsToDatabase(userId: string) {
  try {
    console.log('🔄 Starting emergency contacts database sync...');
    
    // Sync all local contacts to database
    await EmergencyContactsAPI.syncAllContactsToDatabase(userId);
    
    console.log('✅ Emergency contacts sync completed!');
    return { success: true };
  } catch (error) {
    console.error('❌ Failed to sync emergency contacts:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// You can call this function once to sync your existing contacts
// syncExistingContactsToDatabase('efab7495-b514-4c6d-9c83-f17c3afdf3ae');
