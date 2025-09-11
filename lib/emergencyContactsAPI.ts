import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Contacts from "expo-contacts";
import * as SMS from "expo-sms";
import { ServerSMSAPI } from "./serverSMSAPI";
import { getSupabase } from "./supabase";

export interface EmergencyContact {
  id: string;
  name: string;
  phoneNumber: string;
  isEnabled: boolean;
  addedAt: number;
}

export interface ContactPermissionStatus {
  granted: boolean;
  canAskAgain: boolean;
}

export class EmergencyContactsAPI {
  private static readonly STORAGE_KEY_PREFIX = "emergency_contacts_";
  private static readonly MAX_CONTACTS = 1;

  // Request contacts permission
  static async requestContactsPermission(): Promise<ContactPermissionStatus> {
    try {
      const { status, canAskAgain } = await Contacts.requestPermissionsAsync();
      return {
        granted: status === "granted",
        canAskAgain,
      };
    } catch (error) {
      console.error("Error requesting contacts permission:", error);
      return { granted: false, canAskAgain: false };
    }
  }

  // Check if contacts permission is granted
  static async getContactsPermissionStatus(): Promise<ContactPermissionStatus> {
    try {
      const { status, canAskAgain } = await Contacts.getPermissionsAsync();
      return {
        granted: status === "granted",
        canAskAgain,
      };
    } catch (error) {
      console.error("Error checking contacts permission:", error);
      return { granted: false, canAskAgain: false };
    }
  }

  // Request SMS permission
  static async requestSMSPermission(): Promise<boolean> {
    try {
      const isAvailable = await SMS.isAvailableAsync();
      return isAvailable;
    } catch (error) {
      console.error("Error checking SMS availability:", error);
      return false;
    }
  }

  // Get all device contacts
  static async getDeviceContacts(): Promise<Contacts.Contact[]> {
    try {
      const permission = await this.getContactsPermissionStatus();
      if (!permission.granted) {
        throw new Error("Contacts permission not granted");
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
        sort: Contacts.SortTypes.FirstName,
      });

      // Filter contacts that have phone numbers
      return data.filter(
        (contact: Contacts.Contact) =>
          contact.phoneNumbers &&
          contact.phoneNumbers.length > 0 &&
          contact.name
      );
    } catch (error) {
      console.error("Error getting device contacts:", error);
      throw error;
    }
  }

  // Get saved emergency contacts
  static async getEmergencyContacts(userId: string): Promise<EmergencyContact[]> {
    try {
      const key = `${this.STORAGE_KEY_PREFIX}${userId}`;
      const data = await AsyncStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error("Error getting emergency contacts:", error);
      return [];
    }
  }

  // Add emergency contact
  static async addEmergencyContact(
    userId: string,
    contact: Omit<EmergencyContact, "id" | "addedAt">
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const existingContacts = await this.getEmergencyContacts(userId);

      // Check if we've reached the maximum
      if (existingContacts.length >= this.MAX_CONTACTS) {
        return {
          success: false,
          error: `You can only have up to ${this.MAX_CONTACTS} emergency contacts`,
        };
      }

      // Check if this phone number already exists
      const phoneExists = existingContacts.some(
        (c) => c.phoneNumber === contact.phoneNumber
      );
      if (phoneExists) {
        return {
          success: false,
          error: "This phone number is already added as an emergency contact",
        };
      }

      const newContact: EmergencyContact = {
        ...contact,
        id: `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        addedAt: Date.now(),
      };

      const updatedContacts = [...existingContacts, newContact];
      const key = `${this.STORAGE_KEY_PREFIX}${userId}`;
      await AsyncStorage.setItem(key, JSON.stringify(updatedContacts));

      // Sync to database for server SMS functionality
      try {
        await this.syncContactToDatabase(userId, newContact);
      } catch (dbError) {
        console.warn("Failed to sync contact to database:", dbError);
        // Don't fail the entire operation if database sync fails
      }

      return { success: true };
    } catch (error) {
      console.error("Error adding emergency contact:", error);
      return {
        success: false,
        error: "Failed to save emergency contact",
      };
    }
  }

  // Remove emergency contact
  static async removeEmergencyContact(
    userId: string,
    contactId: string
  ): Promise<boolean> {
    try {
      const existingContacts = await this.getEmergencyContacts(userId);
      const contactToRemove = existingContacts.find(c => c.id === contactId);
      const updatedContacts = existingContacts.filter(
        (contact) => contact.id !== contactId
      );

      const key = `${this.STORAGE_KEY_PREFIX}${userId}`;
      await AsyncStorage.setItem(key, JSON.stringify(updatedContacts));

      // Remove from database if it exists
      if (contactToRemove) {
        try {
          await this.removeContactFromDatabase(userId, contactToRemove.phoneNumber);
        } catch (dbError) {
          console.warn("Failed to remove contact from database:", dbError);
          // Don't fail the entire operation if database removal fails
        }
      }

      return true;
    } catch (error) {
      console.error("Error removing emergency contact:", error);
      return false;
    }
  }

  // Toggle emergency contact enabled status
  static async toggleEmergencyContact(
    userId: string,
    contactId: string,
    isEnabled: boolean
  ): Promise<boolean> {
    try {
      const existingContacts = await this.getEmergencyContacts(userId);
      const updatedContacts = existingContacts.map((contact) =>
        contact.id === contactId ? { ...contact, isEnabled } : contact
      );

      const key = `${this.STORAGE_KEY_PREFIX}${userId}`;
      await AsyncStorage.setItem(key, JSON.stringify(updatedContacts));
      return true;
    } catch (error) {
      console.error("Error toggling emergency contact:", error);
      return false;
    }
  }

  // Send emergency SMS to all enabled contacts (server-first with direct SMS fallback)
  static async sendEmergencyAlert(
    userId: string,
    message: string,
    userLocation?: { latitude: number; longitude: number }
  ): Promise<{ 
    success: boolean; 
    sentCount: number; 
    error?: string;
    method?: "server" | "direct";
  }> {
    try {
      console.log("📱 Attempting to send emergency alert via server SMS...");

      // Try server SMS first
      try {
        const serverResult = await ServerSMSAPI.sendManualAlert(
          userId,
          message,
          userLocation
        );

        if (serverResult.success) {
          console.log("✅ Emergency alert sent successfully via server SMS");
          return {
            success: true,
            sentCount: serverResult.sentCount,
            method: "server",
          };
        } else {
          console.log("⚠️ Server SMS failed, falling back to direct SMS:", serverResult.error);
        }
      } catch (serverError) {
        console.log("⚠️ Server SMS error, falling back to direct SMS:", serverError);
      }

      // Fallback to direct SMS
      console.log("📱 Falling back to direct SMS...");
      const directResult = await this.sendEmergencyAlertDirect(userId, message, userLocation);
      
      return {
        ...directResult,
        method: "direct",
      };
    } catch (error) {
      console.error("❌ Error in sendEmergencyAlert:", error);
      return {
        success: false,
        sentCount: 0,
        error: "Failed to send emergency alert",
      };
    }
  }

  // Direct SMS method (original implementation)
  static async sendEmergencyAlertDirect(
    userId: string,
    message: string,
    userLocation?: { latitude: number; longitude: number }
  ): Promise<{ success: boolean; sentCount: number; error?: string }> {
    try {
      const emergencyContacts = await this.getEmergencyContacts(userId);
      const enabledContacts = emergencyContacts.filter((c) => c.isEnabled);

      if (enabledContacts.length === 0) {
        return {
          success: false,
          sentCount: 0,
          error: "No enabled emergency contacts found",
        };
      }

      // Check SMS availability
      const smsAvailable = await this.requestSMSPermission();
      if (!smsAvailable) {
        return {
          success: false,
          sentCount: 0,
          error: "SMS is not available on this device",
        };
      }

      let finalMessage = message;
      
      // Add location to message if available
      if (userLocation) {
        const locationUrl = `https://maps.google.com/?q=${userLocation.latitude},${userLocation.longitude}`;
        finalMessage += `\n\nMy location: ${locationUrl}`;
      }

      const phoneNumbers = enabledContacts.map((c) => c.phoneNumber);

      // Send SMS to all emergency contacts
      const { result } = await SMS.sendSMSAsync(phoneNumbers, finalMessage);

      return {
        success: result === "sent",
        sentCount: result === "sent" ? enabledContacts.length : 0,
        error: result !== "sent" ? "Failed to send emergency SMS" : undefined,
      };
    } catch (error) {
      console.error("Error sending emergency alert:", error);
      return {
        success: false,
        sentCount: 0,
        error: "Failed to send emergency alert",
      };
    }
  }

  // Format phone number for display
  static formatPhoneNumber(phoneNumber: string): string {
    // Remove all non-digits
    const cleaned = phoneNumber.replace(/\D/g, "");
    
    // Format based on length
    if (cleaned.length === 10) {
      return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3");
    } else if (cleaned.length === 11 && cleaned.startsWith("1")) {
      return cleaned.replace(/(\d{1})(\d{3})(\d{3})(\d{4})/, "+$1 ($2) $3-$4");
    }
    
    return phoneNumber; // Return original if can't format
  }

  // Validate phone number
  static validatePhoneNumber(phoneNumber: string): boolean {
    const cleaned = phoneNumber.replace(/\D/g, "");
    return cleaned.length >= 10 && cleaned.length <= 15;
  }

  // Sync contact to database for server SMS functionality
  private static async syncContactToDatabase(
    userId: string,
    contact: EmergencyContact
  ): Promise<void> {
    try {
      const supabase = getSupabase();

      const { error } = await supabase
        .from('emergency_contacts')
        .upsert({
          user_id: userId,
          name: contact.name,
          phone_number: contact.phoneNumber,
          is_enabled: contact.isEnabled,
          created_at: new Date(contact.addedAt).toISOString(),
        });

      if (error) {
        console.error('Database sync error:', error);
        throw error;
      }

      console.log('✅ Contact synced to database:', contact.name);
    } catch (error) {
      console.error('Failed to sync contact to database:', error);
      throw error;
    }
  }

  // Sync all local contacts to database
  static async syncAllContactsToDatabase(userId: string): Promise<void> {
    try {
      const localContacts = await this.getEmergencyContacts(userId);
      
      for (const contact of localContacts) {
        try {
          await this.syncContactToDatabase(userId, contact);
        } catch (error) {
          console.warn(`Failed to sync contact ${contact.name}:`, error);
        }
      }
      
      console.log(`✅ Synced ${localContacts.length} contacts to database`);
    } catch (error) {
      console.error('Failed to sync contacts to database:', error);
      throw error;
    }
  }

  // Remove contact from database
  private static async removeContactFromDatabase(
    userId: string,
    phoneNumber: string
  ): Promise<void> {
    try {
      const supabase = getSupabase();

      const { error } = await supabase
        .from('emergency_contacts')
        .delete()
        .eq('user_id', userId)
        .eq('phone_number', phoneNumber);

      if (error) {
        console.error('Database removal error:', error);
        throw error;
      }

      console.log('✅ Contact removed from database:', phoneNumber);
    } catch (error) {
      console.error('Failed to remove contact from database:', error);
      throw error;
    }
  }
}
