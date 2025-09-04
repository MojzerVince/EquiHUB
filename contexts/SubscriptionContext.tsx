import React, { createContext, useContext, useEffect, useState } from 'react';
import PaymentService from '../lib/paymentService';

interface SubscriptionContextType {
  isProMember: boolean;
  subscriptionStatus: any;
  loading: boolean;
  refreshSubscriptionStatus: () => Promise<void>;
  triggerProStatusUpdate: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};

interface SubscriptionProviderProps {
  children: React.ReactNode;
}

export const SubscriptionProvider: React.FC<SubscriptionProviderProps> = ({ children }) => {
  const [isProMember, setIsProMember] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const refreshSubscriptionStatus = async () => {
    try {
      setLoading(true);
      const status = await PaymentService.getSubscriptionStatus();
      setSubscriptionStatus(status);
      setIsProMember(status.isActive || false);
      console.log('📱 Subscription status refreshed:', status);
    } catch (error) {
      console.error('Error refreshing subscription status:', error);
      setIsProMember(false);
    } finally {
      setLoading(false);
    }
  };

  const triggerProStatusUpdate = async () => {
    console.log('🔄 Triggering pro status update...');
    await refreshSubscriptionStatus();
    
    // Also trigger a small delay refresh to ensure database propagation
    setTimeout(async () => {
      await refreshSubscriptionStatus();
    }, 2000);
  };

  // Load subscription status on mount
  useEffect(() => {
    refreshSubscriptionStatus();
  }, []);

  // Check subscription status every minute to handle expiration
  useEffect(() => {
    const interval = setInterval(() => {
      refreshSubscriptionStatus();
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  const value = {
    isProMember,
    subscriptionStatus,
    loading,
    refreshSubscriptionStatus,
    triggerProStatusUpdate,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
};
