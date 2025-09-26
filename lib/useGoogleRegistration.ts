import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { useGoogleAuth } from './googleAuth';
import { GoogleAuthService } from './googleAuthService';

export interface GoogleRegistrationResult {
  success: boolean;
  user?: any;
  error?: string;
  requiresRegistration?: boolean;
  googleUserInfo?: any;
}

/**
 * Custom hook for Google Registration that integrates with your existing UI
 */
export const useGoogleRegistration = () => {
  const { promptAsync } = useGoogleAuth();
  const [loading, setLoading] = useState(false);

  /**
   * Step 1: Get Google user info (doesn't create Supabase account yet)
   */
  const getGoogleUserInfo = async (): Promise<{
    success: boolean;
    userInfo?: any;
    error?: string;
  }> => {
    try {
      setLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const result = await promptAsync() as any;
      
      if (result?.type === 'success') {
        return {
          success: true,
          userInfo: {
            id: result.user.id,
            email: result.user.email,
            name: result.user.name,
            picture: result.user.picture || result.user.photo
          }
        };
      } else if (result?.type === 'cancelled') {
        return { success: false, error: 'Google sign-in was cancelled' };
      } else {
        return { success: false, error: result?.error || 'Google sign-in failed' };
      }
    } catch (error: any) {
      console.error('Google auth error:', error);
      return { success: false, error: error.message || 'Google sign-in failed' };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Step 2: Complete registration with profile data
   */
  const completeRegistration = async (
    googleUserInfo: {
      id: string;
      email: string;
      name: string;
      picture?: string;
    },
    profileData: {
      name: string;
      age: number;
      description?: string;
      riding_experience?: number;
      stable_id?: string;
    }
  ): Promise<GoogleRegistrationResult> => {
    try {
      setLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const result = await GoogleAuthService.completeGoogleRegistration(
        googleUserInfo,
        profileData
      );

      if (result.error) {
        if (result.error === 'MAGIC_LINK_SENT') {
          return {
            success: false,
            error: 'An account with this email already exists. Please check your email for a sign-in link.'
          };
        }
        return { success: false, error: result.error };
      }

      if (result.user) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return {
          success: true,
          user: result.user
        };
      }

      return { success: false, error: 'Registration failed' };
    } catch (error: any) {
      console.error('Registration completion error:', error);
      return { success: false, error: error.message || 'Registration failed' };
    } finally {
      setLoading(false);
    }
  };

  /**
   * One-step registration (for simple flows where profile data is minimal)
   */
  const registerWithGoogle = async (profileData: {
    name: string;
    age: number;
    description?: string;
    riding_experience?: number;
    stable_id?: string;
  }): Promise<GoogleRegistrationResult> => {
    try {
      // Step 1: Get Google user info
      const googleResult = await getGoogleUserInfo();
      
      if (!googleResult.success || !googleResult.userInfo) {
        return { 
          success: false, 
          error: googleResult.error || 'Failed to get Google user info' 
        };
      }

      // Step 2: Complete registration
      return await completeRegistration(googleResult.userInfo, profileData);
    } catch (error: any) {
      console.error('Google registration error:', error);
      return { success: false, error: error.message || 'Google registration failed' };
    }
  };

  /**
   * Sign in existing Google user
   */
  const signInWithGoogle = async (): Promise<GoogleRegistrationResult> => {
    try {
      const googleResult = await getGoogleUserInfo();
      
      if (!googleResult.success || !googleResult.userInfo) {
        return { 
          success: false, 
          error: googleResult.error || 'Failed to get Google user info' 
        };
      }

      // Check if user exists
      const { exists } = await GoogleAuthService.checkGoogleUserExists(
        googleResult.userInfo.email
      );
      
      if (!exists) {
        return { 
          success: false, 
          error: 'GOOGLE_USER_NOT_FOUND',
          requiresRegistration: true,
          googleUserInfo: googleResult.userInfo
        };
      }

      // Try to sign in existing user
      const signInResult = await GoogleAuthService.signInExistingGoogleUser(
        googleResult.userInfo
      );
      
      if (signInResult.error === 'MAGIC_LINK_SENT') {
        return {
          success: false,
          error: 'Please check your email for a sign-in link.'
        };
      }

      return { 
        success: !signInResult.error, 
        user: signInResult.user,
        error: signInResult.error || undefined
      };
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      return { success: false, error: error.message || 'Google sign-in failed' };
    }
  };

  return {
    loading,
    getGoogleUserInfo,
    completeRegistration,
    registerWithGoogle,
    signInWithGoogle
  };
};

/**
 * Example usage in a component:
 * 
 * // For 2-step registration (Google auth → Profile form → Complete)
 * const TwoStepRegistration = () => {
 *   const { getGoogleUserInfo, completeRegistration, loading } = useGoogleRegistration();
 *   const [step, setStep] = useState(1);
 *   const [googleUser, setGoogleUser] = useState(null);
 *   
 *   const handleGoogleAuth = async () => {
 *     const result = await getGoogleUserInfo();
 *     if (result.success) {
 *       setGoogleUser(result.userInfo);
 *       setStep(2);
 *     }
 *   };
 *   
 *   const handleProfileSubmit = async (profileData) => {
 *     const result = await completeRegistration(googleUser, profileData);
 *     if (result.success) {
 *       // Navigate to home
 *     }
 *   };
 * };
 * 
 * // For 1-step registration (all data collected upfront)
 * const OneStepRegistration = () => {
 *   const { registerWithGoogle, loading } = useGoogleRegistration();
 *   
 *   const handleRegister = async (formData) => {
 *     const result = await registerWithGoogle(formData);
 *     if (result.success) {
 *       // Navigate to home
 *     }
 *   };
 * };
 */