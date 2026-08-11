"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export type SelectOption = {
  label: string;
  value: string;
  disabled?: boolean;
};

type SelectProps = {
  id?: string;
  name?: string;
  label?: string;
  hint?: string;
  error?: string;
  className?: string;
  optional?: boolean;
  options: SelectOption[];
  placeholder?: string;
  value?: string;
  disabled?: boolean;
  onChange?: (event: { target: { name?: string; value: string } }) => void;
  onValueChange?: (value: string) => void;
};

function Select({
  id,
  name,
  label,
  hint,
  error,
  className = "",
  optional = false,
  options,
  placeholder = "Select an option",
  value = "",
  disabled = false,
  onChange,
  onValueChange,
}: SelectProps) {
  const reactId = useId();
  const selectId = id || name || reactId;
  const listboxId = `${selectId}-listbox`;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const selectedOption = useMemo(() => options.find((option) => option.value === value), [options, value]);
  const enabledOptions = useMemo(() => options.filter((option) => !option.disabled), [options]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const openMenu = () => {
    const index = enabledOptions.findIndex((option) => option.value === value);
    setActiveIndex(index >= 0 ? index : 0);
    setOpen(true);
  };

  const commitValue = (nextValue: string) => {
    onChange?.({ target: { name, value: nextValue } });
    onValueChange?.(nextValue);
    setOpen(false);
  };

  return (
    <div className="w-full space-y-1.5" ref={rootRef}>
      {label && (
        <label htmlFor={selectId} className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          {label}
          {optional && <span className="text-xs font-normal text-muted">(optional)</span>}
        </label>
      )}

      <div className="relative">
        <button
          id={selectId}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          onClick={() => {
            if (disabled) return;
            if (open) setOpen(false);
            else openMenu();
          }}
          className={`flex h-10 w-full items-center justify-between gap-2 rounded-lg border bg-sidebar px-3 text-left text-sm outline-none transition-all duration-150 hover:border-slate-600 focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/15 disabled:cursor-not-allowed disabled:opacity-50 ${
            open ? "border-purple-500/40 ring-2 ring-purple-500/15" : error ? "border-red-500/60" : "border-border"
          } ${className}`}
        >
          <span className={selectedOption ? "truncate text-foreground" : "truncate text-muted"}>
            {selectedOption?.label || placeholder}
          </span>
          <ChevronDown className={`size-4 shrink-0 text-muted transition-transform duration-150 ${open ? "rotate-180 text-purple-300" : ""}`} />
        </button>

        {open && (
          <div
            id={listboxId}
            role="listbox"
            className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-lg border border-border bg-card shadow-xl shadow-black/40"
          >
            <div className="max-h-56 overflow-y-auto p-1">
              {options.map((option) => {
                const selected = option.value === value;
                const active = enabledOptions[activeIndex]?.value === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    disabled={option.disabled}
                    onMouseEnter={() => {
                      if (!option.disabled) {
                        setActiveIndex(enabledOptions.findIndex((item) => item.value === option.value));
                      }
                    }}
                    onClick={() => {
                      if (!option.disabled) commitValue(option.value);
                    }}
                    className={`flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                      selected
                        ? "bg-purple-500/15 text-foreground"
                        : active
                          ? "bg-sidebar text-foreground"
                          : "text-muted hover:bg-sidebar hover:text-foreground"
                    }`}
                  >
                    <span className="truncate">{option.label}</span>
                    {selected && <Check className="size-3.5 shrink-0 text-purple-300" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {error ? <p className="text-xs text-red-400">{error}</p> : hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export default React.memo(Select);
