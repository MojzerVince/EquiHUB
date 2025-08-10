import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../contexts/ThemeContext";

const MarketScreen = () => {
  const { currentTheme } = useTheme();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: currentTheme.colors.primary },
      ]}
    >
      <SafeAreaView
        style={[
          styles.safeArea,
          { backgroundColor: currentTheme.colors.primary },
        ]}
      >
        <View style={styles.headerContainer}>
          <Text style={styles.header}>Market</Text>
        </View>
      </SafeAreaView>
      <View
        style={[
          styles.viewPort,
          { backgroundColor: currentTheme.colors.background },
        ]}
      >
        <View style={styles.contentContainer}>
          <Text
            style={[styles.comingSoonText, { color: currentTheme.colors.text }]}
          >
            Coming Soon!
          </Text>
          <Text
            style={[
              styles.comingSoonSubtext,
              { color: currentTheme.colors.textSecondary },
            ]}
          >
            This feature is under development.
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    paddingBottom: 0,
  },
  headerContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: "center",
    marginBottom: -45,
  },
  header: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFFFFF",
    fontFamily: "Inder",
    textAlign: "center",
  },
  viewPort: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 130,
  },
  comingSoonText: {
    fontSize: 24,
    fontWeight: "bold",
    fontFamily: "Inder",
    marginBottom: 10,
  },
  comingSoonSubtext: {
    fontSize: 16,
    fontFamily: "Inder",
    textAlign: "center",
  },
});

export default MarketScreen;
