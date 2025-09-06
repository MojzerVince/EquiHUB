import { Image } from "react-native";

interface IconProps {
  focused?: boolean;
}

export const icons = {
  community: ({ focused }: IconProps) => (
    <Image
      source={require("../assets/UI_resources/UI_white/club_white.png")}
      style={{ 
        width: focused ? 28 : 26, 
        height: focused ? 28 : 26,
        opacity: focused ? 1 : 0.8,
      }}
    />
  ),
  coach: ({ focused }: IconProps) => (
    <Image
      source={require("../assets/UI_resources/UI_white/coach_white.png")}
      style={{ 
        width: focused ? 28 : 26, 
        height: focused ? 28 : 26,
        opacity: focused ? 1 : 0.8,
      }}
    />
  ),
  map: ({ focused }: IconProps) => (
    <Image
      source={require("../assets/UI_resources/UI_white/map_white.png")}
      style={{ 
        width: focused ? 28 : 26, 
        height: focused ? 28 : 26,
        opacity: focused ? 1 : 0.8,
      }}
    />
  ),
  index: ({ focused }: IconProps) => (
    <Image
      source={require("../assets/UI_resources/UI_white/horse_white.png")}
      style={{ 
        width: focused ? 28 : 26, 
        height: focused ? 28 : 26,
        opacity: focused ? 1 : 0.8,
      }}
    />
  ),
  profile: ({ focused }: IconProps) => (
    <Image
      source={require("../assets/UI_resources/UI_white/user_white.png")}
      style={{ 
        width: focused ? 28 : 26, 
        height: focused ? 28 : 26,
        opacity: focused ? 1 : 0.8,
      }}
    />
  ),
  settings: ({ focused }: IconProps) => (
    <Image
      source={require("../assets/UI_resources/UI_white/settings_white.png")}
      style={{ 
        width: focused ? 28 : 26, 
        height: focused ? 28 : 26,
        opacity: focused ? 1 : 0.8,
      }}
    />
  ),
};
