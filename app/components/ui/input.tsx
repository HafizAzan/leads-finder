import React from "react";

type InputProps = {
  id?: string;
  label?: string;
  hint?: string;
  error?: string;
  className?: string;
  optional?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement>;

function Input({ id, label, hint, error, className = "", optional = false, ...props }: InputProps) {
  const inputId = id || props.name;

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          {label}
          {optional && <span className="text-xs font-normal text-muted">(optional)</span>}
        </label>
      )}

      <input
        id={inputId}
        className={`h-10 w-full rounded-lg border bg-sidebar px-3 text-sm text-foreground outline-none placeholder:text-muted transition-colors hover:border-slate-600 focus:border-slate-500 focus:ring-2 focus:ring-slate-500/10 disabled:cursor-not-allowed disabled:opacity-50 ${
          error ? "border-red-500/60" : "border-border"
        } ${className}`}
        {...props}
      />

      {error ? <p className="text-xs text-red-400">{error}</p> : hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export default React.memo(Input);
