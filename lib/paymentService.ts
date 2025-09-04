import { Platform } from 'react-native';
import {
  endConnection,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestSubscription
} from 'react-native-iap';
import { ProfileAPIBase64 } from './profileAPIBase64';
import { getSupabase } from './supabase';

export interface SubscriptionPlan {
  id: string;
  price: string;
  duration: string;
  features: string[];
  trialPeriod?: number; // days
}

export interface UserSubscription {
  id: string;
  plan: SubscriptionPlan;
  status: 'active' | 'trial' | 'expired' | 'cancelled';
  startDate: string;
  endDate: string;
  trialUsed: boolean;
  platform: 'ios' | 'android' | 'web';
  platformSubscriptionId?: string;
}

export interface PaymentResult {
  success: boolean;
  subscriptionId?: string;
  error?: string;
  transactionId?: string;
}

class PaymentService {
  private static instance: PaymentService;
  private purchaseUpdateListener: any = null;
  private purchaseErrorListener: any = null;
  private isIAPInitialized: boolean = false;

  public static getInstance(): PaymentService {
    if (!PaymentService.instance) {
      PaymentService.instance = new PaymentService();
    }
    return PaymentService.instance;
  }

  // Initialize IAP connection and listeners
  private async initializeIAP(): Promise<boolean> {
    try {
      if (this.isIAPInitialized) {
        return true;
      }

      console.log('🔄 Initializing IAP connection...');
      
      // Initialize connection
      const result = await initConnection();
      if (!result) {
        throw new Error('Failed to initialize IAP connection');
      }

      // Setup purchase listeners
      this.purchaseUpdateListener = purchaseUpdatedListener((purchase) => {
        console.log('📱 Purchase updated:', purchase);
        this.handlePurchaseUpdate(purchase);
      });

      this.purchaseErrorListener = purchaseErrorListener((error) => {
        console.error('❌ Purchase error:', error);
        this.handlePurchaseError(error);
      });

      this.isIAPInitialized = true;
      console.log('✅ IAP initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize IAP:', error);
      return false;
    }
  }

  // Cleanup IAP connection
  private async cleanupIAP(): Promise<void> {
    try {
      if (this.purchaseUpdateListener) {
        this.purchaseUpdateListener.remove();
        this.purchaseUpdateListener = null;
      }

      if (this.purchaseErrorListener) {
        this.purchaseErrorListener.remove();
        this.purchaseErrorListener = null;
      }

      await endConnection();
      this.isIAPInitialized = false;
      console.log('✅ IAP cleanup completed');
    } catch (error) {
      console.error('❌ Error during IAP cleanup:', error);
    }
  }

  // Handle purchase updates
  private async handlePurchaseUpdate(purchase: any): Promise<void> {
    try {
      console.log('🔄 Processing purchase update:', purchase);
      
      // Verify the purchase (you should implement server-side verification)
      // For now, we'll trust the purchase
      
      // Simply update the database to mark user as pro member
      await this.updateDatabaseProStatus(true);
      
      // Finish the transaction
      await finishTransaction({ purchase, isConsumable: false });
      
      console.log('✅ Purchase processed successfully - user is now pro member');
    } catch (error) {
      console.error('❌ Error processing purchase update:', error);
    }
  }

  // Handle purchase errors
  private handlePurchaseError(error: any): void {
    console.error('❌ Purchase error details:', error);
    // You can emit events here to notify the UI of the error
  }
  public getSubscriptionPlans(): SubscriptionPlan[] {
    return [
      {
        id: 'equihub_pro_monthly',
        price: '$9.99',
        duration: 'month',
        trialPeriod: 7,
        features: [
          'Unlimited training session history',
          'Advanced performance analytics',
          'Premium GPS tracking features',
          'Exclusive badges & achievements',
          'Cloud backup',
          'Priority support',
          'Training goals & milestones',
          'Custom training plans'
        ]
      }
    ];
  }

  // Check if user has used trial before by checking database
  public async hasUsedTrial(): Promise<boolean> {
    try {
      const supabase = getSupabase();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        console.error('Cannot check trial status - no authenticated user');
        return false;
      }

      // Check if user has trial_used field set to true in profiles table
      const { data, error } = await supabase
        .from('profiles')
        .select('trial_used')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error checking trial status from database:', error);
        return false;
      }

      return data?.trial_used === true;
    } catch (error) {
      console.error('Error checking trial status:', error);
      return false;
    }
  }

  // Mark trial as used in database
  private async markTrialAsUsed(): Promise<void> {
    try {
      const supabase = getSupabase();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        console.error('Cannot mark trial as used - no authenticated user');
        return;
      }

      // Update trial_used field in profiles table
      const { error } = await supabase
        .from('profiles')
        .update({ trial_used: true })
        .eq('id', user.id);

      if (error) {
        console.error('Error marking trial as used in database:', error);
      } else {
        console.log('Trial marked as used in database');
      }
    } catch (error) {
      console.error('Error marking trial as used:', error);
    }
  }

  // Reset trial status (for testing purposes)
  public async resetTrialStatus(): Promise<void> {
    try {
      const supabase = getSupabase();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        console.error('Cannot reset trial status - no authenticated user');
        return;
      }

      // Reset trial_used field and pro status in profiles table
      const { error } = await supabase
        .from('profiles')
        .update({ 
          trial_used: false,
          is_pro_member: false 
        })
        .eq('id', user.id);

      if (error) {
        console.error('Error resetting trial status in database:', error);
      } else {
        console.log('✅ Trial status reset in database - user can use trial again');
      }
    } catch (error) {
      console.error('Error resetting trial status:', error);
    }
  }

  // Check if user is pro member by checking database directly
  public async isProMember(): Promise<boolean> {
    try {
      const supabase = getSupabase();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        console.error('Cannot check pro status - no authenticated user');
        return false;
      }

      // Get is_pro_member status directly from database
      const { data, error } = await supabase
        .from('profiles')
        .select('is_pro_member')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error checking pro status from database:', error);
        return false;
      }

      const isProMember = data?.is_pro_member === true;
      console.log('📱 Pro status from database:', isProMember);
      return isProMember;
    } catch (error) {
      console.error('Error checking pro status:', error);
      return false;
    }
  }

  // Update user's is_pro_member status in database
  private async updateDatabaseProStatus(isProMember: boolean): Promise<boolean> {
    try {
      // Get current user from Supabase auth
      const supabase = getSupabase();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        console.error('Error getting current user for pro status update:', authError);
        return false;
      }

      console.log(`🔄 Updating database pro status for user ${user.id} to ${isProMember}`);
      
      // Use ProfileAPIBase64 to update the pro status
      const success = await ProfileAPIBase64.updateProfile(user.id, {
        is_pro_member: isProMember,
        updated_at: new Date().toISOString()
      });

      if (success) {
        console.log('✅ Successfully updated database pro status');
        return true;
      } else {
        console.error('❌ Failed to update database pro status');
        return false;
      }
    } catch (error) {
      console.error('Error updating database pro status:', error);
      return false;
    }
  }

  // Refresh the app context after subscription changes
  public async refreshAppAfterSubscriptionChange(): Promise<void> {
    try {
      // Trigger a global app refresh by clearing relevant caches and notifying context
      console.log('🔄 Refreshing app after subscription change...');
      
      // Clear profile cache to force fresh data fetch
      const { apiCache, CacheKeys } = await import('./apiCache');
      const supabase = getSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        apiCache.delete(CacheKeys.profile(user.id));
        console.log('✅ Cleared profile cache');
      }
      
      console.log('✅ App refresh completed');
      
    } catch (error) {
      console.error('Error refreshing app after subscription change:', error);
    }
  }

  // Force a complete subscription status refresh
  public async forceRefreshSubscriptionStatus(): Promise<void> {
    try {
      console.log('🔄 Force refreshing subscription status...');
      
      // Check current database status for debugging
      await this.checkCurrentDatabaseStatus();
      
      console.log('✅ Subscription status force refresh completed');
    } catch (error) {
      console.error('Error in force refresh subscription status:', error);
    }
  }

  // Debug method to check current database status
  public async checkCurrentDatabaseStatus(): Promise<{ userId: string; isProMember: boolean } | null> {
    try {
      const supabase = getSupabase();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        console.error('Cannot check database status - no authenticated user');
        return null;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('is_pro_member')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('Error fetching profile for status check:', profileError);
        return null;
      }

      const status = {
        userId: user.id,
        isProMember: profile.is_pro_member || false
      };

      console.log('📊 Current database status:', status);
      return status;
    } catch (error) {
      console.error('Error checking current database status:', error);
      return null;
    }
  }

  // Start trial subscription
  public async startTrial(planId: string): Promise<PaymentResult> {
    try {
      const hasUsedTrial = await this.hasUsedTrial();
      if (hasUsedTrial) {
        return {
          success: false,
          error: 'Trial has already been used for this account'
        };
      }

      const plans = this.getSubscriptionPlans();
      const plan = plans.find(p => p.id === planId);
      
      if (!plan || !plan.trialPeriod) {
        return {
          success: false,
          error: 'Invalid plan or trial not available'
        };
      }

      // Activate trial by setting is_pro_member to true and marking trial as used
      await this.updateDatabaseProStatus(true);
      await this.markTrialAsUsed();

      console.log('✅ Trial started successfully - user is now pro member');

      return {
        success: true,
        subscriptionId: `trial_${Date.now()}`
      };
    } catch (error) {
      console.error('Error starting trial:', error);
      return {
        success: false,
        error: 'Failed to start trial'
      };
    }
  }

  // Platform-specific subscription purchase
  public async purchaseSubscription(planId: string): Promise<PaymentResult> {
    try {
      if (Platform.OS === 'ios') {
        return await this.purchaseIOS(planId);
      } else if (Platform.OS === 'android') {
        return await this.purchaseAndroid(planId);
      } else {
        return {
          success: false,
          error: 'Platform not supported for subscriptions'
        };
      }
    } catch (error) {
      console.error('Error purchasing subscription:', error);
      return {
        success: false,
        error: 'Failed to purchase subscription'
      };
    }
  }

  // iOS App Store purchase (requires react-native-iap)
  // iOS App Store purchase
  private async purchaseIOS(planId: string): Promise<PaymentResult> {
    try {
      console.log('🍎 Starting iOS purchase for plan:', planId);
      
      // Initialize IAP if not already done
      const initialized = await this.initializeIAP();
      if (!initialized) {
        return {
          success: false,
          error: 'Failed to initialize App Store connection'
        };
      }

      // For iOS subscriptions, use requestSubscription with correct format
      await requestSubscription({
        sku: planId,
        andDangerouslyFinishTransactionAutomaticallyIOS: false
      });
      
      // The purchase will be handled by the purchase update listener
      // We return success immediately since the listener will handle the actual processing
      console.log('✅ iOS subscription purchase initiated successfully');
      
      return {
        success: true,
        subscriptionId: `pending_${Date.now()}`,
      };
      
    } catch (error: any) {
      console.error('❌ iOS purchase error:', error);
      
      // Handle specific error cases
      if (error.code === 'E_USER_CANCELLED') {
        return {
          success: false,
          error: 'Purchase was cancelled by user'
        };
      } else if (error.code === 'E_NETWORK_ERROR') {
        return {
          success: false,
          error: 'Network error. Please check your internet connection and try again.'
        };
      } else if (error.code === 'E_SERVICE_ERROR') {
        return {
          success: false,
          error: 'App Store service error. Please try again later.'
        };
      } else if (error.code === 'E_ITEM_UNAVAILABLE') {
        return {
          success: false,
          error: 'This subscription is not available. Please try again later.'
        };
      } else {
        return {
          success: false,
          error: error.message || 'iOS purchase failed'
        };
      }
    } finally {
      // Clean up IAP connection after purchase attempt
      setTimeout(() => {
        this.cleanupIAP();
      }, 5000); // Wait 5 seconds to allow purchase processing
    }
  }

  // Android Google Play purchase (requires react-native-iap)
  private async purchaseAndroid(planId: string): Promise<PaymentResult> {
    try {
      console.log('🤖 Starting Android subscription purchase for:', planId);
      
      // Initialize IAP if not already done
      const initialized = await this.initializeIAP();
      if (!initialized) {
        return {
          success: false,
          error: 'Failed to initialize Google Play connection'
        };
      }
      
      // For Android subscriptions, use requestSubscription with correct format
      await requestSubscription({
        sku: planId
      });

      // Purchase success is handled by the purchase listener
      console.log('✅ Android subscription purchase initiated successfully');
      
      return {
        success: true,
        subscriptionId: `pending_${Date.now()}`
      };
    } catch (error: any) {
      console.error('❌ Android purchase error:', error);
      
      // Handle specific error cases
      if (error.code === 'E_USER_CANCELLED') {
        return {
          success: false,
          error: 'Purchase was cancelled by user'
        };
      } else if (error.code === 'E_NETWORK_ERROR') {
        return {
          success: false,
          error: 'Network error. Please check your internet connection and try again.'
        };
      } else {
        return {
          success: false,
          error: error.message || 'Android purchase failed'
        };
      }
    } finally {
      // Clean up IAP connection after purchase attempt
      setTimeout(() => {
        this.cleanupIAP();
      }, 5000);
    }
  }

  // Check if subscription is active by checking database directly
  public async isSubscriptionActive(): Promise<boolean> {
    return await this.isProMember();
  }

  // Sync local subscription status with database
  // Get subscription status based on database is_pro_member field
  public async getSubscriptionStatus(): Promise<{
    hasSubscription: boolean;
    isActive: boolean;
    status: string;
    daysRemaining?: number;
    plan?: SubscriptionPlan;
  }> {
    const isProMember = await this.isProMember();
    const hasUsedTrial = await this.hasUsedTrial();
    
    return {
      hasSubscription: isProMember,
      isActive: isProMember,
      status: isProMember ? (hasUsedTrial ? 'active' : 'trial') : 'none',
      plan: isProMember ? this.getSubscriptionPlans()[0] : undefined
    };
  }

  // Cancel subscription by removing pro status
  public async cancelSubscription(): Promise<boolean> {
    try {
      // Simply set is_pro_member to false in database
      await this.updateDatabaseProStatus(false);
      console.log('✅ Subscription cancelled - user is no longer pro member');
      return true;
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      return false;
    }
  }

  // Restore purchases (for iOS/Android)
  public async restorePurchases(): Promise<PaymentResult> {
    try {
      console.log('🔄 Restoring purchases...');
      
      // Initialize IAP connection first
      const initialized = await this.initializeIAP();
      if (!initialized) {
        return {
          success: false,
          error: 'Failed to initialize store connection'
        };
      }
      
      if (Platform.OS === 'ios') {
        // For iOS, use getAvailablePurchases to restore
        const availablePurchases = await getAvailablePurchases();
        console.log(`📱 Found ${availablePurchases.length} available purchases to restore`);
        
        // Process the restored purchases
        for (const purchase of availablePurchases) {
          console.log('🔄 Processing restored purchase:', purchase.productId);
          await this.handlePurchaseUpdate(purchase);
        }
        
        return {
          success: true,
          error: availablePurchases.length === 0 ? 'No purchases found to restore' : undefined
        };
      } else if (Platform.OS === 'android') {
        // For Android, also use getAvailablePurchases
        const availablePurchases = await getAvailablePurchases();
        console.log(`🤖 Found ${availablePurchases.length} available purchases to restore`);
        
        // Process the restored purchases
        for (const purchase of availablePurchases) {
          console.log('🔄 Processing restored purchase:', purchase.productId);
          await this.handlePurchaseUpdate(purchase);
        }
        
        return {
          success: true,
          error: availablePurchases.length === 0 ? 'No purchases found to restore' : undefined
        };
      }
      
      return {
        success: false,
        error: 'Platform not supported'
      };
    } catch (error) {
      console.error('❌ Failed to restore purchases:', error);
      return {
        success: false,
        error: `Failed to restore purchases: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    } finally {
      // Clean up after restore attempt
      setTimeout(() => {
        this.cleanupIAP();
      }, 3000);
    }
  }

  // Get platform-specific store URL for subscription management
  public getSubscriptionManagementURL(): string {
    if (Platform.OS === 'ios') {
      return 'https://apps.apple.com/account/subscriptions';
    } else if (Platform.OS === 'android') {
      return 'https://play.google.com/store/account/subscriptions';
    }
    return '';
  }
}

export default PaymentService.getInstance();
