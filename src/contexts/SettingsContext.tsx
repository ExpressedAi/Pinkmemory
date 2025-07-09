import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useToast } from '@/hooks/useToast';
import { AGENT_A_MODEL, AGENT_B_EMBED_MODEL, AGENT_B_META_MODEL, AGENT_C_EMBED_MODEL, AGENT_C_META_MODEL } from '@/services/api';

// Model definitions
export interface Settings {
  apiKeyA: string;
  apiKeyB: string;
  apiKeyC: string;
  globalPrompt: string;
  autonomyEnabled: boolean;
  autonomyInterval: number; // in seconds
  autonomyPrompt: string;
  modelA: string;
  modelBEmbed: string;
  modelBMeta: string;
  modelCEmbed: string;
  modelCMeta: string;
}

interface SettingsContextType {
  settings: Settings;
  updateSettings: (newSettings: Partial<Settings>) => void;
  saveSettings: () => void;
}

interface SettingsProviderProps {
  children: ReactNode;
}

const SETTINGS_KEY = "metaVectorSettings";

const defaultSettings: Settings = {
  apiKeyA: "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",
  apiKeyB: "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",
  apiKeyC: "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",
  globalPrompt: "",
  autonomyEnabled: false,
  autonomyInterval: 30, // 30 seconds default
  autonomyPrompt: "You are an introspective AI agent. Review these memories and generate a thoughtful reflection or insight that synthesizes them in a new way. Focus on finding patterns, drawing conclusions, or generating novel perspectives.\n\nGenerate a reflection that:\n1. Synthesizes these memories in an interesting way\n2. Draws novel connections or insights\n3. Is written in a clear, natural style\n4. Could be valuable for future context",
  modelA: AGENT_A_MODEL,
  modelBEmbed: AGENT_B_EMBED_MODEL,
  modelBMeta: AGENT_B_META_MODEL,
  modelCEmbed: AGENT_C_EMBED_MODEL,
  modelCMeta: AGENT_C_META_MODEL
};

export const SettingsContext = createContext<SettingsContextType>({
  settings: defaultSettings,
  updateSettings: () => {},
  saveSettings: () => {},
});

export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider: React.FC<SettingsProviderProps> = ({ children }) => {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const { toast } = useToast();

  // Load settings on mount
  useEffect(() => {
    try {
      const storedSettings = localStorage.getItem(SETTINGS_KEY);
      if (storedSettings) {
        const parsedSettings = JSON.parse(storedSettings);
        setSettings(prevSettings => ({
          ...defaultSettings,  // Always start with defaults
          ...parsedSettings   // Override with stored values
        }));
      } else {
        // If no settings found, save defaults
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(defaultSettings));
      }
    } catch (e) {
      console.error("Failed to load settings:", e);
      toast({
        title: "Error loading settings",
        description: "Using default settings",
        variant: "error"
      });
    }
  }, []);

  const updateSettings = (newSettings: Partial<Settings>) => {
    try {
      const updatedSettings = { ...settings, ...newSettings };
      setSettings(updatedSettings);
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(updatedSettings));
    } catch (e) {
      console.error("Failed to update settings:", e);
      toast({
        title: "Error saving settings",
        description: "Changes could not be saved",
        variant: "error"
      });
    }
  };

  const saveSettings = () => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      toast({
        title: "Settings saved successfully",
        description: "Your preferences have been stored",
        variant: "success"
      });
    } catch (e) {
      console.error("Failed to save settings to localStorage", e);
      toast({
        title: "Error saving settings",
        description: "Your settings could not be saved. Please try again.",
        variant: "error"
      });
    }
  };

  return (
    <SettingsContext.Provider 
      value={{ 
        settings, 
        updateSettings, 
        saveSettings
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};