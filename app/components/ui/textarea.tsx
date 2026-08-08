import React from "react";

type TextareaProps = {
  id?: string;
  label?: string;
  hint?: string;
  error?: string;
  className?: string;
  optional?: boolean;
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>;

function Textarea({ id, label, hint, error, className = "", optional = false, ...props }: TextareaProps) {
  const textareaId = id || props.name;

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label htmlFor={textareaId} className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          {label}
          {optional && <span className="text-xs font-normal text-muted">(optional)</span>}
        </label>
      )}

      <textarea
        id={textareaId}
        className={`min-h-28 w-full resize-y rounded-lg border bg-sidebar px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted transition-colors hover:border-slate-600 focus:border-slate-500 focus:ring-2 focus:ring-slate-500/10 disabled:cursor-not-allowed disabled:opacity-50 ${
          error ? "border-red-500/60" : "border-border"
        } ${className}`}
        {...props}
      />

      {error ? <p className="text-xs text-red-400">{error}</p> : hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export default React.memo(Textarea);
