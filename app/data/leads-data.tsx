import React from "react";
import Button from "../components/ui/button";
import { Check, Eye, Loader2, Trash2, Wrench } from "lucide-react";
import { TableParagraph, TableStatus, TableText } from "../components/common/table-text";
import { Lead } from "@/types/lead";

export interface TableButtons {
  label: string;
  shortLabel?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  hidden?: boolean;
}

export type Column<T> = {
  key: keyof T | "checkbox" | "actions" | string;
  label?: string;
  isCheckbox?: boolean;
  isActions?: boolean;
  cell?: (row: T) => React.ReactNode;
};

export type RowId = string | number;

export type TableProps<T> = {
  columns: Column<T>[];
  data: T[];
  selectedRows?: RowId[];
  setSelectedRows?: React.Dispatch<React.SetStateAction<RowId[]>>;
};

export type LeadColumnActions = {
  onReview: (id: string) => void;
  onFix: (id: string) => void;
  onApprove: (id: string) => void;
  onDelete: (id: string) => void;
  busyLeadIds: Set<string>;
};

const sendStatusLabel: Record<Lead["outreach"]["sendStatus"], string> = {
  not_sent: "Not Sent",
  queued: "Queued",
  sending: "Sending",
  sent: "Sent",
  failed: "Failed",
  skipped: "Skipped",
};

const aiReviewLabel: Record<Lead["aiReview"]["status"], string> = {
  pending: "Pending",
  approved: "✓ Approved",
  warning: "⚠ Warning",
};

const approvalLabel: Record<Lead["outreach"]["approval"], string> = {
  pending: "Pending",
  approved: "Approved",
};

const channelLabel: Record<Lead["contactChannel"], string> = {
  email: "Email",
  phone: "Phone",
  none: "None",
};

export function generateLeadsColumns(actions: LeadColumnActions): Column<Lead>[] {
  return [
    { key: "checkbox", isCheckbox: true },
    {
      key: "businessName",
      label: "Business Name",
      cell: (row) => <TableText text={row.businessName} />,
    },
    {
      key: "category",
      label: "Category",
      cell: (row) => <TableParagraph text={row.category} className="text-foreground/80!" />,
    },
    {
      key: "city",
      label: "City",
      cell: (row) => <TableParagraph text={row.city} className="font-mono tracking-tighter text-foreground/80!" />,
    },
    {
      key: "email",
      label: "Email",
      cell: (row) => <TableParagraph text={row.email || "—"} />,
    },
    {
      key: "phone",
      label: "Phone",
      cell: (row) => <TableParagraph text={row.phone || "—"} className="font-mono" />,
    },
    {
      key: "channel",
      label: "Channel",
      cell: (row) => <TableStatus text={channelLabel[row.contactChannel]} />,
    },
    {
      key: "aiReview",
      label: "AI Review",
      cell: (row) => <TableStatus text={aiReviewLabel[row.aiReview.status]} />,
    },
    {
      key: "approval",
      label: "Approval",
      cell: (row) => <TableStatus text={approvalLabel[row.outreach.approval]} />,
    },
    {
      key: "sendStatus",
      label: "Send Status",
      cell: (row) => <TableStatus text={sendStatusLabel[row.outreach.sendStatus]} />,
    },
    {
      key: "actions",
      label: "Actions",
      isActions: true,
      cell: (row) => {
        const busy = actions.busyLeadIds.has(row.id);
        const hasEmail = Boolean(row.outreach.subject && row.outreach.body);
        const showFix = row.aiReview.status === "warning";
        const showApprove =
          row.aiReview.status === "approved" &&
          row.outreach.approval === "pending" &&
          hasEmail;

        return (
          <div className="flex items-center gap-2">
            {hasEmail && (
              <Button
                className="py-1.5! px-2! rounded-sm bg-slate-700 border-transparent"
                onClick={() => actions.onReview(row.id)}
                disabled={busy}
                title="Review"
              >
                <Eye className="size-3.5" />
              </Button>
            )}
            {showFix && (
              <Button
                className="py-1.5! px-2! rounded-sm bg-yellow-600 border-transparent"
                onClick={() => actions.onFix(row.id)}
                disabled={busy}
                title="Fix"
              >
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Wrench className="size-3.5" />}
              </Button>
            )}
            {showApprove && (
              <Button
                className="py-1.5! px-2! rounded-sm bg-purple-600 border-transparent"
                onClick={() => actions.onApprove(row.id)}
                disabled={busy}
                title="Approve"
              >
                <Check className="size-3.5" />
              </Button>
            )}
            <Button
              className="py-1.5! px-1.5! rounded-sm bg-red-700 border-transparent"
              onClick={() => actions.onDelete(row.id)}
              disabled={busy}
              title="Delete"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        );
      },
    },
  ];
}
