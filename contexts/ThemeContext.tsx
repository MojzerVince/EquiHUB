import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

export type ThemeName = "Greenish" | "Pinky" | "Sunset";

export interface Theme {
  name: ThemeName;
  colors: {
    primary: string;
    primaryDark: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    accent: string;
    border: string;
    card: string;
    success: string;
    warning: string;
    error: string;
  };
}

const themes: Record<ThemeName, Theme> = {
  Greenish: {
    name: "Greenish",
    colors: {
      primary: "#335C67",
      primaryDark: "#2D5A66",
      secondary: "#4A9BB7",
      background: "#E9F5F0",
      surface: "#FFFFFF",
      text: "#1C3A42",
      textSecondary: "#666666",
      accent: "#4A9BB7",
      border: "#335C67",
      card: "#1C3A42",
      success: "#4CAF50",
      warning: "#FF9800",
      error: "#FF6B6B",
    },
  },
  Pinky: {
    name: "Pinky",
    colors: {
      primary: "#D81B60",
      primaryDark: "#C2185B",
      secondary: "#F8BBD9",
      background: "#FFFFFF",
      surface: "#FCE4EC",
      text: "#AD1457",
      textSecondary: "#666666",
      accent: "#F48FB1",
      border: "#F8BBD9",
      card: "#880E4F",
      success: "#4CAF50",
      warning: "#FF9800",
      error: "#FF6B6B",
    },
  },
  Sunset: {
    name: "Sunset",
    colors: {
      primary: "#FF5722",
      primaryDark: "#E64A19",
      secondary: "#FFB74D",
      background: "#FFFFFF",
      surface: "#FFF3E0",
      text: "#D84315",
      textSecondary: "#666666",
      accent: "#FFCC80",
      border: "#FFB74D",
      card: "#BF360C",
      success: "#4CAF50",
      warning: "#FF9800",
      error: "#FF6B6B",
    },
  },
};

interface ThemeContextType {
  currentTheme: Theme;
  setTheme: (themeName: ThemeName) => void;
  availableThemes: ThemeName[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = "@equihub_theme";

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [currentTheme, setCurrentTheme] = useState<Theme>(themes.Sunset);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSavedTheme();
  }, []);

  const loadSavedTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (savedTheme && savedTheme in themes) {
        setCurrentTheme(themes[savedTheme as ThemeName]);
      }
    } catch (error) {
      console.error("Error loading saved theme:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const setTheme = async (themeName: ThemeName) => {
    try {
      setCurrentTheme(themes[themeName]);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, themeName);
    } catch (error) {
      console.error("Error saving theme:", error);
    }
  };

  const availableThemes: ThemeName[] = Object.keys(themes) as ThemeName[];

  // Don't render children until theme is loaded to prevent flashing
  if (isLoading) {
    return null;
  }

  return (
    <ThemeContext.Provider value={{ currentTheme, setTheme, availableThemes }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
