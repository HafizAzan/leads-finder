"use client";

import React, { useEffect, useMemo, useState } from "react";
import Modal from "@/app/components/ui/modal";
import Button from "@/app/components/ui/button";
import Typography from "@/app/components/ui/typography";
import { TableStatus } from "@/app/components/common/table-text";
import { apiGet } from "@/lib/api/client";
import { WhatsAppQueueItem } from "@/types/lead";

type WhatsAppQueueModalProps = {
  open: boolean;
  items: WhatsAppQueueItem[];
  message?: string | null;
  onClose: () => void;
  onItemsChange?: (items: WhatsAppQueueItem[]) => void;
};

const statusLabel: Record<WhatsAppQueueItem["status"], string> = {
  queued: "Queued",
  sending: "Sending",
  sent: "Sent",
  failed: "Failed",
  cancelled: "Skipped",
};

function remainingForItem(item: WhatsAppQueueItem, nowMs: number, openedAtMs: number) {
  if (item.status === "sent" || item.status === "failed" || item.status === "cancelled") {
    return 0;
  }

  if (item.scheduledAt) {
    const target = new Date(item.scheduledAt).getTime();
    if (!Number.isNaN(target)) {
      return Math.max(0, Math.ceil((target - nowMs) / 1000));
    }
  }

  const elapsed = Math.floor((nowMs - openedAtMs) / 1000);
  return Math.max(0, item.delaySeconds - elapsed);
}

function WhatsAppQueueModal({ open, items, message, onClose, onItemsChange }: WhatsAppQueueModalProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [openedAtMs, setOpenedAtMs] = useState(() => Date.now());

  useEffect(() => {
    if (!open) return;
    setOpenedAtMs(Date.now());
    setNowMs(Date.now());
    const tick = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, [open]);

  const rows = useMemo(
    () =>
      items.map((item) => {
        const remaining = remainingForItem(item, nowMs, openedAtMs);
        const displayStatus =
          item.status === "queued" && remaining === 0 ? "sending" : item.status;
        return { item, remaining, displayStatus };
      }),
    [items, nowMs, openedAtMs],
  );

  const hasActive = rows.some(
    (row) => row.item.status === "queued" || row.item.status === "sending" || row.remaining > 0,
  );

  useEffect(() => {
    if (!open || !hasActive || !onItemsChange) return;

    const poll = window.setInterval(() => {
      void apiGet<WhatsAppQueueItem[]>("/api/whatsapp/queue")
        .then((latest) => {
          const byId = new Map(latest.map((entry) => [entry.id, entry]));
          onItemsChange(items.map((item) => byId.get(item.id) || item));
        })
        .catch(() => undefined);
    }, 2000);

    return () => window.clearInterval(poll);
  }, [open, hasActive, items, onItemsChange]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="WhatsApp Send Queue"
      description={message || "Queued WhatsApp messages with configured delays."}
      size="xl"
      footer={
        <Button onClick={onClose} className="border-border bg-transparent text-muted hover:bg-sidebar hover:text-foreground">
          Close
        </Button>
      }
    >
      {items.length === 0 ? (
        <Typography variants="p" text="Queue is empty." className="text-sm!" />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="hidden grid-cols-[1.4fr_1.2fr_0.8fr_0.7fr] gap-2 border-b border-border bg-sidebar px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted sm:grid">
            <span>Business Name</span>
            <span>Phone</span>
            <span>Status</span>
            <span>Delay</span>
          </div>
          <div className="max-h-80 divide-y divide-border overflow-y-auto">
            {rows.map(({ item, remaining, displayStatus }) => (
              <div
                key={item.id}
                className="grid grid-cols-1 gap-2 px-3 py-3 sm:grid-cols-[1.4fr_1.2fr_0.8fr_0.7fr] sm:items-center"
              >
                <Typography
                  variants="span"
                  text={item.businessName || item.leadId}
                  className="truncate text-sm! text-foreground"
                />
                <Typography variants="span" text={item.phone} className="truncate font-mono text-sm! text-muted" />
                <div className="flex items-center justify-between gap-3 sm:contents">
                  <TableStatus text={statusLabel[displayStatus]} />
                  <Typography
                    variants="span"
                    text={
                      item.status === "sent" || item.status === "failed" || item.status === "cancelled"
                        ? "—"
                        : remaining > 0
                          ? `${remaining}s`
                          : "Sending…"
                    }
                    className={`text-sm! font-mono ${remaining > 0 ? "text-purple-300" : "text-muted"}`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}

export default React.memo(WhatsAppQueueModal);
