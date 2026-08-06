import React from "react";
import { Check } from "lucide-react";

type CheckboxProps = {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  indeterminate?: boolean;
  disabled?: boolean;
  className?: string;
};

function Checkbox({ checked = false, onChange, indeterminate = false, disabled = false, className = "" }: CheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      aria-label="Select"
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border transition-all duration-150
        ${checked || indeterminate ? "border-primary bg-primary text-white" : "border-border bg-transparent text-transparent hover:border-primary/60"}
        ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}
        ${className}
      `}
    >
      {indeterminate ? <span className="h-0.5 w-2 rounded-full bg-white" /> : checked ? <Check size={11} strokeWidth={3} /> : null}
    </button>
  );
}

export default React.memo(Checkbox);
