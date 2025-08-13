import { Image } from "react-native";

export const icons = {
  club: (props: any) => (
    <Image
      source={require("../assets/UI_resources/UI_white/club_white.png")}
      style={{ width: 48, height: 48 }}
    />
  ),
  coach: () => (
    <Image
      source={require("../assets/UI_resources/UI_white/coach_white.png")}
      style={{ width: 48, height: 48 }}
    />
  ),
  map: () => (
    <Image
      source={require("../assets/UI_resources/UI_white/map_white.png")}
      style={{ width: 48, height: 48 }}
    />
  ),
  index: () => (
    <Image
      source={require("../assets/UI_resources/UI_white/horse_white.png")}
      style={{ width: 48, height: 48 }}
    />
  ),
  profile: () => (
    <Image
      source={require("../assets/UI_resources/UI_white/user_white.png")}
      style={{ width: 48, height: 48 }}
    />
  ),
  settings: () => (
    <Image
      source={require("../assets/UI_resources/UI_white/settings_white.png")}
      style={{ width: 48, height: 48 }}
    />
  ),
};
