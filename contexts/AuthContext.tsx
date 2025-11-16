import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";
import { AppState } from "react-native";
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

  // Check stored user data on mount
  useEffect(() => {
    checkStoredUserData();
  }, []);

  useEffect(() => {
    // Initialize auth using REST API - much faster and more reliable
    const initializeAuth = async () => {
      await getInitialSession();
    };

    initializeAuth();

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
        
        // Save OAuth session data to AsyncStorage for persistence
        // Check if this is a Google OAuth sign-in
        const provider = session.user.app_metadata?.provider;
        if (provider === 'google') {
          try {
            await AsyncStorage.setItem('google_oauth_user_data', JSON.stringify(authUser));
            await AsyncStorage.setItem('google_oauth_user_id', session.user.id);
            console.log("✅ Saved Google OAuth session to AsyncStorage via auth state change");
          } catch (storageError) {
            console.error("Error saving OAuth session to AsyncStorage:", storageError);
          }
        }
        
        // Mark user as having used the app whenever they successfully authenticate
        await SessionManager.markUserAsUsedApp();
        setHasUserData(true);
        // Set loading to false immediately so ProtectedRoute can navigate
        setLoading(false);
        // Refresh session if needed
        await SessionManager.refreshSessionIfNeeded();
      } else if (event === "SIGNED_OUT") {
        setUser(null);
        // Clear session data on logout
        await SessionManager.clearSessionData();
        setHasUserData(false);
        setLoading(false);
      }
      // For INITIAL_SESSION, we rely on our REST API getInitialSession call
      // Note: setLoading(false) is now handled in each event branch above
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Handle app state changes to refresh session when app becomes active
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: string) => {
      if (nextAppState === "active") {
        console.log("📱 App became active - checking session status...");

        if (user) {
          // If we have a user, refresh the session to ensure it's still valid
          console.log("🔄 Refreshing existing session...");
          await refreshUser();
        } else {
          // If no user, check for stored session
          console.log("🔍 No user session - checking for stored session...");
          await getInitialSession();
        }
      }
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange
    );

    return () => {
      subscription?.remove();
    };
  }, [user]);

  // Periodic session validation (every 5 minutes when app is active)
  useEffect(() => {
    if (!user) return;

    const sessionCheckInterval = setInterval(async () => {
      console.log("⏰ Periodic session check...");
      try {
        const isValid = await SessionManager.hasValidSession();
        if (!isValid) {
          console.log("❌ Session invalid - refreshing...");
          await refreshUser();
        } else {
          console.log("✅ Session still valid");
        }
      } catch (error) {
        console.error("Error in periodic session check:", error);
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(sessionCheckInterval);
  }, [user]);

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

      // First, check if we have a valid Supabase session using the client
      const supabase = getSupabase();

      try {
        console.log("🔍 Checking Supabase client session...");
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (session && session.user && !sessionError) {
          console.log(
            "✅ Found valid Supabase client session for:",
            session.user.email
          );
          const authUser: AuthUser = {
            id: session.user.id,
            email: session.user.email!,
            created_at: session.user.created_at!,
          };
          setUser(authUser);
          await SessionManager.markUserAsUsedApp();
          setHasUserData(true);
          return;
        } else {
          console.log(
            "⚠️ No valid Supabase client session found, trying REST API fallback"
          );
        }
      } catch (clientError) {
        console.log(
          "⚠️ Supabase client session check failed, trying REST API fallback:",
          clientError
        );
      }

      // Check for Google OAuth session
      console.log("🔍 Checking for Google OAuth session...");
      const googleUserData = await AsyncStorage.getItem('google_oauth_user_data');
      
      if (googleUserData) {
        try {
          const userData = JSON.parse(googleUserData);
          console.log("✅ Found Google OAuth session for:", userData.email);
          setUser(userData);
          await SessionManager.markUserAsUsedApp();
          setHasUserData(true);
          return;
        } catch (parseError) {
          console.error("Error parsing Google OAuth user data:", parseError);
          // Clear corrupted data
          await AsyncStorage.removeItem('google_oauth_user_data');
          await AsyncStorage.removeItem('google_oauth_user_id');
        }
      }

      // Fallback to REST API if client session check fails
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

      // Explicitly set hasUserData to false to ensure welcome page redirect
      setHasUserData(false);

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
      
      // Clear Google OAuth session data
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      await AsyncStorage.removeItem('google_oauth_user_data');
      await AsyncStorage.removeItem('google_oauth_user_id');
      
      // Reset the user data flag
      setHasUserData(false);
      console.log("Cleared stored credentials and Google OAuth data");
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
        // Check for Google OAuth session data
        import("@react-native-async-storage/async-storage").then(
          async (AsyncStorage) => {
            const googleData = await AsyncStorage.default.getItem('google_oauth_user_data');
            return !!googleData;
          }
        ),
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
      console.log("🔄 Manually refreshing user session...");

      // First try to refresh the Supabase session
      const supabase = getSupabase();

      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.refreshSession();

        if (session && session.user && !error) {
          console.log("✅ Session refreshed successfully via Supabase");
          const authUser: AuthUser = {
            id: session.user.id,
            email: session.user.email!,
            created_at: session.user.created_at!,
          };
          setUser(authUser);
          return;
        } else {
          console.log(
            "⚠️ Supabase session refresh failed, trying current session check"
          );
        }
      } catch (refreshError) {
        console.log(
          "⚠️ Supabase refresh error, trying current session check:",
          refreshError
        );
      }

      // Fallback to REST API check
      const { user, error } = await AuthAPI.getCurrentUser();

      if (error) {
        console.error("Error refreshing user via REST API:", error);
        setUser(null);
        return;
      }

      if (user) {
        console.log("✅ Session refreshed successfully via REST API");
        setUser(user);
      } else {
        console.log("❌ No valid session found - user needs to login again");
        setUser(null);
      }
    } catch (error) {
      console.error("Error in refreshUser:", error);
      setUser(null);
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
