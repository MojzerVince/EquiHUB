import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface Location {
  latitude: number;
  longitude: number;
  timestamp: number;
}

interface TrackingSession {
  id: string;
  startTime: number;
  endTime?: number;
  locations: Location[];
  distance: number;
  duration: number;
  name?: string;
}

interface TrackingContextType {
  sessions: TrackingSession[];
  saveSessions: (session: TrackingSession) => Promise<void>;
  deleteSessions: (sessionId: string) => Promise<void>;
  loadSessions: () => Promise<void>;
}

const TrackingContext = createContext<TrackingContextType | undefined>(undefined);

const SESSIONS_STORAGE_KEY = "tracking_sessions";

export const TrackingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sessions, setSessions] = useState<TrackingSession[]>([]);

  // Load sessions from storage on mount
  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const storedSessions = await AsyncStorage.getItem(SESSIONS_STORAGE_KEY);
      if (storedSessions) {
        const parsedSessions = JSON.parse(storedSessions);
        setSessions(parsedSessions);
      }
    } catch (error) {
      console.error("Error loading sessions:", error);
    }
  };

  const saveSessions = async (session: TrackingSession) => {
    try {
      const updatedSessions = [...sessions, session];
      setSessions(updatedSessions);
      await AsyncStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(updatedSessions));
    } catch (error) {
      console.error("Error saving session:", error);
      throw error;
    }
  };

  const deleteSessions = async (sessionId: string) => {
    try {
      const updatedSessions = sessions.filter(session => session.id !== sessionId);
      setSessions(updatedSessions);
      await AsyncStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(updatedSessions));
    } catch (error) {
      console.error("Error deleting session:", error);
      throw error;
    }
  };

  const value: TrackingContextType = {
    sessions,
    saveSessions,
    deleteSessions,
    loadSessions,
  };

  return (
    <TrackingContext.Provider value={value}>
      {children}
    </TrackingContext.Provider>
  );
};

export const useTracking = (): TrackingContextType => {
  const context = useContext(TrackingContext);
  if (!context) {
    throw new Error("useTracking must be used within a TrackingProvider");
  }
  return context;
};
