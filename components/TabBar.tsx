import { View, Platform, Image, Text } from "react-native";
import { useLinkBuilder, useTheme } from "@react-navigation/native";
import { PlatformPressable } from "@react-navigation/elements";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors } = useTheme();
  const { buildHref } = useLinkBuilder();
  const icons = {
    club: (props: any) => (
      <Image
        source={require("../assets/UI_resources/UI_white/club_white.png")}
        width={0.01}
        height={0.01}
      ></Image>
    ),
    coach: () => (
      <Image
        source={require("../assets/UI_resources/UI_white/coach_white.png")}
      ></Image>
    ),
    map: () => (
      <Image
        source={require("../assets/UI_resources/UI_white/map_white.png")}
      ></Image>
    ),
    index: () => (
      <Image
        source={require("../assets/UI_resources/UI_white/horse_white.png")}
      ></Image>
    ),
    market: () => (
      <Image
        source={require("../assets/UI_resources/UI_white/shop_white.png")}
      ></Image>
    ),
    profile: () => (
      <Image
        source={require("../assets/UI_resources/UI_white/user_white.png")}
      ></Image>
    ),
  };

  return (
    <View style={styles.tabBar}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label =
          options.tabBarLabel !== undefined
            ? options.tabBarLabel
            : options.title !== undefined
            ? options.title
            : route.name;

        const isFocused = state.index === index;

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
            {icons[route.name]({})}
            <Text style={{ color: isFocused ? colors.primary : colors.text }}>
              {label}
            </Text>
          </PlatformPressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    top: "90%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#335C67",
    marginHorizontal: "0%",
    borderTopLeftRadius: 50,
    borderTopRightRadius: 50,
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
