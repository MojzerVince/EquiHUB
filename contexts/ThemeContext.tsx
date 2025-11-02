import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";
import { useColorScheme } from "react-native";

export type ThemeName = "Greenish" | "Pinky" | "Sunset" | "Dark";

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
  Dark: {
    name: "Dark",
    colors: {
      primary: "#1E1E1E",
      primaryDark: "#121212",
      secondary: "#BB86FC",
      background: "#121212",
      surface: "#3f3f3fff",
      text: "#afafafff",
      textSecondary: "#7f7f7fff",
      accent: "#03DAC6",
      border: "#2C2C2C",
      card: "#2C2C2C",
      success: "#4CAF50",
      warning: "#FF9800",
      error: "#CF6679",
    },
  },
};

interface ThemeContextType {
  currentTheme: Theme;
  setTheme: (themeName: ThemeName) => void;
  availableThemes: ThemeName[];
  selectedThemeName: ThemeName;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = "@equihub_theme";

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const systemColorScheme = useColorScheme(); // 'light' | 'dark' | null
  const [selectedThemeName, setSelectedThemeName] = useState<ThemeName>("Sunset");
  const [currentTheme, setCurrentTheme] = useState<Theme>(themes.Sunset);
  const [isLoading, setIsLoading] = useState(true);

  // Load saved theme on mount
  useEffect(() => {
    loadSavedTheme();
  }, []);

  // Update theme when system theme or selected theme changes
  useEffect(() => {
    updateCurrentTheme();
  }, [selectedThemeName, systemColorScheme]);

  const loadSavedTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (savedTheme && savedTheme in themes) {
        setSelectedThemeName(savedTheme as ThemeName);
      } else {
        // Default to Sunset if no saved theme
        setSelectedThemeName("Sunset");
      }
    } catch (error) {
      console.error("Error loading saved theme:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateCurrentTheme = () => {
    // Use selected theme
    setCurrentTheme(themes[selectedThemeName]);
  };

  const setTheme = async (themeName: ThemeName) => {
    try {
      setSelectedThemeName(themeName);
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
    <ThemeContext.Provider value={{ currentTheme, setTheme, availableThemes, selectedThemeName }}>
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
