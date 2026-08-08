"use client";

import React from "react";
import { usePathname } from "next/navigation";
import Typography from "@/app/components/ui/typography";
import Status from "@/app/components/common/status";
import { Menu, X } from "lucide-react";

type LeadHeaderProps = {
  sidebarOpen?: boolean;
  onMenuClick?: () => void;
};

const pageTitles: Record<string, string> = {
  "/leads": "My Leads",
  "/leads/generate-leads": "Generate Leads",
};

function LeadHeader({ sidebarOpen = false, onMenuClick }: LeadHeaderProps) {
  const pathname = usePathname();
  const title = pageTitles[pathname] ?? "AI Lead Finder";

  return (
    <header className="border-b border-border bg-header px-3 py-3 shadow-md sm:px-5 sm:py-4 lg:px-6 lg:py-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onMenuClick}
            className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-foreground transition-colors hover:bg-sidebar lg:hidden"
            aria-label={sidebarOpen ? "Close menu" : "Open menu"}
            aria-expanded={sidebarOpen}
          >
            {sidebarOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>

          <Typography className="truncate text-xl! sm:text-2xl! md:text-3xl!" text={title} variants="h2" />
        </div>

        <Status type="success" />
      </div>
    </header>
  );
}

export default React.memo(LeadHeader);
