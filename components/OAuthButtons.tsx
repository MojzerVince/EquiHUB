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
    const baseStyle = {
      ...styles.button,
      backgroundColor: disabled ? theme.colors.surface : "white",
      borderColor: theme.colors.border,
      opacity: disabled ? 0.6 : 1,
    };

    // Special styling for Apple button
    if (provider.id === "apple") {
      return {
        ...baseStyle,
        backgroundColor: disabled ? theme.colors.surface : "#000000",
      };
    }

    return baseStyle;
  };

  const getTextStyle = () => {
    const baseStyle = {
      ...styles.buttonText,
      color: disabled ? theme.colors.textSecondary : theme.colors.text,
    };

    // White text for Apple button
    if (provider.id === "apple") {
      return {
        ...baseStyle,
        color: disabled ? theme.colors.textSecondary : "#ffffff",
      };
    }

    return baseStyle;
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
            color={provider.id === "apple" ? "#ffffff" : theme.colors.primary}
            style={styles.icon}
          />
        ) : (
          <Text style={[styles.icon, getTextStyle()]}>{provider.icon}</Text>
        )}
        <Text style={getTextStyle()}>
          {mode === "login" ? "Sign in" : "Sign up"} with {provider.name}
        </Text>
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
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 56,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  icon: {
    fontSize: 20,
    marginRight: 12,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
