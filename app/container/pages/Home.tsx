"use client";

import CsvUploadModal, {
  CsvImportResult,
} from "@/app/components/common/csv-upload-modal";
import EmptyPlaceholder from "@/app/components/common/empty-placeholder";
import EmailQueueModal from "@/app/components/common/email-queue-modal";
import EmailReviewModal from "@/app/components/common/email-review-modal";
import WhatsAppQueueModal from "@/app/components/common/whatsapp-queue-modal";
import Search from "@/app/components/common/search";
import Button from "@/app/components/ui/button";
import Modal from "@/app/components/ui/modal";
import Pagination from "@/app/components/ui/pagination";
import Table from "@/app/components/ui/table";
import Typography from "@/app/components/ui/typography";
import {
  generateLeadsColumns,
  RowId,
  TableButtons,
} from "@/app/data/leads-data";
import { ApiClientError, apiGet, apiSend } from "@/lib/api/client";
import { EmailQueueItem, Lead, WhatsAppQueueItem } from "@/types/lead";
import {
  CheckCheck,
  Download,
  Loader2,
  MailPlus,
  MessageCircle,
  Send,
  Trash2,
  Upload,
  UsersRound,
  Wrench,
} from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { downloadLeadsCsv } from "@/lib/csv/export";

function searchLeadMatches(lead: Lead, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [
    lead.businessName,
    lead.category,
    lead.city,
    lead.country,
    lead.email,
    lead.phone,
    lead.contactChannel,
    lead.aiReview.status,
    lead.outreach.approval,
    lead.outreach.sendStatus,
    lead.outreach.subject,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(q);
}

function Home() {
  const router = useRouter();
  const rowsPerPage = 20;

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchValue, setSearchValue] = useState("");
  const [page, setPage] = useState(1);
  const [selectedRows, setSelectedRows] = useState<RowId[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteIds, setDeleteIds] = useState<string[]>([]);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [reviewLeadId, setReviewLeadId] = useState<string | null>(null);
  const [queueOpen, setQueueOpen] = useState(false);
  const [queueItems, setQueueItems] = useState<EmailQueueItem[]>([]);
  const [queueMessage, setQueueMessage] = useState<string | null>(null);
  const [whatsappQueueOpen, setWhatsappQueueOpen] = useState(false);
  const [whatsappQueueItems, setWhatsappQueueItems] = useState<WhatsAppQueueItem[]>([]);
  const [whatsappQueueMessage, setWhatsappQueueMessage] = useState<string | null>(null);
  const [busyLeadIds, setBusyLeadIds] = useState<Set<string>>(new Set());
  const [progressMessage, setProgressMessage] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const warning = sessionStorage.getItem("leads-generate-warning");
    if (warning) sessionStorage.removeItem("leads-generate-warning");
    return warning;
  });
  const [globalBusy, setGlobalBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [csvUploadOpen, setCsvUploadOpen] = useState(false);

  const loadLeads = useCallback(async () => {
    try {
      const data = await apiGet<Lead[]>("/api/leads");
      setLeads(data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Failed to load leads.",
      );
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchInitialLeads() {
      try {
        const data = await apiGet<Lead[]>("/api/leads");
        if (cancelled) return;
        setLeads(data);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof ApiClientError ? err.message : "Failed to load leads.",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchInitialLeads();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Sent leads stay deletable via row trash, but not selectable for bulk send/actions.
    setSelectedRows((prev) =>
      prev.filter((id) => {
        const lead = leads.find((item) => item.id === id);
        if (!lead) return false;
        return !["sent", "delivered", "read"].includes(lead.outreach.sendStatus);
      }),
    );
  }, [leads]);

  useEffect(() => {
    if (!progressMessage) return;
    if (
      !progressMessage.includes("Google Places failed") &&
      !progressMessage.includes("from CSV")
    ) {
      return;
    }
    const timer = window.setTimeout(() => setProgressMessage(null), 5000);
    return () => window.clearTimeout(timer);
  }, [progressMessage]);

  const selectedLeads = useMemo(
    () => leads.filter((lead) => selectedRows.includes(lead.id)),
    [leads, selectedRows],
  );
  const filteredData = useMemo(
    () => leads.filter((lead) => searchLeadMatches(lead, searchValue)),
    [leads, searchValue],
  );
  const totalPage = Math.max(1, Math.ceil(filteredData.length / rowsPerPage));
  const currentData = filteredData.slice(
    (page - 1) * rowsPerPage,
    page * rowsPerPage,
  );

  const hasSourceData = leads.length > 0;
  const hasFilteredData = filteredData.length > 0;
  const isSearchEmpty =
    hasSourceData && !hasFilteredData && searchValue.trim().length > 0;
  const isListEmpty = !hasSourceData;

  const selectedWarnings = selectedLeads.filter(
    (lead) => lead.aiReview.status === "warning",
  );
  const selectedApprovable = selectedLeads.filter(
    (lead) =>
      lead.aiReview.status === "approved" &&
      lead.outreach.approval === "pending" &&
      Boolean(lead.outreach.body) &&
      (lead.outreach.channel === "whatsapp" || Boolean(lead.outreach.subject)),
  );
  const selectedSendable = selectedLeads.filter(
    (lead) =>
      lead.outreach.channel === "email" &&
      lead.aiReview.status === "approved" &&
      lead.outreach.approval === "approved" &&
      Boolean(lead.email?.trim()) &&
      Boolean(lead.outreach.subject) &&
      Boolean(lead.outreach.body),
  );
  const selectedWhatsAppSendable = selectedLeads.filter(
    (lead) =>
      lead.outreach.channel === "whatsapp" &&
      lead.aiReview.status === "approved" &&
      lead.outreach.approval === "approved" &&
      Boolean(lead.phone?.trim()) &&
      Boolean(lead.outreach.body),
  );
  const selectedPhoneOutreach = selectedLeads.filter(
    (lead) => Boolean(lead.phone?.trim()) && !lead.email?.trim(),
  );
  const generateActionLabel =
    selectedPhoneOutreach.length === selectedLeads.length && selectedLeads.length > 0
      ? "Generate WhatsApp"
      : selectedPhoneOutreach.length > 0
        ? "Generate Outreach"
        : "Generate Emails";

  const markBusy = (ids: string[], busy: boolean) => {
    setBusyLeadIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => {
        if (busy) next.add(id);
        else next.delete(id);
      });
      return next;
    });
  };

  const upsertLead = (lead: Lead) => {
    setLeads((prev) => {
      const exists = prev.some((item) => item.id === lead.id);
      if (!exists) return [lead, ...prev];
      return prev.map((item) => (item.id === lead.id ? lead : item));
    });
  };

  const generateEmails = async () => {
    if (!selectedLeads.length || globalBusy) return;
    const phoneOnlyCount = selectedPhoneOutreach.length;
    setGlobalBusy(true);
    setProgressMessage(
      phoneOnlyCount === selectedLeads.length
        ? `Generating WhatsApp messages for ${selectedLeads.length} lead(s)...`
        : phoneOnlyCount > 0
          ? `Generating outreach for ${selectedLeads.length} lead(s) (email + WhatsApp)...`
          : `Generating emails for ${selectedLeads.length} lead(s)...`,
    );
    markBusy(
      selectedLeads.map((lead) => lead.id),
      true,
    );
    setError(null);

    try {
      const result = await apiSend<{
        results: Array<{ leadId: string; success: boolean; error?: string }>;
      }>("/api/ai/generate-emails", "POST", {
        leadIds: selectedLeads.map((lead) => lead.id),
      });
      await loadLeads();
      const failed = result.results.filter((item) => !item.success);
      const okCount = result.results.length - failed.length;
      if (failed.length > 0) {
        setProgressMessage(
          `Generated ${okCount}/${result.results.length}. ${failed.length} failed.`,
        );
        setError(failed[0]?.error || "Some outreach generations failed.");
      } else {
        setProgressMessage(
          phoneOnlyCount === selectedLeads.length
            ? `WhatsApp ready (${okCount}). Next: Approve All → Send WhatsApp.`
            : `Outreach generation complete (${okCount}).`,
        );
      }
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Failed to generate outreach.",
      );
    } finally {
      markBusy(
        selectedLeads.map((lead) => lead.id),
        false,
      );
      setGlobalBusy(false);
      setTimeout(() => setProgressMessage(null), 6000);
    }
  };

  const fixLeadById = async (id: string) => {
    markBusy([id], true);
    setProgressMessage("Fixing email...");
    setError(null);
    try {
      const lead = await apiSend<Lead>("/api/ai/fix-email", "POST", {
        leadId: id,
      });
      upsertLead(lead);
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Failed to fix email.",
      );
    } finally {
      markBusy([id], false);
      setProgressMessage(null);
    }
  };

  const fixAllWarnings = async () => {
    if (!selectedWarnings.length || globalBusy) return;
    setGlobalBusy(true);
    setProgressMessage(`Fixing ${selectedWarnings.length} warning email(s)...`);
    setError(null);
    try {
      await apiSend("/api/ai/fix-emails", "POST", {
        leadIds: selectedWarnings.map((lead) => lead.id),
      });
      await loadLeads();
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Failed to fix emails.",
      );
    } finally {
      setGlobalBusy(false);
      setProgressMessage(null);
    }
  };

  const approveLeadById = async (id: string) => {
    setError(null);
    try {
      const lead = await apiSend<Lead>(`/api/leads/${id}/approve`, "POST");
      upsertLead(lead);
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Failed to approve lead.",
      );
    }
  };

  const approveAllSelected = async () => {
    if (!selectedApprovable.length) return;
    setError(null);
    try {
      await apiSend("/api/leads/bulk-approve", "POST", {
        ids: selectedApprovable.map((lead) => lead.id),
      });
      await loadLeads();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Failed to approve leads.",
      );
    }
  };

  const queueApprovedEmails = async () => {
    if (!selectedSendable.length || globalBusy) return;
    setGlobalBusy(true);
    setProgressMessage("Queueing approved emails...");
    setError(null);
    try {
      const result = await apiSend<{
        message: string;
        items: EmailQueueItem[];
      }>("/api/email/queue", "POST", {
        leadIds: selectedSendable.map((lead) => lead.id),
      });
      setQueueItems(result.items);
      setQueueMessage(result.message);
      setQueueOpen(true);
      await loadLeads();
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Failed to queue emails.",
      );
    } finally {
      setGlobalBusy(false);
      setProgressMessage(null);
    }
  };

  const queueApprovedWhatsApp = async () => {
    if (!selectedWhatsAppSendable.length || globalBusy) return;
    setGlobalBusy(true);
    setProgressMessage("Queueing approved WhatsApp messages...");
    setError(null);
    try {
      const result = await apiSend<{
        message: string;
        items: WhatsAppQueueItem[];
      }>("/api/whatsapp/queue", "POST", {
        leadIds: selectedWhatsAppSendable.map((lead) => lead.id),
      });
      setWhatsappQueueItems(result.items);
      setWhatsappQueueMessage(result.message);
      setWhatsappQueueOpen(true);
      await loadLeads();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Failed to queue WhatsApp messages.",
      );
    } finally {
      setGlobalBusy(false);
      setProgressMessage(null);
    }
  };

  const onDeleteConfirm = async () => {
    if (deleteBusy || deleteIds.length === 0) return;
    setDeleteBusy(true);
    setError(null);
    try {
      await apiSend("/api/leads/bulk-delete", "POST", { ids: deleteIds });
      setLeads((prev) => prev.filter((lead) => !deleteIds.includes(lead.id)));
      setSelectedRows((prev) =>
        prev.filter((id) => !deleteIds.includes(String(id))),
      );
      if (reviewLeadId && deleteIds.includes(reviewLeadId))
        setReviewLeadId(null);
      setDeleteOpen(false);
      setDeleteIds([]);
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Failed to delete leads.",
      );
    } finally {
      setDeleteBusy(false);
    }
  };

  const columns = generateLeadsColumns({
    onView: (id) => router.push(`/leads/${id}`),
    onReview: (id) => setReviewLeadId(id),
    onFix: (id) => void fixLeadById(id),
    onApprove: (id) => void approveLeadById(id),
    onDelete: (id) => {
      setDeleteIds([id]);
      setDeleteOpen(true);
    },
    busyLeadIds,
  });

  const reviewLead = leads.find((lead) => lead.id === reviewLeadId) || null;

  const tableButtons: TableButtons[] =
    selectedRows.length > 0
      ? [
          {
            label: `${selectedRows.length} Leads Selected`,
            shortLabel: `${selectedRows.length}`,
          },
          {
            label: "Download CSV",
            shortLabel: "CSV",
            icon: <Download className="size-3.5" />,
            onClick: () => {
              downloadLeadsCsv(
                selectedLeads,
                `leads-${new Date().toISOString().slice(0, 10)}.csv`,
              );
            },
          },
          {
            label: generateActionLabel,
            shortLabel: "Generate",
            icon: globalBusy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : selectedPhoneOutreach.length === selectedLeads.length ? (
              <MessageCircle className="size-3.5" />
            ) : (
              <MailPlus className="size-3.5" />
            ),
            onClick: () => void generateEmails(),
          },
          {
            label: "Approve All",
            shortLabel: "Approve",
            icon: <CheckCheck className="size-3.5" />,
            onClick: () => void approveAllSelected(),
            hidden: selectedApprovable.length === 0,
          },
          {
            label: "Fix All",
            shortLabel: "Fix",
            icon: <Wrench className="size-3.5" />,
            onClick: () => void fixAllWarnings(),
            hidden: selectedWarnings.length === 0,
          },
          {
            label: "Send Approved Emails",
            shortLabel: "Send",
            icon: <Send className="size-3.5" />,
            onClick: () => void queueApprovedEmails(),
            hidden: selectedSendable.length === 0,
          },
          {
            label: "Send WhatsApp",
            shortLabel: "WhatsApp",
            icon: <MessageCircle className="size-3.5" />,
            onClick: () => void queueApprovedWhatsApp(),
            hidden: selectedWhatsAppSendable.length === 0,
          },
          {
            label: "Bulk Delete",
            shortLabel: "Delete",
            icon: <Trash2 className="size-3.5" />,
            onClick: () => {
              setDeleteIds(selectedRows.map(String));
              setDeleteOpen(true);
            },
          },
        ]
      : [
          {
            label: "Generate New Leads",
            shortLabel: "Generate",
            icon: <UsersRound className="size-3.5" />,
            onClick: () => router.push("/leads/generate-leads"),
          },
          {
            label: "Upload CSV",
            shortLabel: "CSV",
            icon: <Upload className="size-3.5" />,
            onClick: () => setCsvUploadOpen(true),
          },
        ];

  const onCsvImported = (result: CsvImportResult) => {
    if (result.leads.length > 0) {
      setLeads((prev) => {
        const existingIds = new Set(prev.map((lead) => lead.id));
        const fresh = result.leads.filter((lead) => !existingIds.has(lead.id));
        return [...fresh, ...prev];
      });
    }
    setProgressMessage(
      `Imported ${result.imported} lead${result.imported === 1 ? "" : "s"} from CSV${result.skipped ? ` (${result.skipped} skipped)` : ""}.`,
    );
    setError(null);
    setSelectedRows([]);
    setPage(1);
  };

  const visibleButtons = tableButtons.filter((button) => !button.hidden);

  if (loading) {
    return (
      <section className="flex min-h-[50vh] items-center justify-center px-4">
        <Loader2 className="size-6 animate-spin text-purple-300" />
      </section>
    );
  }

  return (
    <section className="px-3 py-3 sm:px-4 sm:py-4">
      <div className="flex flex-col gap-3 pb-4 sm:gap-4 lg:flex-row lg:items-end lg:justify-between">
        <Search
          onChange={(val: string) => {
            setSearchValue(val);
            setPage(1);
            setSelectedRows([]);
          }}
          value={searchValue}
        />

        <div className="flex w-full flex-wrap items-center gap-1 rounded-lg bg-card p-1.5 sm:w-auto sm:gap-2 sm:p-2">
          {visibleButtons.map((single, index) => (
            <div
              className="flex min-w-0 items-center gap-1 sm:gap-2"
              key={`${single.label}-${index}`}
            >
              {index !== 0 && (
                <div className="hidden h-5 w-px bg-border sm:block" />
              )}
              <Button
                onClick={single.onClick}
                disabled={globalBusy && !single.label.includes("Selected")}
                className="border-transparent px-2! py-1.5! text-xs! gap-x-1 sm:px-3! sm:text-sm!"
              >
                {single.icon && <span className="shrink-0">{single.icon}</span>}
                <span className="sm:hidden">
                  {single.shortLabel ?? single.label}
                </span>
                <span className="hidden sm:inline">{single.label}</span>
              </Button>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {progressMessage && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-purple-500/20 bg-purple-500/10 px-3 py-2">
          <Loader2 className="size-4 animate-spin text-purple-300" />
          <Typography
            variants="span"
            text={progressMessage}
            className="text-sm! text-purple-200"
          />
        </div>
      )}

      {isListEmpty ? (
        <EmptyPlaceholder
          variant="empty"
          actionLabel="Generate New Leads"
          onAction={() => router.push("/leads/generate-leads")}
          secondaryActionLabel="Upload CSV"
          onSecondaryAction={() => setCsvUploadOpen(true)}
        />
      ) : isSearchEmpty ? (
        <EmptyPlaceholder
          variant="search"
          actionLabel="Clear search"
          onAction={() => {
            setSearchValue("");
            setPage(1);
          }}
        />
      ) : (
        <>
          <Table
            columns={columns}
            data={currentData}
            selectedRows={selectedRows}
            setSelectedRows={setSelectedRows}
            isRowSelectable={(lead) => !["sent", "delivered", "read"].includes(lead.outreach.sendStatus)}
          />
          <Pagination
            currentPage={page}
            totalPages={totalPage}
            onPageChange={(next) => {
              setPage(next);
              setSelectedRows([]);
            }}
          />
        </>
      )}

      <Modal
        open={deleteOpen}
        onClose={() => {
          if (deleteBusy) return;
          setDeleteOpen(false);
          setDeleteIds([]);
        }}
        title="Delete Lead"
        description={`You’re about to delete ${deleteIds.length} selected lead${deleteIds.length === 1 ? "" : "s"}. This action cannot be undone.`}
        size="sm"
        closeOnOverlayClick={!deleteBusy}
        footer={
          <>
            <Button
              onClick={() => {
                setDeleteOpen(false);
                setDeleteIds([]);
              }}
              disabled={deleteBusy}
              className="flex-1 sm:flex-none"
            >
              Cancel
            </Button>
            <Button
              onClick={() => void onDeleteConfirm()}
              disabled={deleteBusy}
              className="flex-1 bg-red-600 border-red-600 sm:flex-none"
            >
              {deleteBusy ? <Loader2 className="size-3.5 animate-spin" /> : null}
              {deleteBusy ? "Deleting..." : "Delete"}
            </Button>
          </>
        }
      />

      <EmailReviewModal
        open={Boolean(reviewLead)}
        lead={reviewLead}
        busy={reviewLead ? busyLeadIds.has(reviewLead.id) : false}
        onClose={() => setReviewLeadId(null)}
        onFix={(id) => void fixLeadById(id)}
        onApprove={(id) => void approveLeadById(id)}
      />

      <EmailQueueModal
        open={queueOpen}
        items={queueItems}
        message={queueMessage}
        onClose={() => setQueueOpen(false)}
        onItemsChange={setQueueItems}
      />

      <WhatsAppQueueModal
        open={whatsappQueueOpen}
        items={whatsappQueueItems}
        message={whatsappQueueMessage}
        onClose={() => setWhatsappQueueOpen(false)}
        onItemsChange={setWhatsappQueueItems}
      />

      <CsvUploadModal
        open={csvUploadOpen}
        busy={globalBusy}
        onClose={() => setCsvUploadOpen(false)}
        onImported={onCsvImported}
      />
    </section>
  );
}

export default React.memo(Home);
