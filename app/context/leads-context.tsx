"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { createLeadFromForm, initialMockLeads } from "@/app/data/mock-leads";
import { Lead } from "@/app/types/lead";

type LeadsContextValue = {
  leads: Lead[];
  setLeads: React.Dispatch<React.SetStateAction<Lead[]>>;
  addGeneratedLeads: (input: {
    category: string;
    city: string;
    country: string;
    leadLimit: number;
    description?: string;
  }) => void;
};

const LeadsContext = createContext<LeadsContextValue | null>(null);

export function LeadsProvider({ children }: { children: React.ReactNode }) {
  const [leads, setLeads] = useState<Lead[]>(initialMockLeads);

  const addGeneratedLeads = useCallback(
    (input: { category: string; city: string; country: string; leadLimit: number; description?: string }) => {
      const count = Math.max(1, Math.min(500, input.leadLimit));
      const created = Array.from({ length: count }, (_, index) =>
        createLeadFromForm({
          category: input.category,
          city: input.city,
          country: input.country,
          description: input.description,
          index,
        }),
      );
      setLeads((prev) => [...created, ...prev]);
    },
    [],
  );

  const value = useMemo(
    () => ({
      leads,
      setLeads,
      addGeneratedLeads,
    }),
    [leads, addGeneratedLeads],
  );

  return <LeadsContext.Provider value={value}>{children}</LeadsContext.Provider>;
}

export function useLeads() {
  const ctx = useContext(LeadsContext);
  if (!ctx) {
    throw new Error("useLeads must be used within LeadsProvider");
  }
  return ctx;
}
