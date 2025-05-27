import React from "react";
import { Tabs } from "expo-router";
import { TabBar } from "@/components/TabBar";
import { Platform } from "react-native";
import TabBarBackground from "@/components/ui/TabBarBackground";

const TabLayout = () => {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarBackground: TabBarBackground,
        tabBarStyle: Platform.select({
          ios: {
            position: "absolute",
          },
          default: {},
        }),
      }}
    >
      <Tabs.Screen name="club" options={{ title: "Club" }} />
      <Tabs.Screen name="coach" options={{ title: "Coach" }} />
      <Tabs.Screen name="map" options={{ title: "Map" }} />
      <Tabs.Screen name="index" options={{ title: "My Horses" }} />
      <Tabs.Screen name="market" options={{ title: "Marketplace" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
};

export default TabLayout;
