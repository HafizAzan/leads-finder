"use client";

import React from "react";
import Modal from "@/app/components/ui/modal";
import Button from "@/app/components/ui/button";
import Typography from "@/app/components/ui/typography";
import { Lead } from "@/types/lead";
import { Loader2 } from "lucide-react";

type EmailReviewModalProps = {
  open: boolean;
  lead: Lead | null;
  busy?: boolean;
  onClose: () => void;
  onFix: (id: string) => void;
  onApprove: (id: string) => void;
};

function EmailReviewModal({ open, lead, busy = false, onClose, onFix, onApprove }: EmailReviewModalProps) {
  if (!lead) return null;

  const isWhatsApp = lead.outreach.channel === "whatsapp";
  const canApprove = lead.aiReview.status === "approved" && lead.outreach.approval === "pending";
  const canFix = lead.aiReview.status === "warning";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isWhatsApp ? "WhatsApp Review" : "Email Review"}
      description={lead.businessName}
      size="lg"
      footer={
        <>
          <Button onClick={onClose} className="border-border bg-transparent text-muted hover:bg-sidebar hover:text-foreground">
            Close
          </Button>
          {canFix && (
            <Button onClick={() => onFix(lead.id)} disabled={busy} className="bg-yellow-600 border-yellow-600 hover:opacity-100">
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Fix
            </Button>
          )}
          {canApprove && (
            <Button onClick={() => onApprove(lead.id)} disabled={busy} className="bg-purple-600 border-purple-600 hover:opacity-100">
              Approve
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Typography variants="span" text="Business Name" className="mb-1 block text-xs! text-muted" />
            <Typography variants="p" text={lead.businessName} className="text-sm! text-foreground" />
          </div>
          <div>
            <Typography
              variants="span"
              text={isWhatsApp ? "Phone" : "Email"}
              className="mb-1 block text-xs! text-muted"
            />
            <Typography
              variants="p"
              text={isWhatsApp ? lead.phone || "—" : lead.email || "—"}
              className="text-sm! text-foreground"
            />
          </div>
        </div>

        {!isWhatsApp && (
          <div>
            <Typography variants="span" text="Subject" className="mb-1 block text-xs! text-muted" />
            <div className="rounded-lg border border-border bg-sidebar px-3 py-2 text-sm text-foreground">
              {lead.outreach.subject || "—"}
            </div>
          </div>
        )}

        <div>
          <Typography
            variants="span"
            text={isWhatsApp ? "Message" : "Email Body"}
            className="mb-1 block text-xs! text-muted"
          />
          <div className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-sidebar px-3 py-2 text-sm leading-6 text-foreground">
            {lead.outreach.body || "—"}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-sidebar/50 px-3 py-3">
          {lead.aiReview.status === "approved" ? (
            <Typography variants="p" text="✓ AI Review Approved" className="text-sm! text-green-400" />
          ) : lead.aiReview.status === "warning" ? (
            <Typography variants="p" text="⚠ Needs Attention" className="text-sm! text-yellow-400" />
          ) : (
            <Typography variants="p" text="AI review pending" className="text-sm! text-muted" />
          )}

          {lead.aiReview.issues.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {lead.aiReview.issues.map((issue) => (
                <li key={issue} className="text-sm text-muted">
                  {issue}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default React.memo(EmailReviewModal);
