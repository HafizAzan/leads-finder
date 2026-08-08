"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { ConnectionStatus, EmailProvider, EmailSettings } from "@/app/types/lead";

type SettingsContextValue = {
  settings: EmailSettings;
  setProvider: (provider: EmailProvider) => void;
  setEmailAddress: (emailAddress: string) => void;
  setMinDelay: (value: number) => void;
  setMaxDelay: (value: number) => void;
  connectEmail: () => Promise<void>;
  disconnectEmail: () => void;
};

const defaultSettings: EmailSettings = {
  provider: "gmail",
  emailAddress: "",
  connectionStatus: "not_connected",
  minDelay: 10,
  maxDelay: 90,
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<EmailSettings>(defaultSettings);

  const setProvider = useCallback((provider: EmailProvider) => {
    setSettings((prev) => ({ ...prev, provider }));
  }, []);

  const setEmailAddress = useCallback((emailAddress: string) => {
    setSettings((prev) => ({ ...prev, emailAddress }));
  }, []);

  const setMinDelay = useCallback((value: number) => {
    setSettings((prev) => {
      const minDelay = Math.max(0, value);
      return {
        ...prev,
        minDelay,
        maxDelay: Math.max(prev.maxDelay, minDelay),
      };
    });
  }, []);

  const setMaxDelay = useCallback((value: number) => {
    setSettings((prev) => {
      const maxDelay = Math.max(0, value);
      return {
        ...prev,
        maxDelay: Math.max(maxDelay, prev.minDelay),
      };
    });
  }, []);

  const connectEmail = useCallback(async () => {
    setSettings((prev) => ({ ...prev, connectionStatus: "connecting" satisfies ConnectionStatus }));
    await new Promise((resolve) => setTimeout(resolve, 1200));
    setSettings((prev) => ({ ...prev, connectionStatus: "connected" }));
  }, []);

  const disconnectEmail = useCallback(() => {
    setSettings((prev) => ({ ...prev, connectionStatus: "not_connected" }));
  }, []);

  const value = useMemo(
    () => ({
      settings,
      setProvider,
      setEmailAddress,
      setMinDelay,
      setMaxDelay,
      connectEmail,
      disconnectEmail,
    }),
    [settings, setProvider, setEmailAddress, setMinDelay, setMaxDelay, connectEmail, disconnectEmail],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error("useSettings must be used within SettingsProvider");
  }
  return ctx;
}
