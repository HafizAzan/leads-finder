"use client";

import React from "react";
import { Search as SearchIcon, X } from "lucide-react";

type SearchProps = {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
};

function Search({
  value = "",
  onChange,
  placeholder = "Search leads...",
}: SearchProps) {
  return (
    <div className="relative w-full max-w-none lg:max-w-sm">
      <SearchIcon
        size={17}
        strokeWidth={1.8}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
      />

      <input
        type="text"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-9
          text-sm text-foreground outline-none placeholder:text-muted transition-colors focus:border-slate-500 focus:ring-2 focus:ring-slate-500/10 hover:border-slate-600"
      />

      {value && (
        <button
          type="button"
          onClick={() => onChange?.("")}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted transition-colors
            hover:bg-sidebar hover:text-foreground"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

export default React.memo(Search);
