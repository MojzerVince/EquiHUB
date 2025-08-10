import React, { createContext, useContext, useEffect, useState } from "react";
import { AuthUser } from "../lib/authAPI";
import { SessionManager } from "../lib/sessionManager";
import { supabase } from "../lib/supabase";

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

  useEffect(() => {
    // Get initial session
    getInitialSession();

    // Add timeout fallback for auth loading - increased to 20 seconds
    const authLoadingTimeout = setTimeout(() => {
      if (loading) {
        console.log(
          "⚠️ Auth loading timeout after 20 seconds - forcing loading to false"
        );
        setLoading(false);
      }
    }, 20000); // 20 second timeout for auth

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth state changed:", event, session?.user?.id);

      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email!,
          created_at: session.user.created_at!,
        });

        // Refresh session if needed
        await SessionManager.refreshSessionIfNeeded();
      } else {
        setUser(null);
        // Clear session data on logout
        if (event === "SIGNED_OUT") {
          await SessionManager.clearSessionData();
        }
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(authLoadingTimeout);
    };
  }, []);

  const getInitialSession = async () => {
    try {
      console.log("Getting initial session...");

      // First, try a quick session check without timeout
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (!error && session?.user) {
          console.log(
            "Quick session check successful for user:",
            session.user.email
          );
          setUser({
            id: session.user.id,
            email: session.user.email!,
            created_at: session.user.created_at!,
          });
          setLoading(false);
          return;
        }

        if (!error && !session) {
          console.log("Quick session check - no existing session found");
          setLoading(false);
          return;
        }

        // If there was an error, fall through to the timeout-protected version
        if (error) {
          console.log(
            "Quick session check failed, trying with timeout protection:",
            error.message
          );
        }
      } catch (quickError) {
        console.log(
          "Quick session check threw error, trying with timeout protection:",
          quickError
        );
      }

      // Fallback: Use timeout-protected session check
      const sessionPromise = supabase.auth.getSession();
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Session check timeout")), 15000);
      });

      const {
        data: { session },
        error,
      } = await Promise.race([sessionPromise, timeoutPromise]);

      if (error) {
        console.error("Error getting initial session:", error);
        setUser(null);
        setLoading(false);
        return;
      }

      if (session?.user) {
        console.log(
          "Timeout-protected session check successful for user:",
          session.user.email
        );
        setUser({
          id: session.user.id,
          email: session.user.email!,
          created_at: session.user.created_at!,
        });
      } else {
        console.log(
          "Timeout-protected session check - no existing session found"
        );
        setUser(null);
      }
    } catch (error) {
      console.error("Error in getInitialSession:", error);
      if (error instanceof Error && error.message.includes("timeout")) {
        console.log(
          "⚠️ Session check timed out after 15 seconds, proceeding without authentication"
        );
        // Only clear user state on timeout - don't force logout of valid sessions
        setUser(null);

        // Attempt a background retry without blocking the UI
        console.log("Scheduling background session retry...");
        setTimeout(async () => {
          try {
            console.log("Attempting background session retry...");
            const {
              data: { session },
            } = await supabase.auth.getSession();
            if (session?.user && !user) {
              // Only set user if we don't already have one
              console.log(
                "Background retry successful - found session for user:",
                session.user.email
              );
              setUser({
                id: session.user.id,
                email: session.user.email!,
                created_at: session.user.created_at!,
              });
            }
          } catch (retryError) {
            console.log("Background session retry failed:", retryError);
          }
        }, 3000);
      } else {
        // For non-timeout errors, clear user state
        setUser(null);
      }
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
      console.log("Cleared stored credentials");
    } catch (error) {
      console.error("Error clearing stored credentials:", error);
    }
  };

  const isSessionValid = async (): Promise<boolean> => {
    try {
      return await SessionManager.hasValidSession();
    } catch (error) {
      console.error("Error in isSessionValid:", error);
      return false;
    }
  };

  const refreshUser = async () => {
    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        console.error("Error refreshing user:", error);
        return;
      }

      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email!,
          created_at: session.user.created_at!,
        });
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
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
