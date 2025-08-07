import React, { createContext, useContext, useEffect, useState } from 'react';
import { AuthUser } from '../lib/authAPI';
import { SessionManager } from '../lib/sessionManager';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clearStoredCredentials: () => Promise<void>;
  isSessionValid: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    getInitialSession();

    // Add timeout fallback for auth loading
    const authLoadingTimeout = setTimeout(() => {
      if (loading) {
        console.log('⚠️ Auth loading timeout - forcing loading to false');
        setLoading(false);
      }
    }, 15000); // 15 second timeout for auth

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.id);
        
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email!,
            created_at: session.user.created_at!
          });
          
          // Refresh session if needed
          await SessionManager.refreshSessionIfNeeded();
        } else {
          setUser(null);
          // Clear session data on logout
          if (event === 'SIGNED_OUT') {
            await SessionManager.clearSessionData();
          }
        }
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
      clearTimeout(authLoadingTimeout);
    };
  }, []);

  const getInitialSession = async () => {
    try {
      console.log('Getting initial session...');
      
      // Add timeout to prevent hanging on session check
      const sessionPromise = supabase.auth.getSession();
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Session check timeout')), 10000);
      });
      
      const { data: { session }, error } = await Promise.race([
        sessionPromise,
        timeoutPromise
      ]);
      
      if (error) {
        console.error('Error getting initial session:', error);
        setLoading(false);
        return;
      }

      if (session?.user) {
        console.log('Found existing session for user:', session.user.email);
        setUser({
          id: session.user.id,
          email: session.user.email!,
          created_at: session.user.created_at!
        });
      } else {
        console.log('No existing session found');
      }
    } catch (error) {
      console.error('Error in getInitialSession:', error);
      if (error instanceof Error && error.message.includes('timeout')) {
        console.log('Session check timed out, proceeding without authentication');
      }
    } finally {
      console.log('Setting auth loading to false');
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      console.log('Signing out user');
      // Clear user state immediately
      setUser(null);
      
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Error signing out:', error);
        throw error;
      }
      // Clear any additional stored data
      await clearStoredCredentials();
      console.log('User signed out successfully');
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  };

  const clearStoredCredentials = async () => {
    try {
      // Use session manager to clear all session data
      await SessionManager.clearSessionData();
      console.log('Cleared stored credentials');
    } catch (error) {
      console.error('Error clearing stored credentials:', error);
    }
  };

  const isSessionValid = async (): Promise<boolean> => {
    try {
      return await SessionManager.hasValidSession();
    } catch (error) {
      console.error('Error in isSessionValid:', error);
      return false;
    }
  };

  const refreshUser = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Error refreshing user:', error);
        return;
      }

      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email!,
          created_at: session.user.created_at!
        });
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Error in refreshUser:', error);
    }
  };

  const value = {
    user,
    loading,
    signOut,
    refreshUser,
    clearStoredCredentials,
    isSessionValid,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
