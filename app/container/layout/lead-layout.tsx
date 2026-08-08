"use client";

import React, { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { LeadsProvider } from "@/app/context/leads-context";
import { SettingsProvider } from "@/app/context/settings-context";
import LeadHeader from "./lead-header";
import LeadSidebar from "./lead-sidebar";

type LeadLayoutProps = {
  children?: React.ReactNode;
};

function LeadLayout({ children }: LeadLayoutProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const toggleSidebar = useCallback(() => setSidebarOpen((open) => !open), []);

  useEffect(() => {
    closeSidebar();
  }, [pathname, closeSidebar]);

  useEffect(() => {
    if (!sidebarOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeSidebar();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [sidebarOpen, closeSidebar]);

  return (
    <SettingsProvider>
      <LeadsProvider>
        <div className="flex h-screen overflow-hidden">
          <LeadSidebar open={sidebarOpen} onClose={closeSidebar} />

          <div className="flex min-w-0 flex-1 flex-col">
            <LeadHeader sidebarOpen={sidebarOpen} onMenuClick={toggleSidebar} />

            <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
          </div>
        </div>
      </LeadsProvider>
    </SettingsProvider>
  );
}

export default React.memo(LeadLayout);
