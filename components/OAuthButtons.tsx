import { AuthResult, oauthService } from "@/lib/oauthService";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface OAuthButtonsProps {
  onSuccess: (result: AuthResult) => void;
  onError: (error: string) => void;
  disabled?: boolean;
  isSignUp?: boolean;
  style?: any;
}

export const OAuthButtons: React.FC<OAuthButtonsProps> = ({
  onSuccess,
  onError,
  disabled = false,
  isSignUp = false,
  style,
}) => {
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    try {
      setLoadingProvider("google");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const result = await oauthService.signInWithGoogle();

      if (result.success) {
        onSuccess(result);
      } else {
        onError(result.error || "Google sign-in failed");
      }
    } catch (error: any) {
      console.error("Google sign-in error:", error);
      onError("Failed to sign in with Google");
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleAppleSignIn = async () => {
    try {
      setLoadingProvider("apple");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const result = await oauthService.signInWithApple();

      if (result.success) {
        onSuccess(result);
      } else {
        onError(result.error || "Apple sign-in failed");
      }
    } catch (error: any) {
      console.error("Apple sign-in error:", error);
      onError("Failed to sign in with Apple");
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleFacebookSignIn = async () => {
    try {
      setLoadingProvider("facebook");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const result = await oauthService.signInWithFacebook();

      if (result.success) {
        onSuccess(result);
      } else {
        onError(result.error || "Facebook sign-in failed");
      }
    } catch (error: any) {
      console.error("Facebook sign-in error:", error);
      onError("Failed to sign in with Facebook");
    } finally {
      setLoadingProvider(null);
    }
  };

  const isButtonLoading = (provider: string) => {
    return loadingProvider === provider;
  };

  const isAnyLoading = () => {
    return loadingProvider !== null || disabled;
  };

  return (
    <View style={[styles.container, style]}>
      {/* Google Sign-In - Available on both platforms */}
      <TouchableOpacity
        style={[styles.oauthButton, styles.googleButton]}
        onPress={handleGoogleSignIn}
        disabled={isAnyLoading()}
      >
        {isButtonLoading("google") ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Image
              source={require("../assets/in_app_icons/google.png")}
              style={styles.oauthButtonIcon}
            />
            <Text style={styles.oauthButtonText}>
              {isSignUp ? "Sign up with Google" : "Continue with Google"}
            </Text>
          </>
        )}
      </TouchableOpacity>

      {/* Apple Sign-In - iOS only */}
      {Platform.OS === "ios" && (
        <TouchableOpacity
          style={[styles.oauthButton, styles.appleButton]}
          onPress={handleAppleSignIn}
          disabled={isAnyLoading()}
        >
          {isButtonLoading("apple") ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Image
                source={require("../assets/in_app_icons/apple.png")}
                style={styles.oauthButtonIcon}
              />
              <Text style={styles.oauthButtonText}>
                {isSignUp ? "Sign up with Apple" : "Continue with Apple"}
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {/* Facebook Sign-In - Disabled */}
      <TouchableOpacity
        style={[
          styles.oauthButton,
          styles.facebookButton,
          styles.disabledButton,
        ]}
        disabled={true}
      >
        <Image
          style={styles.oauthButtonIcon}
          source={require("../assets/in_app_icons/facebook.png")}
        />
        <Text style={[styles.oauthButtonText, styles.disabledText]}>
          {isSignUp
            ? "Sign up with Facebook (Coming Soon)"
            : "Continue with Facebook (Coming Soon)"}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
    gap: 12,
  },
  oauthButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    minHeight: 56,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 3,
  },
  googleButton: {
    backgroundColor: "#000000ff",
  },
  appleButton: {
    backgroundColor: "#000000",
  },
  facebookButton: {
    backgroundColor: "#1877F2",
  },
  disabledButton: {
    backgroundColor: "#999",
    opacity: 0.6,
  },
  oauthButtonIcon: {
    width: 24,
    height: 24,
    marginRight: 12,
  },
  oauthButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  disabledText: {
    color: "#cccccc",
  },
});

export default OAuthButtons;
