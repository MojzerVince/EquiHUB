import React, { useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { OAuthProvider, OAuthService } from "../lib/oauthService";

interface OAuthButtonProps {
  provider: OAuthProvider;
  mode: "login" | "register";
  onSuccess: (user: any) => void;
  onError: (error: string) => void;
  disabled?: boolean;
}

export const OAuthButton: React.FC<OAuthButtonProps> = ({
  provider,
  mode,
  onSuccess,
  onError,
  disabled = false,
}) => {
  const { currentTheme } = useTheme();
  const theme = currentTheme;
  const [loading, setLoading] = useState(false);

  const handlePress = async () => {
    if (disabled || loading) return;

    setLoading(true);

    try {
      let result;

      if (mode === "login") {
        if (provider.id === "google") {
          result = await OAuthService.signInWithGoogle();
        } else if (provider.id === "apple") {
          result = await OAuthService.signInWithApple();
        } else {
          throw new Error(`Unsupported provider: ${provider.id}`);
        }
      } else {
        // Register mode
        if (provider.id === "google") {
          result = await OAuthService.registerWithGoogle();
        } else if (provider.id === "apple") {
          result = await OAuthService.registerWithApple();
        } else {
          throw new Error(`Unsupported provider: ${provider.id}`);
        }
      }

      if (result.error) {
        onError(result.error);
      } else if (result.user) {
        onSuccess(result.user);
      } else {
        onError("Authentication failed");
      }
    } catch (error) {
      console.error(`OAuth ${provider.id} error:`, error);
      onError(`Failed to ${mode} with ${provider.name}`);
    } finally {
      setLoading(false);
    }
  };

  const getButtonStyle = () => {
    if (provider.id === "google") {
      return {
        ...styles.button,
        backgroundColor: disabled ? "#f8f9fa" : "#ffffff",
        borderColor: disabled ? "#e8eaed" : "#dadce0",
        borderWidth: 1,
        opacity: disabled ? 0.6 : 1,
      };
    }

    if (provider.id === "apple") {
      return {
        ...styles.button,
        backgroundColor: disabled ? "#1c1c1e" : "#000000",
        borderColor: disabled ? "#1c1c1e" : "#000000",
        borderWidth: 0,
        opacity: disabled ? 0.6 : 1,
      };
    }

    return styles.button;
  };

  const getTextStyle = () => {
    if (provider.id === "google") {
      return {
        ...styles.buttonText,
        color: disabled ? "#999999" : "#3c4043",
        fontWeight: "500" as const,
      };
    }

    if (provider.id === "apple") {
      return {
        ...styles.buttonText,
        color: disabled ? "#cccccc" : "#ffffff",
        fontWeight: "600" as const,
      };
    }

    return styles.buttonText;
  };

  const getButtonText = () => {
    if (provider.id === "google") {
      return mode === "login" ? "Continue with Google" : "Continue with Google";
    }
    if (provider.id === "apple") {
      return mode === "login" ? "Continue with Apple" : "Continue with Apple";
    }
    return `${mode === "login" ? "Sign in" : "Sign up"} with ${provider.name}`;
  };

  return (
    <TouchableOpacity
      style={getButtonStyle()}
      onPress={handlePress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      <View style={styles.buttonContent}>
        {loading ? (
          <ActivityIndicator
            size="small"
            color={provider.id === "apple" ? "#ffffff" : "#4285f4"}
            style={styles.loadingIcon}
          />
        ) : (
          <>
            {provider.id === "google" && (
              <View style={styles.googleIcon}>
                <Text style={styles.googleG}>G</Text>
              </View>
            )}
            {provider.id === "apple" && (
              <Text style={styles.appleIcon}>🍎</Text>
            )}
          </>
        )}
        <Text style={getTextStyle()}>{getButtonText()}</Text>
      </View>
    </TouchableOpacity>
  );
};

interface OAuthButtonGroupProps {
  mode: "login" | "register";
  onSuccess: (user: any) => void;
  onError: (error: string) => void;
  disabled?: boolean;
  showDivider?: boolean;
}

export const OAuthButtonGroup: React.FC<OAuthButtonGroupProps> = ({
  mode,
  onSuccess,
  onError,
  disabled = false,
  showDivider = true,
}) => {
  const { currentTheme } = useTheme();
  const theme = currentTheme;
  const availableProviders = OAuthService.getAvailableProviders();

  if (availableProviders.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {showDivider && (
        <View style={styles.dividerContainer}>
          <View
            style={[
              styles.dividerLine,
              { backgroundColor: theme.colors.border },
            ]}
          />
          <Text
            style={[styles.dividerText, { color: theme.colors.textSecondary }]}
          >
            Or continue with
          </Text>
          <View
            style={[
              styles.dividerLine,
              { backgroundColor: theme.colors.border },
            ]}
          />
        </View>
      )}

      <View style={styles.buttonsContainer}>
        {availableProviders.map((provider) => (
          <OAuthButton
            key={provider.id}
            provider={provider}
            mode={mode}
            onSuccess={onSuccess}
            onError={onError}
            disabled={disabled}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 15,
    fontSize: 14,
    fontWeight: "500",
  },
  buttonsContainer: {
    gap: 12,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    minHeight: 50,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  loadingIcon: {
    marginRight: 12,
  },
  googleIcon: {
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  googleG: {
    color: "#4285f4",
    fontSize: 16,
    fontWeight: "700",
  },
  appleIcon: {
    fontSize: 16,
    marginRight: 12,
    color: "#ffffff",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "500",
  },
});
