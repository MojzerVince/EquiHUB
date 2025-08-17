import React, { createContext, useContext, useState } from 'react';

interface SplashContextType {
  splashActive: boolean;
  setSplashActive: (active: boolean) => void;
}

const SplashContext = createContext<SplashContextType | undefined>(undefined);

export const useSplash = () => {
  const context = useContext(SplashContext);
  if (context === undefined) {
    throw new Error('useSplash must be used within a SplashProvider');
  }
  return context;
};

interface SplashProviderProps {
  children: React.ReactNode;
}

export const SplashProvider: React.FC<SplashProviderProps> = ({ children }) => {
  const [splashActive, setSplashActive] = useState(true);

  return (
    <SplashContext.Provider value={{ splashActive, setSplashActive }}>
      {children}
    </SplashContext.Provider>
  );
};
