import { Image } from "react-native";

interface IconProps {
  focused?: boolean;
}

export const icons = {
  community: ({ focused }: IconProps) => (
    <Image
      source={require("../assets/in_app_icons/community.png")}
      style={{
        width: focused ? 40 : 34,
        height: focused ? 40 : 34,
        opacity: focused ? 1 : 0.8,
      }}
    />
  ),
  coach: ({ focused }: IconProps) => (
    <Image
      source={require("../assets/UI_resources/UI_white/coach_white.png")}
      style={{
        width: focused ? 40 : 34,
        height: focused ? 40 : 34,
        opacity: focused ? 1 : 0.8,
      }}
    />
  ),
  map: ({ focused }: IconProps) => (
    <Image
      source={require("../assets/in_app_icons/map.png")}
      style={{
        width: focused ? 40 : 34,
        height: focused ? 40 : 34,
        opacity: focused ? 1 : 0.8,
      }}
    />
  ),
  index: ({ focused }: IconProps) => (
    <Image
      source={require("../assets/in_app_icons/horse.png")}
      style={{
        width: focused ? 40 : 34,
        height: focused ? 40 : 34,
        opacity: focused ? 1 : 0.8,
      }}
    />
  ),
  profile: ({ focused }: IconProps) => (
    <Image
      source={require("../assets/in_app_icons/profile.png")}
      style={{
        width: focused ? 40 : 34,
        height: focused ? 40 : 34,
        opacity: focused ? 1 : 0.8,
      }}
    />
  ),
  settings: ({ focused }: IconProps) => (
    <Image
      source={require("../assets/in_app_icons/settings.png")}
      style={{
        width: focused ? 40 : 34,
        height: focused ? 40 : 34,
        opacity: focused ? 1 : 0.8,
      }}
    />
  ),
};
