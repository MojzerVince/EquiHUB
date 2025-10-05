import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

export type MetricSystem = "metric" | "imperial";

export interface MetricContextType {
  metricSystem: MetricSystem;
  setMetricSystem: (system: MetricSystem) => void;
  // Distance conversion functions
  formatDistance: (meters: number) => string;
  formatDistanceValue: (meters: number) => number;
  formatDistanceUnit: () => string;
  // Speed conversion functions
  formatSpeed: (metersPerSecond: number) => string;
  formatSpeedValue: (metersPerSecond: number) => number;
  formatSpeedUnit: () => string;
  // Temperature conversion functions
  formatTemperature: (celsius: number) => string;
  formatTemperatureValue: (celsius: number) => number;
  formatTemperatureUnit: () => string;
  // Weight conversion functions
  formatWeight: (kilograms: number) => string;
  formatWeightValue: (kilograms: number) => number;
  formatWeightUnit: () => string;
  // Weight input conversion functions
  convertWeightToMetric: (value: number) => number;
  convertWeightFromMetric: (kilograms: number) => number;
  // Height conversion functions
  formatHeight: (centimeters: number) => string;
  formatHeightValue: (centimeters: number) => number;
  formatHeightUnit: () => string;
  // Height input conversion functions
  convertHeightToMetric: (value: number) => number;
  convertHeightFromMetric: (centimeters: number) => number;
}

const MetricContext = createContext<MetricContextType | undefined>(undefined);

const METRIC_STORAGE_KEY = "@equihub_metric_system";

export const MetricProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [metricSystem, setMetricSystemState] = useState<MetricSystem>("metric");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSavedMetricSystem();
  }, []);

  const loadSavedMetricSystem = async () => {
    try {
      const savedSystem = await AsyncStorage.getItem(METRIC_STORAGE_KEY);
      if (
        savedSystem &&
        (savedSystem === "metric" || savedSystem === "imperial")
      ) {
        setMetricSystemState(savedSystem as MetricSystem);
      }
    } catch (error) {
      console.error("Error loading saved metric system:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const setMetricSystem = async (system: MetricSystem) => {
    try {
      setMetricSystemState(system);
      await AsyncStorage.setItem(METRIC_STORAGE_KEY, system);
    } catch (error) {
      console.error("Error saving metric system:", error);
    }
  };

  // Distance conversion functions
  const formatDistance = (meters: number): string => {
    if (metricSystem === "metric") {
      if (meters >= 1000) {
        return `${(meters / 1000).toFixed(2)} km`;
      } else {
        return `${meters.toFixed(0)} m`;
      }
    } else {
      const feet = meters * 3.28084;
      if (feet >= 5280) {
        const miles = feet / 5280;
        return `${miles.toFixed(2)} mi`;
      } else {
        return `${feet.toFixed(0)} ft`;
      }
    }
  };

  const formatDistanceValue = (meters: number): number => {
    if (metricSystem === "metric") {
      return meters >= 1000 ? meters / 1000 : meters;
    } else {
      const feet = meters * 3.28084;
      return feet >= 5280 ? feet / 5280 : feet;
    }
  };

  const formatDistanceUnit = (): string => {
    return metricSystem === "metric" ? "km" : "mi";
  };

  // Speed conversion functions
  const formatSpeed = (metersPerSecond: number): string => {
    if (metricSystem === "metric") {
      const kmh = metersPerSecond * 3.6;
      return `${kmh.toFixed(1)} km/h`;
    } else {
      const mph = metersPerSecond * 2.237;
      return `${mph.toFixed(1)} mph`;
    }
  };

  const formatSpeedValue = (metersPerSecond: number): number => {
    if (metricSystem === "metric") {
      return metersPerSecond * 3.6; // km/h
    } else {
      return metersPerSecond * 2.237; // mph
    }
  };

  const formatSpeedUnit = (): string => {
    return metricSystem === "metric" ? "km/h" : "mph";
  };

  // Temperature conversion functions
  const formatTemperature = (celsius: number): string => {
    if (metricSystem === "metric") {
      return `${celsius.toFixed(1)}°C`;
    } else {
      const fahrenheit = (celsius * 9) / 5 + 32;
      return `${fahrenheit.toFixed(1)}°F`;
    }
  };

  const formatTemperatureValue = (celsius: number): number => {
    if (metricSystem === "metric") {
      return celsius;
    } else {
      return (celsius * 9) / 5 + 32; // Fahrenheit
    }
  };

  const formatTemperatureUnit = (): string => {
    return metricSystem === "metric" ? "°C" : "°F";
  };

  // Weight conversion functions
  const formatWeight = (kilograms: number): string => {
    if (metricSystem === "metric") {
      return `${kilograms.toFixed(1)} kg`;
    } else {
      const pounds = kilograms * 2.205;
      return `${pounds.toFixed(1)} lbs`;
    }
  };

  const formatWeightValue = (kilograms: number): number => {
    if (metricSystem === "metric") {
      return kilograms;
    } else {
      return kilograms * 2.205; // pounds
    }
  };

  const formatWeightUnit = (): string => {
    return metricSystem === "metric" ? "kg" : "lbs";
  };

  // Height conversion functions
  const formatHeight = (centimeters: number): string => {
    if (metricSystem === "metric") {
      return `${centimeters} cm`;
    } else {
      const inches = centimeters / 2.54;
      const feet = Math.floor(inches / 12);
      const remainingInches = Math.round(inches % 12);
      return `${feet}'${remainingInches}"`;
    }
  };

  const formatHeightValue = (centimeters: number): number => {
    if (metricSystem === "metric") {
      return centimeters;
    } else {
      return centimeters / 2.54; // inches
    }
  };

  const formatHeightUnit = (): string => {
    return metricSystem === "metric" ? "cm" : "in";
  };

  // Weight input conversion functions
  const convertWeightToMetric = (value: number): number => {
    if (metricSystem === "metric") {
      return value; // Already in kg
    } else {
      return value / 2.205; // Convert pounds to kg
    }
  };

  const convertWeightFromMetric = (kilograms: number): number => {
    if (metricSystem === "metric") {
      return kilograms; // Stay in kg
    } else {
      return kilograms * 2.205; // Convert kg to pounds
    }
  };

  // Height input conversion functions
  const convertHeightToMetric = (value: number): number => {
    if (metricSystem === "metric") {
      return value; // Already in cm
    } else {
      return value * 2.54; // Convert inches to cm
    }
  };

  const convertHeightFromMetric = (centimeters: number): number => {
    if (metricSystem === "metric") {
      return centimeters; // Stay in cm
    } else {
      return centimeters / 2.54; // Convert cm to inches
    }
  };

  // Don't render children until metric system is loaded
  if (isLoading) {
    return null;
  }

  const value: MetricContextType = {
    metricSystem,
    setMetricSystem,
    formatDistance,
    formatDistanceValue,
    formatDistanceUnit,
    formatSpeed,
    formatSpeedValue,
    formatSpeedUnit,
    formatTemperature,
    formatTemperatureValue,
    formatTemperatureUnit,
    formatWeight,
    formatWeightValue,
    formatWeightUnit,
    convertWeightToMetric,
    convertWeightFromMetric,
    formatHeight,
    formatHeightValue,
    formatHeightUnit,
    convertHeightToMetric,
    convertHeightFromMetric,
  };

  return (
    <MetricContext.Provider value={value}>{children}</MetricContext.Provider>
  );
};

export const useMetric = (): MetricContextType => {
  const context = useContext(MetricContext);
  if (!context) {
    throw new Error("useMetric must be used within a MetricProvider");
  }
  return context;
};
