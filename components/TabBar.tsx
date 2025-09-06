import { icons } from "@/components/icon";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { PlatformPressable } from "@react-navigation/elements";
import { useLinkBuilder } from "@react-navigation/native";
import type { JSX } from "react";
import { useEffect, useRef } from "react";
import { Animated, Dimensions, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../contexts/ThemeContext";

const { width: screenWidth } = Dimensions.get('window');

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { currentTheme } = useTheme();
  const { buildHref } = useLinkBuilder();
  
  // Animation values for each tab
  const animationValues = useRef(
    state.routes.map(() => new Animated.Value(0))
  ).current;

  // Slide indicator animation
  const slideAnim = useRef(new Animated.Value(0)).current;

  const filteredRoutes = state.routes.filter((route) => {
    return (
      (icons as Record<string, (props: any) => JSX.Element>)[route.name] !== undefined
    );
  });

  // Calculate dimensions properly accounting for container padding
  const containerPadding = 40; // 20px on each side
  const availableWidth = screenWidth - containerPadding;
  const tabWidth = availableWidth / filteredRoutes.length;

  useEffect(() => {
    const focusedIndex = filteredRoutes.findIndex(
      (route) => route.key === state.routes[state.index]?.key
    );
    
    if (focusedIndex !== -1) {
      // Calculate the center position of the focused tab
      const tabCenter = focusedIndex * tabWidth + (tabWidth / 2);
      const indicatorWidth = tabWidth * 0.8; // 80% of tab width for better appearance
      const indicatorLeft = tabCenter - (indicatorWidth / 2);
      
      Animated.spring(slideAnim, {
        toValue: indicatorLeft,
        useNativeDriver: false,
        tension: 120,
        friction: 8,
      }).start();
    }
  }, [state.index, tabWidth, slideAnim, filteredRoutes]);

  return (
    <SafeAreaView
      edges={["bottom"]}
      style={styles.safeArea}
    >
      <View style={styles.container}>
        <View
          style={[
            styles.tabBar,
            {
              backgroundColor: '#34495E', // Lighter blue-gray background
              shadowColor: '#000000',
            }
          ]}
        >
          {/* Animated slide indicator */}
          <Animated.View
            style={[
              styles.slideIndicator,
              {
                left: slideAnim,
                width: tabWidth * 0.8, // 80% of tab width for better appearance
                backgroundColor: '#5DADE2', // Bright blue color for visibility
              }
            ]}
          />

          {filteredRoutes.map((route, index) => {
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
                // Animate button press
                Animated.sequence([
                  Animated.timing(animationValues[index], {
                    toValue: 1,
                    duration: 100,
                    useNativeDriver: true,
                  }),
                  Animated.timing(animationValues[index], {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                  }),
                ]).start();

                navigation.navigate(route.name, route.params);
              }
            };

            const onLongPress = () => {
              navigation.emit({
                type: "tabLongPress",
                target: route.key,
              });
            };

            const scaleValue = animationValues[index].interpolate({
              inputRange: [0, 1],
              outputRange: [1, 0.95],
            });

            return (
              <PlatformPressable
                key={route.name}
                href={buildHref(route.name, route.params)}
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel}
                testID={options.tabBarButtonTestID}
                onPress={onPress}
                onLongPress={onLongPress}
                style={[styles.tabBarItem, { width: tabWidth }]}
              >
                <Animated.View 
                  style={[
                    styles.tabBarItemContent,
                    {
                      transform: [{ scale: scaleValue }],
                    }
                  ]}
                >
                  {/* Icon */}
                  <View style={styles.iconContainer}>
                    {(icons as Record<string, (props: any) => JSX.Element>)[
                      route.name
                    ]?.({ focused: isFocused })}
                  </View>
                  
                  {/* Label */}
                  <Text 
                    style={[
                      styles.tabBarLabel,
                      { 
                        color: isFocused 
                          ? '#FFFFFF' // White for focused tabs
                          : '#B0B0B0', // Light gray for unfocused tabs
                        fontWeight: isFocused ? '600' : '500',
                      }
                    ]}
                    numberOfLines={1}
                  >
                    {label}
                  </Text>
                </Animated.View>
              </PlatformPressable>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    position: "absolute",
    width: "100%",
    bottom: 0,
  },
  container: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  tabBar: {
    flexDirection: "row",
    borderRadius: 25,
    paddingVertical: 20, // Increased from 15 to 20 for more height
    paddingHorizontal: 0, // Remove horizontal padding from tabBar
    position: "relative",
    minHeight: 80, // Add minimum height to ensure icons fit
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25, // Increased shadow for dark background
    shadowRadius: 12,
    elevation: 8,
  },
  slideIndicator: {
    position: "absolute",
    top: 10, // Better positioning within the tab bar
    height: "75%", // Larger height for better visibility
    borderRadius: 20,
    opacity: 0.8, // Much more visible
    marginHorizontal: 0, // Remove margin for better alignment
  },
  tabBarItem: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1, // Ensure equal distribution
  },
  tabBarItemContent: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8, // Increased from 5 for better spacing
  },
  iconContainer: {
    marginBottom: 6, // Increased margin for better spacing
    minHeight: 28, // Ensure consistent height for all icons
    justifyContent: "center",
    alignItems: "center",
  },
  tabBarLabel: {
    fontSize: 11,
    textAlign: "center",
    color: '#FFFFFF', // White text for dark background
  },
});
