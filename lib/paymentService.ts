import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import {
    endConnection,
    finishTransaction,
    getAvailablePurchases,
    initConnection,
    purchaseErrorListener,
    purchaseUpdatedListener,
    requestPurchase
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
  private currentSubscription: UserSubscription | null = null;
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
      
      // Create subscription from purchase
      const now = new Date();
      const endDate = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days
      
      const subscription: UserSubscription = {
        id: purchase.transactionId || `purchase_${Date.now()}`,
        plan: this.getSubscriptionPlans()[0],
        status: 'active',
        startDate: now.toISOString(),
        endDate: endDate.toISOString(),
        trialUsed: await this.hasUsedTrial(),
        platform: Platform.OS as 'ios' | 'android',
        platformSubscriptionId: purchase.transactionId
      };

      // Save subscription (this will also update database)
      await this.saveSubscription(subscription);
      
      // Finish the transaction
      await finishTransaction({ purchase, isConsumable: false });
      
      console.log('✅ Purchase processed successfully');
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

  // Check if user has used trial before
  public async hasUsedTrial(): Promise<boolean> {
    try {
      const trialUsed = await AsyncStorage.getItem('trial_used');
      return trialUsed === 'true';
    } catch (error) {
      console.error('Error checking trial status:', error);
      return false;
    }
  }

  // Mark trial as used
  private async markTrialAsUsed(): Promise<void> {
    try {
      await AsyncStorage.setItem('trial_used', 'true');
    } catch (error) {
      console.error('Error marking trial as used:', error);
    }
  }

  // Get current subscription
  public async getCurrentSubscription(): Promise<UserSubscription | null> {
    try {
      const subscriptionData = await AsyncStorage.getItem('current_subscription');
      if (subscriptionData) {
        this.currentSubscription = JSON.parse(subscriptionData);
        return this.currentSubscription;
      }
      return null;
    } catch (error) {
      console.error('Error getting current subscription:', error);
      return null;
    }
  }

  // Save subscription and update database
  private async saveSubscription(subscription: UserSubscription): Promise<void> {
    try {
      await AsyncStorage.setItem('current_subscription', JSON.stringify(subscription));
      this.currentSubscription = subscription;
      
      // Update database pro status based on subscription status
      const isActive = subscription.status === 'active' || subscription.status === 'trial';
      await this.updateDatabaseProStatus(isActive);
    } catch (error) {
      console.error('Error saving subscription:', error);
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
      
      // Force sync with database
      await this.syncWithDatabase();
      
      console.log('✅ App refresh completed');
      
    } catch (error) {
      console.error('Error refreshing app after subscription change:', error);
    }
  }

  // Force a complete subscription status refresh
  public async forceRefreshSubscriptionStatus(): Promise<void> {
    try {
      console.log('🔄 Force refreshing subscription status...');
      
      // Check current database status first
      await this.checkCurrentDatabaseStatus();
      
      // Sync with database first
      await this.syncWithDatabase();
      
      // Check database status again after sync
      await this.checkCurrentDatabaseStatus();
      
      // Refresh app context
      await this.refreshAppAfterSubscriptionChange();
      
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

      const now = new Date();
      const endDate = new Date(now.getTime() + (plan.trialPeriod * 24 * 60 * 60 * 1000));

      const subscription: UserSubscription = {
        id: `trial_${Date.now()}`,
        plan,
        status: 'trial',
        startDate: now.toISOString(),
        endDate: endDate.toISOString(),
        trialUsed: true,
        platform: Platform.OS as 'ios' | 'android'
      };

      // Save subscription (this will also update the database)
      await this.saveSubscription(subscription);
      await this.markTrialAsUsed();

      // Refresh the app to reflect the new pro status
      await this.refreshAppAfterSubscriptionChange();

      console.log('✅ Trial started successfully, database updated, app refreshed');

      return {
        success: true,
        subscriptionId: subscription.id
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

      // For iOS subscriptions, use the new API format
      await requestPurchase({
        request: {
          ios: {
            sku: planId,
          },
        },
        type: 'subs', // subscription type
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
      console.log('Starting Android subscription purchase for:', planId);
      
      // For Android subscriptions, use the Google Play format
      await requestPurchase({
        request: {
          android: {
            skus: [planId],
          },
        },
        type: 'subs', // subscription type
      });

      // Purchase success is handled by the purchase listener
      // Return success since requestPurchase doesn't throw on user cancellation
      return {
        success: true
      };
    } catch (error) {
      console.error('Android purchase failed:', error);
      return {
        success: false,
        error: `Android purchase failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // Check if subscription is active by combining local storage and database
  public async isSubscriptionActive(): Promise<boolean> {
    try {
      // First check local subscription
      const subscription = await this.getCurrentSubscription();
      if (subscription) {
        const now = new Date();
        const endDate = new Date(subscription.endDate);
        const locallyActive = subscription.status === 'active' || 
                             (subscription.status === 'trial' && now < endDate);
        
        if (locallyActive) {
          // Verify with database that user is marked as pro
          await this.syncWithDatabase();
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('Error checking subscription status:', error);
      return false;
    }
  }

  // Sync local subscription status with database
  private async syncWithDatabase(): Promise<void> {
    try {
      const supabase = getSupabase();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        console.error('Cannot sync with database - no authenticated user');
        return;
      }

      // Check current database status
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('is_pro_member')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('Error fetching profile for sync:', profileError);
        return;
      }

      const currentSubscription = await this.getCurrentSubscription();
      if (currentSubscription) {
        const shouldBePro = await this.isSubscriptionActive();
        
        // If there's a mismatch, update the database
        if (profile.is_pro_member !== shouldBePro) {
          console.log(`🔄 Syncing database: is_pro_member should be ${shouldBePro}`);
          await this.updateDatabaseProStatus(shouldBePro);
        }
      }
    } catch (error) {
      console.error('Error syncing with database:', error);
    }
  }

  // Get subscription status
  public async getSubscriptionStatus(): Promise<{
    hasSubscription: boolean;
    isActive: boolean;
    status: string;
    daysRemaining?: number;
    plan?: SubscriptionPlan;
  }> {
    const subscription = await this.getCurrentSubscription();
    
    if (!subscription) {
      return {
        hasSubscription: false,
        isActive: false,
        status: 'none'
      };
    }

    const now = new Date();
    const endDate = new Date(subscription.endDate);
    const isActive = subscription.status === 'active' || 
                     (subscription.status === 'trial' && now < endDate);
    
    const daysRemaining = isActive ? 
      Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0;

    return {
      hasSubscription: true,
      isActive,
      status: subscription.status,
      daysRemaining,
      plan: subscription.plan
    };
  }

  // Cancel subscription
  public async cancelSubscription(): Promise<boolean> {
    try {
      const subscription = await this.getCurrentSubscription();
      if (!subscription) return false;

      subscription.status = 'cancelled';
      await this.saveSubscription(subscription);
      
      return true;
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      return false;
    }
  }

  // Restore purchases (for iOS/Android)
  public async restorePurchases(): Promise<PaymentResult> {
    try {
      console.log('Restoring purchases...');
      
      if (Platform.OS === 'ios') {
        // For iOS, use getAvailablePurchases to restore
        const availablePurchases = await getAvailablePurchases();
        console.log('Available purchases found:', availablePurchases.length);
        
        // Process the restored purchases
        for (const purchase of availablePurchases) {
          console.log('Processing restored purchase:', purchase.productId);
          await this.handlePurchaseUpdate(purchase);
        }
        
        return {
          success: true,
          error: availablePurchases.length === 0 ? 'No purchases found to restore' : undefined
        };
      } else if (Platform.OS === 'android') {
        // For Android, also use getAvailablePurchases
        const availablePurchases = await getAvailablePurchases();
        console.log('Available purchases found:', availablePurchases.length);
        
        // Process the restored purchases
        for (const purchase of availablePurchases) {
          console.log('Processing restored purchase:', purchase.productId);
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
      console.error('Failed to restore purchases:', error);
      return {
        success: false,
        error: `Failed to restore purchases: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
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
