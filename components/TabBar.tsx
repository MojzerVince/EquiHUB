import { icons } from "@/components/icon";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { PlatformPressable } from "@react-navigation/elements";
import { useLinkBuilder } from "@react-navigation/native";
import type { JSX } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../contexts/ThemeContext";

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { currentTheme } = useTheme();
  const { buildHref } = useLinkBuilder();

  return (
    <SafeAreaView
      edges={["bottom"]}
      style={[styles.safeArea, { backgroundColor: currentTheme.colors.card }]}
    >
      <View
        style={[styles.tabBar, { backgroundColor: currentTheme.colors.card }]}
      >
        {state.routes
          .filter((route) => {
            // Filter out routes that don't have corresponding icons
            return (
              (icons as Record<string, (props: any) => JSX.Element>)[
                route.name
              ] !== undefined
            );
          })
          .map((route) => {
            const { options } = descriptors[route.key];
            const label =
              options.tabBarLabel !== undefined
                ? String(options.tabBarLabel)
                : options.title !== undefined
                ? String(options.title)
                : route.name;

            const isFocused =
              state.index ===
              state.routes.findIndex((r) => r.key === route.key);

            const onPress = () => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            };

            const onLongPress = () => {
              navigation.emit({
                type: "tabLongPress",
                target: route.key,
              });
            };

            return (
              <PlatformPressable
                key={route.name}
                href={buildHref(route.name, route.params)}
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel}
                testID={options.tabBarButtonTestID}
                onPress={onPress}
                onLongPress={onLongPress}
                style={styles.tabBarItem}
              >
                {(icons as Record<string, (props: any) => JSX.Element>)[
                  route.name
                ]?.({})}
              </PlatformPressable>
            );
          })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    position: "absolute",
    width: "100%",
    bottom: 0,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    overflow: "hidden",
  },
  tabBar: {
    paddingTop: 12,
    flexDirection: "row",
    backgroundColor: "#335C67",
    justifyContent: "center",
    alignItems: "center",
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
  },
  tabBarItem: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 10,
    shadowOpacity: 0.1,
  },
});
