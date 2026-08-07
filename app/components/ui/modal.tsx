"use client";

import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  closeOnOverlayClick?: boolean;
};

function Modal({ open, onClose, title, description, children, footer, size = "md", closeOnOverlayClick = true }: ModalProps) {
  useEffect(() => {
    if (!open) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  const sizeClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
  };

  return createPortal(
    <div className="fixed inset-0 z-999 flex items-end justify-center px-3 py-3 sm:items-center sm:px-4" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        onClick={() => {
          if (closeOnOverlayClick) {
            onClose();
          }
        }}
      />

      <div
        className={`
          relative z-10 w-full ${sizeClasses[size]}
          max-h-[90vh] overflow-y-auto
          rounded-xl
          border border-border
          bg-card
          shadow-2xl
        `}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-4 sm:gap-4 sm:px-5">
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold text-foreground">{title}</h2>}
            {description && <p className="mt-1 text-sm leading-5 text-muted">{description}</p>}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="
              flex h-8 w-8 shrink-0 items-center justify-center
              rounded-md
              text-muted
              transition-colors
              hover:bg-sidebar
              hover:text-foreground
            "
            aria-label="Close modal"
          >
            <X size={17} />
          </button>
        </div>

        {children && <div className="px-4 py-4 sm:px-5 sm:py-5">{children}</div>}
        {footer && (
          <div className="flex flex-col-reverse items-stretch gap-2 border-t border-border bg-sidebar/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-end sm:px-5">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

export default React.memo(Modal);
