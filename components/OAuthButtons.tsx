import { oauthService } from "@/lib/oauthService";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface OAuthButtonGroupProps {
  isLoading?: boolean;
  onSuccess: (user: any) => void;
  onError: (error: string) => void;
  mode?: string;
  disabled?: boolean;
  showDivider?: boolean;
}

export const OAuthButtonGroup: React.FC<OAuthButtonGroupProps> = ({
  isLoading = false,
  onSuccess,
  onError,
  mode = "login",
  disabled = false,
  showDivider = true,
}) => {
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    try {
      setLoadingProvider("google");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const result = await oauthService.signInWithGoogle();

      if (result.error) {
        onError(result.error);
        return;
      }

      if (result.user) {
        onSuccess(result.user);
      }
    } catch (error) {
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

      if (result.error) {
        onError(result.error);
        return;
      }

      if (result.user) {
        onSuccess(result.user);
      }
    } catch (error) {
      console.error("Apple sign-in error:", error);
      onError("Failed to sign in with Apple");
    } finally {
      setLoadingProvider(null);
    }
  };

  const isButtonLoading = (provider: string) => {
    return isLoading || loadingProvider === provider || disabled;
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.oauthButton, styles.googleButton]}
        onPress={handleGoogleSignIn}
        disabled={isLoading || loadingProvider !== null || disabled}
      >
        {isButtonLoading("google") ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Text style={styles.oauthButtonIcon}>🔍</Text>
            <Text style={styles.oauthButtonText}>Continue with Google</Text>
          </>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.oauthButton, styles.appleButton]}
        onPress={handleAppleSignIn}
        disabled={isLoading || loadingProvider !== null || disabled}
      >
        {isButtonLoading("apple") ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Text style={styles.oauthButtonIcon}>🍎</Text>
            <Text style={styles.oauthButtonText}>Continue with Apple</Text>
          </>
        )}
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
  },
  googleButton: {
    backgroundColor: "#4285F4",
  },
  appleButton: {
    backgroundColor: "#000000",
  },
  oauthButtonIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  oauthButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
});
