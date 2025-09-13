import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { OAuthService } from "../lib/oauthService";

export const OAuthStatus: React.FC = () => {
  const { currentTheme } = useTheme();
  const theme = currentTheme;
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkOAuthAvailability();
  }, []);

  const checkOAuthAvailability = async () => {
    try {
      const isAppleAvailable = await OAuthService.isAppleSignInAvailable();
      setAppleAvailable(isAppleAvailable);
    } catch (error) {
      console.error("Error checking OAuth availability:", error);
    } finally {
      setLoading(false);
    }
  };

  const availableProviders = OAuthService.getAvailableProviders();

  if (loading) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: theme.colors.textSecondary }]}>
        Available Sign-In Methods:
      </Text>
      <View style={styles.providersList}>
        <Text style={[styles.provider, { color: theme.colors.text }]}>
          📧 Email & Password
        </Text>
        {availableProviders.map((provider) => (
          <Text
            key={provider.id}
            style={[styles.provider, { color: theme.colors.text }]}
          >
            {provider.icon} {provider.name}
            {provider.id === "apple" && !appleAvailable && " (Not Available)"}
          </Text>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    marginVertical: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  providersList: {
    gap: 4,
  },
  provider: {
    fontSize: 14,
    fontWeight: "500",
  },
});
