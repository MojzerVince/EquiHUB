import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";
import { AppState } from "react-native";
import { AuthAPI, AuthUser } from "../lib/authAPI";
import { SessionManager } from "../lib/sessionManager";
import { getSupabase, reinitializeSupabase } from "../lib/supabase";

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

        console.log("🔄 Setting user state to:", authUser.email);
        setUser(authUser);

        // CRITICAL: Wait for session to propagate in the background
        // This ensures database queries will work, but doesn't block the UI
        console.log("⏳ Verifying session propagation in background...");

        // Use Promise.race to add a timeout to getSession
        const verifyWithTimeout = async () => {
          try {
            const sessionPromise = supabase.auth.getSession();
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error("Session verification timeout")),
                3000
              )
            );

            const {
              data: { session: verifiedSession },
            } = (await Promise.race([sessionPromise, timeoutPromise])) as any;

            if (verifiedSession?.user?.id === session.user.id) {
              console.log("✅ Session verified and accessible for queries");
            } else {
              console.warn("⚠️ Session verification mismatch, but continuing");
            }
          } catch (error) {
            console.warn(
              "⚠️ Session verification failed/timeout, but user is set:",
              error
            );
          }
        };

        // Run verification in background (don't await)
        verifyWithTimeout();

        // Save OAuth session data to AsyncStorage for persistence
        // Check if this is an OAuth sign-in (Google, Apple, etc.)
        const provider = session.user.app_metadata?.provider;
        console.log("🔐 Provider detected:", provider);

        try {
          // Save user data for all OAuth providers
          if (
            provider === "google" ||
            provider === "apple" ||
            provider === "facebook"
          ) {
            await AsyncStorage.setItem(
              "oauth_user_data",
              JSON.stringify(authUser)
            );
            await AsyncStorage.setItem("oauth_user_id", session.user.id);
            await AsyncStorage.setItem("oauth_provider", provider);
            console.log(`✅ Saved ${provider} OAuth session to AsyncStorage`);

            // Also save the full session object for better restoration
            try {
              await AsyncStorage.setItem(
                "oauth_session",
                JSON.stringify({
                  access_token: session.access_token,
                  refresh_token: session.refresh_token,
                  expires_at: session.expires_at,
                  user: authUser,
                })
              );
              console.log("✅ Saved full OAuth session data");
            } catch (sessionSaveError) {
              console.error("Error saving full session:", sessionSaveError);
            }
          }
        } catch (storageError) {
          console.error(
            "Error saving OAuth session to AsyncStorage:",
            storageError
          );
        }

        // Additional wait to ensure session is fully ready for database queries
        console.log(
          "⏳ Waiting additional time for database query readiness..."
        );
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second

        // CRITICAL FIX: Reinitialize Supabase client to pick up the new session
        // This fixes the issue where getSession() hangs after setSession()
        console.log("🔄 Reinitializing Supabase client after OAuth login...");
        try {
          await reinitializeSupabase();
          console.log("✅ Supabase client reinitialized successfully");
        } catch (reinitError) {
          console.error("❌ Error reinitializing Supabase:", reinitError);
        }

        console.log("✅ Session should now be ready for database queries");

        // Verify the authenticated user
        console.log("🔍 Verifying authenticated user in Supabase...");
        try {
          // First check if we can get the session
          const {
            data: { session: currentSession },
            error: sessionError,
          } = await supabase.auth.getSession();
          console.log(
            "🔍 getSession result - session exists:",
            !!currentSession,
            "error:",
            sessionError?.message
          );

          if (currentSession) {
            console.log("✅ Session found in Supabase client");
            console.log("📧 Session user:", currentSession.user?.email);
            console.log(
              "🔑 Access token present:",
              !!currentSession.access_token
            );
          } else {
            console.error("❌ No session in Supabase client!");
          }

          const {
            data: { user: currentUser },
            error: userError,
          } = await supabase.auth.getUser();
          if (userError) {
            console.error("❌ Error getting user:", userError.message);
            console.error("❌ Full error:", userError);
          } else if (currentUser) {
            console.log("✅ Authenticated user confirmed:", currentUser.email);
            console.log("👤 User ID:", currentUser.id);
            console.log(
              "📧 Email verified:",
              currentUser.email_confirmed_at ? "Yes" : "No"
            );
          } else {
            console.error("❌ No authenticated user found!");
          }

          // Test a simple database query
          console.log("🔍 Testing database access with simple query...");
          const { data: testData, error: testError } = await supabase
            .from("users")
            .select("id")
            .eq("id", session.user.id)
            .single();

          if (testError) {
            console.error("❌ Database test query failed:", testError.message);
            console.error("❌ Error details:", testError);
          } else {
            console.log("✅ Database test query successful!");
          }
        } catch (verifyError) {
          console.error("❌ Error during verification:", verifyError);
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
      } else if (event === "TOKEN_REFRESHED" && session?.user) {
        console.log("🔄 Token refreshed, updating session data");
        const authUser: AuthUser = {
          id: session.user.id,
          email: session.user.email!,
          created_at: session.user.created_at!,
        };

        // Update stored session data after refresh
        try {
          const provider = await AsyncStorage.getItem("oauth_provider");
          if (provider) {
            await AsyncStorage.setItem(
              "oauth_session",
              JSON.stringify({
                access_token: session.access_token,
                refresh_token: session.refresh_token,
                expires_at: session.expires_at,
                user: authUser,
              })
            );
            console.log("✅ Updated OAuth session after token refresh");
          }
        } catch (error) {
          console.error("Error updating session after refresh:", error);
        }
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
          // If we have a user, just verify the session is still valid without forcing a refresh
          console.log("🔍 User exists - verifying session is still valid...");

          try {
            const supabase = getSupabase();
            const {
              data: { session },
              error,
            } = await supabase.auth.getSession();

            if (session && session.user) {
              console.log("✅ Session still valid after app resume");
              // Session is good, no action needed
            } else {
              console.log(
                "⚠️ Session not found after resume, trying to restore from storage..."
              );
              // Try to restore from stored OAuth session
              const oauthSession = await AsyncStorage.getItem("oauth_session");
              if (oauthSession) {
                const sessionData = JSON.parse(oauthSession);
                console.log("🔄 Restoring session from storage...");
                await supabase.auth.setSession({
                  access_token: sessionData.access_token,
                  refresh_token: sessionData.refresh_token,
                });
                console.log("✅ Session restored from storage");
              } else {
                console.log(
                  "⚠️ No stored session found, user will need to re-login"
                );
                setUser(null);
              }
            }
          } catch (error) {
            console.error("Error checking session after resume:", error);
          }
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

      // Check for OAuth session stored by us (fallback)
      console.log("🔍 Checking for custom OAuth session...");
      const oauthSessionData = await AsyncStorage.getItem("oauth_session");

      console.log("🔍 OAuth session data found:", !!oauthSessionData);

      if (oauthSessionData) {
        try {
          const sessionData = JSON.parse(oauthSessionData);
          console.log(
            "✅ Found custom OAuth session for:",
            sessionData.user?.email
          );

          // Try to restore the Supabase session with the stored tokens
          if (sessionData.access_token && sessionData.refresh_token) {
            try {
              console.log(
                "🔄 Attempting to restore Supabase session with stored tokens..."
              );
              const { data: restoredSession, error: restoreError } =
                await supabase.auth.setSession({
                  access_token: sessionData.access_token,
                  refresh_token: sessionData.refresh_token,
                });

              if (restoreError) {
                console.error("❌ Failed to restore session:", restoreError);
                // Try to refresh the session
                console.log("🔄 Attempting to refresh the session...");
                const { data: refreshedSession, error: refreshError } =
                  await supabase.auth.refreshSession({
                    refresh_token: sessionData.refresh_token,
                  });

                if (refreshError || !refreshedSession.session) {
                  console.error(
                    "❌ Session refresh also failed:",
                    refreshError
                  );
                  // Clear invalid session data
                  await AsyncStorage.multiRemove([
                    "oauth_session",
                    "oauth_user_data",
                    "oauth_user_id",
                    "oauth_provider",
                  ]);
                } else {
                  console.log("✅ Session refreshed successfully!");
                  setUser(sessionData.user);
                  await SessionManager.markUserAsUsedApp();
                  setHasUserData(true);

                  // Update stored session with new tokens
                  await AsyncStorage.setItem(
                    "oauth_session",
                    JSON.stringify({
                      access_token: refreshedSession.session.access_token,
                      refresh_token: refreshedSession.session.refresh_token,
                      expires_at: refreshedSession.session.expires_at,
                      user: sessionData.user,
                    })
                  );
                  return;
                }
              } else {
                console.log("✅ Supabase session restored successfully!");
                setUser(sessionData.user);
                await SessionManager.markUserAsUsedApp();
                setHasUserData(true);
                return;
              }
            } catch (restoreError) {
              console.error("❌ Error restoring session:", restoreError);
            }
          } else {
            console.log("⚠️ OAuth data exists but no tokens - clearing");
            await AsyncStorage.multiRemove([
              "oauth_session",
              "oauth_user_data",
              "oauth_user_id",
              "oauth_provider",
            ]);
          }
        } catch (parseError) {
          console.error("Error parsing OAuth session data:", parseError);
          // Clear corrupted data
          await AsyncStorage.multiRemove([
            "oauth_session",
            "oauth_user_data",
            "oauth_user_id",
            "oauth_provider",
          ]);
        }
      } else {
        console.log("❌ No custom OAuth session data in AsyncStorage");

        // Debug: Check what IS in AsyncStorage
        try {
          console.log(
            "🔍 Searching all AsyncStorage keys for Supabase session..."
          );
          const allKeys = await AsyncStorage.getAllKeys();

          // Check specifically for Supabase session keys
          const authKeys = allKeys.filter(
            (k) =>
              k.includes("supabase") ||
              k.includes("@supabase") ||
              k.includes("auth") ||
              k.includes("sb-")
          );
          console.log("📋 Found auth-related keys:", JSON.stringify(authKeys));

          if (authKeys.length > 0) {
            console.log("📋 Checking stored Supabase session data...");
            for (const key of authKeys) {
              const value = await AsyncStorage.getItem(key);
              if (value) {
                console.log(`  ✓ ${key}: ${value.substring(0, 50)}...`);
              }
            }
          } else {
            console.log("❌ No stored session data available");
          }
        } catch (e) {
          console.error("Error listing AsyncStorage keys:", e);
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

      // Clear all OAuth session data
      await AsyncStorage.multiRemove([
        "oauth_session",
        "oauth_user_data",
        "oauth_user_id",
        "oauth_provider",
        "google_oauth_user_data",
        "google_oauth_user_id",
      ]);

      // Reset the user data flag
      setHasUserData(false);
      console.log("Cleared stored credentials and OAuth data");
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
        // Check for OAuth session data
        import("@react-native-async-storage/async-storage").then(
          async (AsyncStorage) => {
            const oauthSession = await AsyncStorage.default.getItem(
              "oauth_session"
            );
            return !!oauthSession;
          }
        ),
        // Check for legacy Google OAuth data
        import("@react-native-async-storage/async-storage").then(
          async (AsyncStorage) => {
            const googleData = await AsyncStorage.default.getItem(
              "google_oauth_user_data"
            );
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
