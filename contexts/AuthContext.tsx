import React, { createContext, useContext, useEffect, useState } from "react";
import { AuthAPI, AuthUser } from "../lib/authAPI";
import { SessionManager } from "../lib/sessionManager";
import { getSupabase } from "../lib/supabase";

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clearStoredCredentials: () => Promise<void>;
  isSessionValid: () => Promise<boolean>;
  hasStoredUserData: () => Promise<boolean>;
  hasUserData: boolean | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasUserData, setHasUserData] = useState<boolean | null>(null);

  useEffect(() => {
    // Initialize auth using REST API - much faster and more reliable
    const initializeAuth = async () => {
      await getInitialSession();
    };

    initializeAuth();

    // Check stored user data
    checkStoredUserData();

    // Listen for auth changes (sign in/out events)
    const supabase = getSupabase();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event: any, session: any) => {
      console.log("📱 Auth state changed:", event, session?.user?.id);

      // Only handle explicit sign in/out events, not initial session
      if (event === "SIGNED_IN" && session?.user) {
        console.log("✅ User signed in, setting user state directly");
        const authUser: AuthUser = {
          id: session.user.id,
          email: session.user.email!,
          created_at: session.user.created_at!,
        };
        setUser(authUser);
        // Mark user as having used the app whenever they successfully authenticate
        await SessionManager.markUserAsUsedApp();
        setHasUserData(true);
        // Refresh session if needed
        await SessionManager.refreshSessionIfNeeded();
      } else if (event === "SIGNED_OUT") {
        setUser(null);
        // Clear session data on logout
        await SessionManager.clearSessionData();
        setHasUserData(false);
      }
      // For INITIAL_SESSION, we rely on our REST API getInitialSession call

      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const checkStoredUserData = async () => {
    try {
      const hasData = await hasStoredUserData();
      setHasUserData(hasData);
    } catch (error) {
      console.error("Error checking stored user data:", error);
      setHasUserData(false);
    }
  };

  const getInitialSession = async () => {
    try {
      console.log("Getting initial session via REST API...");

      // Use REST API to get current user - this avoids the problematic supabase.auth.getSession() timeouts
      const { user, error } = await AuthAPI.getCurrentUser();

      if (error) {
        console.error("Error getting initial session via REST API:", error);
        setUser(null);
        return;
      }

      if (user) {
        console.log("REST API session check successful for user:", user.email);
        setUser(user);
        // Mark user as having used the app
        await SessionManager.markUserAsUsedApp();
        setHasUserData(true);
      } else {
        console.log("No valid session found via REST API");
        setUser(null);
      }
    } catch (error) {
      console.error("Error in getInitialSession:", error);
      setUser(null);
    } finally {
      console.log("✅ Setting auth loading to false");
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      console.log("Signing out user");
      // Clear user state immediately to trigger navigation
      setUser(null);

      // Clear session data first before signOut
      await clearStoredCredentials();

      const supabase = getSupabase();
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Error signing out:", error);
        // Don't throw here, just log the error
        // The user state is already cleared, so navigation will happen
      }
      console.log("User signed out successfully");
    } catch (error) {
      console.error("Sign out error:", error);
      // Don't re-throw the error to prevent crashes
      // The user state is already cleared
    }
  };

  const clearStoredCredentials = async () => {
    try {
      // Use session manager to clear all session data
      await SessionManager.clearSessionData();
      // Reset the user data flag
      setHasUserData(false);
      console.log("Cleared stored credentials");
    } catch (error) {
      console.error("Error clearing stored credentials:", error);
    }
  };

  const isSessionValid = async (): Promise<boolean> => {
    try {
      // Use REST API to check session validity - avoids timeout issues
      const { user, error } = await AuthAPI.getCurrentUser();
      return !error && !!user;
    } catch (error) {
      console.error("Error in isSessionValid:", error);
      return false;
    }
  };

  const hasStoredUserData = async (): Promise<boolean> => {
    try {
      // Check for any stored user data that indicates the app has been used before
      const checks = await Promise.allSettled([
        SessionManager.hasUserUsedApp(),
        SessionManager.getLastLoginTime(),
        SessionManager.getUserPreferences(),
        // Check for vaccination reminders (user-specific data)
        import("@react-native-async-storage/async-storage").then(
          async (AsyncStorage) => {
            const keys = await AsyncStorage.default.getAllKeys();
            return keys.some((key) => key.includes("vaccination_reminders_"));
          }
        ),
      ]);

      // If any of these checks return data, the user has used the app before
      const hasData = checks.some(
        (result) =>
          result.status === "fulfilled" &&
          result.value !== null &&
          result.value !== undefined &&
          (typeof result.value === "boolean"
            ? result.value
            : typeof result.value === "string"
            ? result.value.length > 0
            : true)
      );

      // Update the local state
      setHasUserData(hasData);
      return hasData;
    } catch (error) {
      console.error("Error checking stored user data:", error);
      setHasUserData(false);
      return false;
    }
  };

  const refreshUser = async () => {
    try {
      // Use REST API to refresh user - avoids timeout issues
      const { user, error } = await AuthAPI.getCurrentUser();

      if (error) {
        console.error("Error refreshing user via REST API:", error);
        return;
      }

      if (user) {
        setUser(user);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error("Error in refreshUser:", error);
    }
  };

  const value = {
    user,
    loading,
    signOut,
    refreshUser,
    clearStoredCredentials,
    isSessionValid,
    hasStoredUserData,
    hasUserData,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
