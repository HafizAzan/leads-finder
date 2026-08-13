import React from "react";
import { Inbox, SearchX } from "lucide-react";
import Typography from "@/app/components/ui/typography";
import Button from "@/app/components/ui/button";

type EmptyPlaceholderProps = {
  variant?: "empty" | "search";
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
};

function EmptyPlaceholder({
  variant = "empty",
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
}: EmptyPlaceholderProps) {
  const isSearch = variant === "search";
  const Icon = isSearch ? SearchX : Inbox;

  const resolvedTitle = title ?? (isSearch ? "No results found" : "No leads yet");
  const resolvedDescription =
    description ??
    (isSearch
      ? "We couldn’t find any leads matching your search. Try a different keyword."
      : "Your leads list is empty. Generate new leads or upload a CSV to get started.");

  return (
    <div className="flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center sm:py-16">
      <div className="mb-4 flex size-14 items-center justify-center rounded-xl border border-purple-500/25 bg-purple-500/10">
        <Icon className="size-6 text-purple-400" strokeWidth={1.75} />
      </div>

      <Typography variants="h4" text={resolvedTitle} className="mb-2 text-foreground" />
      <Typography variants="p" text={resolvedDescription} className="mb-6 max-w-md text-sm!" />

      {(actionLabel && onAction) || (secondaryActionLabel && onSecondaryAction) ? (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {actionLabel && onAction && (
            <Button
              type="button"
              onClick={onAction}
              className="bg-purple-600 border-purple-600 hover:bg-purple-500 hover:border-purple-500 hover:opacity-100"
            >
              {actionLabel}
            </Button>
          )}
          {secondaryActionLabel && onSecondaryAction && (
            <Button type="button" onClick={onSecondaryAction}>
              {secondaryActionLabel}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default React.memo(EmptyPlaceholder);
