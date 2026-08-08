"use client";

import React from "react";
import Modal from "@/app/components/ui/modal";
import Button from "@/app/components/ui/button";
import Typography from "@/app/components/ui/typography";
import { TableStatus } from "@/app/components/common/table-text";
import { QueueItem } from "@/app/types/lead";

type EmailQueueModalProps = {
  open: boolean;
  items: QueueItem[];
  onClose: () => void;
};

const statusLabel: Record<QueueItem["status"], string> = {
  queued: "Queued",
  sending: "Sending",
  sent: "Sent",
  failed: "Failed",
};

function EmailQueueModal({ open, items, onClose }: EmailQueueModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Email Send Queue"
      description="Mock send simulation using your Settings delay range."
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
          <div className="hidden grid-cols-[1.4fr_1.4fr_0.8fr_0.7fr] gap-2 border-b border-border bg-sidebar px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted sm:grid">
            <span>Business Name</span>
            <span>Email</span>
            <span>Status</span>
            <span>Delay</span>
          </div>

          <div className="max-h-80 divide-y divide-border overflow-y-auto">
            {items.map((item) => (
              <div
                key={item.leadId}
                className="grid grid-cols-1 gap-2 px-3 py-3 sm:grid-cols-[1.4fr_1.4fr_0.8fr_0.7fr] sm:items-center"
              >
                <Typography variants="span" text={item.businessName} className="truncate text-sm! text-foreground" />
                <Typography variants="span" text={item.email} className="truncate text-sm! text-muted" />
                <div className="flex items-center justify-between gap-3 sm:contents">
                  <TableStatus text={statusLabel[item.status]} />
                  <Typography variants="span" text={`${item.delaySec} sec`} className="text-sm! font-mono text-muted" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}

export default React.memo(EmailQueueModal);
