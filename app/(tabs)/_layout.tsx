import { TabBar } from "@/components/TabBar";
import { Tabs } from "expo-router";
import React from "react";

const TabLayout = () => {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="club" options={{ title: "Club" }} />
      <Tabs.Screen name="coach" options={{ title: "Coach" }} />
      <Tabs.Screen name="map" options={{ title: "Map" }} />
      <Tabs.Screen name="index" options={{ title: "My Horses" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
      <Tabs.Screen
        name="options"
        options={{
          title: "Options",
          href: null, // Hide from tab bar but keep as route
        }}
      />
    </Tabs>
  );
};

export default TabLayout;
