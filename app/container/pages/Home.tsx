"use client";

import EmptyPlaceholder from "@/app/components/common/empty-placeholder";
import EmailQueueModal from "@/app/components/common/email-queue-modal";
import EmailReviewModal from "@/app/components/common/email-review-modal";
import Search from "@/app/components/common/search";
import Button from "@/app/components/ui/button";
import Modal from "@/app/components/ui/modal";
import Pagination from "@/app/components/ui/pagination";
import Table from "@/app/components/ui/table";
import Typography from "@/app/components/ui/typography";
import { useLeads } from "@/app/context/leads-context";
import { useSettings } from "@/app/context/settings-context";
import { generateLeadsColumns, RowId, TableButtons } from "@/app/data/leads-data";
import {
  approveLead,
  canQueueLead,
  fixMockEmail,
  generateMockEmail,
  getRandomDelay,
  reviewMockEmail,
  searchLeadMatches,
} from "@/app/lib/mock-lead-workflow";
import { Lead, QueueItem } from "@/app/types/lead";
import { CheckCheck, Loader2, MailPlus, Send, Trash2, UsersRound, Wrench } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useMemo, useState } from "react";

function Home() {
  const router = useRouter();
  const { settings } = useSettings();
  const { leads, setLeads } = useLeads();

  const rowsPerPage = 5;
  const [searchValue, setSearchValue] = useState("");
  const [page, setPage] = useState(1);
  const [selectedRows, setSelectedRows] = useState<RowId[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteIds, setDeleteIds] = useState<string[]>([]);
  const [reviewLeadId, setReviewLeadId] = useState<string | null>(null);
  const [queueOpen, setQueueOpen] = useState(false);
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [busyLeadIds, setBusyLeadIds] = useState<Set<string>>(new Set());
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [globalBusy, setGlobalBusy] = useState(false);

  const selectedLeads = useMemo(
    () => leads.filter((lead) => selectedRows.includes(lead.id)),
    [leads, selectedRows],
  );

  const filteredData = useMemo(
    () => leads.filter((lead) => searchLeadMatches(lead, searchValue)),
    [leads, searchValue],
  );

  const totalPage = Math.max(1, Math.ceil(filteredData.length / rowsPerPage));
  const startIndex = (page - 1) * rowsPerPage;
  const currentData = filteredData.slice(startIndex, startIndex + rowsPerPage);

  const hasSourceData = leads.length > 0;
  const hasFilteredData = filteredData.length > 0;
  const isSearchEmpty = hasSourceData && !hasFilteredData && searchValue.trim().length > 0;
  const isListEmpty = !hasSourceData;

  const selectedWarnings = selectedLeads.filter((lead) => lead.aiReview.status === "warning");
  const selectedApprovable = selectedLeads.filter(
    (lead) => lead.aiReview.status === "approved" && lead.outreach.approval === "pending" && lead.outreach.status !== "not_generated",
  );
  const selectedSendable = selectedLeads.filter(canQueueLead);

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

  const updateLead = (id: string, updater: (lead: Lead) => Lead) => {
    setLeads((prev) => prev.map((lead) => (lead.id === id ? updater(lead) : lead)));
  };

  const onPageChange = (nextPage: number) => {
    setPage(nextPage);
    setSelectedRows([]);
  };

  const openDelete = (ids: string[]) => {
    setDeleteIds(ids);
    setDeleteOpen(true);
  };

  const onDeleteConfirm = () => {
    setLeads((prev) => prev.filter((lead) => !deleteIds.includes(lead.id)));
    setSelectedRows((prev) => prev.filter((id) => !deleteIds.includes(String(id))));
    setDeleteOpen(false);
    setDeleteIds([]);
    if (reviewLeadId && deleteIds.includes(reviewLeadId)) {
      setReviewLeadId(null);
    }
  };

  const generateEmailsForLeads = async (targets: Lead[]) => {
    if (!targets.length || globalBusy) return;

    setGlobalBusy(true);
    const ids = targets.map((lead) => lead.id);
    markBusy(ids, true);

    try {
      for (let index = 0; index < targets.length; index += 1) {
        const lead = targets[index];
        setProgressMessage(`Generating ${index + 1} of ${targets.length}...`);

        const generated = await generateMockEmail(lead);
        const withEmail: Lead = {
          ...lead,
          outreach: {
            ...lead.outreach,
            ...generated,
            status: "generated",
            approval: "pending",
            sendStatus: "not_sent",
          },
          aiReview: { status: "pending", issues: [] },
        };

        setLeads((prev) => prev.map((item) => (item.id === lead.id ? withEmail : item)));

        setProgressMessage(`Reviewing ${index + 1} of ${targets.length}...`);
        const review = await reviewMockEmail(withEmail);
        setLeads((prev) =>
          prev.map((item) =>
            item.id === lead.id
              ? {
                  ...item,
                  aiReview: review,
                }
              : item,
          ),
        );
      }
    } finally {
      markBusy(ids, false);
      setProgressMessage(null);
      setGlobalBusy(false);
    }
  };

  const fixLeadById = async (id: string) => {
    const lead = leads.find((item) => item.id === id);
    if (!lead || lead.aiReview.status !== "warning" || busyLeadIds.has(id)) return;

    markBusy([id], true);
    setProgressMessage("Reviewing...");

    try {
      await new Promise((resolve) => setTimeout(resolve, 350));
      setProgressMessage("Fixing...");
      const fixed = await fixMockEmail(lead);
      setProgressMessage("Re-reviewing...");
      updateLead(id, (current) => ({
        ...current,
        outreach: fixed.outreach,
        aiReview: fixed.aiReview,
      }));
    } finally {
      markBusy([id], false);
      setProgressMessage(null);
    }
  };

  const fixAllWarnings = async (targets: Lead[]) => {
    if (!targets.length || globalBusy) return;
    setGlobalBusy(true);

    try {
      let working = [...leads];

      for (let index = 0; index < targets.length; index += 1) {
        const targetId = targets[index].id;
        const current = working.find((item) => item.id === targetId);
        if (!current || current.aiReview.status !== "warning") continue;

        markBusy([targetId], true);
        setProgressMessage(`Fixing ${index + 1} of ${targets.length}...`);

        const fixed = await fixMockEmail(current);
        working = working.map((item) =>
          item.id === targetId
            ? {
                ...item,
                outreach: fixed.outreach,
                aiReview: fixed.aiReview,
              }
            : item,
        );
        setLeads(working);
        markBusy([targetId], false);
      }
    } finally {
      setProgressMessage(null);
      setGlobalBusy(false);
    }
  };

  const approveLeadById = (id: string) => {
    updateLead(id, approveLead);
  };

  const approveAllSelected = () => {
    const ids = new Set(selectedApprovable.map((lead) => lead.id));
    setLeads((prev) => prev.map((lead) => (ids.has(lead.id) ? approveLead(lead) : lead)));
  };

  const queueApprovedEmails = async (targets: Lead[]) => {
    if (!targets.length || globalBusy) return;

    if (settings.connectionStatus !== "connected") {
      setProgressMessage("Connect email in Settings before sending.");
      setTimeout(() => setProgressMessage(null), 2200);
      return;
    }

    setGlobalBusy(true);
    const items: QueueItem[] = targets.map((lead) => ({
      leadId: lead.id,
      businessName: lead.businessName,
      email: lead.email || "",
      status: "queued",
      delaySec: getRandomDelay(settings.minDelay, settings.maxDelay),
    }));

    setQueueItems(items);
    setQueueOpen(true);

    const ids = targets.map((lead) => lead.id);
    setLeads((prev) =>
      prev.map((lead) =>
        ids.includes(lead.id)
          ? {
              ...lead,
              outreach: {
                ...lead.outreach,
                status: "queued",
                sendStatus: "queued",
              },
            }
          : lead,
      ),
    );

    try {
      for (let index = 0; index < items.length; index += 1) {
        const item = items[index];
        setProgressMessage(`Sending ${index + 1} of ${items.length}...`);

        setQueueItems((prev) => prev.map((row) => (row.leadId === item.leadId ? { ...row, status: "sending" } : row)));
        setLeads((prev) =>
          prev.map((lead) =>
            lead.id === item.leadId
              ? {
                  ...lead,
                  outreach: {
                    ...lead.outreach,
                    status: "sending",
                    sendStatus: "sending",
                  },
                }
              : lead,
          ),
        );

        // Visual simulation only (accelerated)
        await new Promise((resolve) => setTimeout(resolve, Math.min(1800, Math.max(400, item.delaySec * 20))));

        setQueueItems((prev) => prev.map((row) => (row.leadId === item.leadId ? { ...row, status: "sent" } : row)));
        setLeads((prev) =>
          prev.map((lead) =>
            lead.id === item.leadId
              ? {
                  ...lead,
                  outreach: {
                    ...lead.outreach,
                    status: "sent",
                    sendStatus: "sent",
                  },
                }
              : lead,
          ),
        );
      }
    } finally {
      setProgressMessage(null);
      setGlobalBusy(false);
    }
  };

  const columns = generateLeadsColumns({
    onReview: (id) => setReviewLeadId(id),
    onFix: (id) => {
      void fixLeadById(id);
    },
    onApprove: (id) => approveLeadById(id),
    onDelete: (id) => openDelete([id]),
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
            label: "Generate Emails",
            shortLabel: "Generate",
            icon: globalBusy ? <Loader2 className="size-3.5 animate-spin" /> : <MailPlus className="size-3.5" />,
            onClick: () => void generateEmailsForLeads(selectedLeads),
          },
          {
            label: "Approve All",
            shortLabel: "Approve",
            icon: <CheckCheck className="size-3.5" />,
            onClick: approveAllSelected,
            hidden: selectedApprovable.length === 0,
          },
          {
            label: "Fix All",
            shortLabel: "Fix",
            icon: <Wrench className="size-3.5" />,
            onClick: () => void fixAllWarnings(selectedWarnings),
            hidden: selectedWarnings.length === 0,
          },
          {
            label: "Send Approved Emails",
            shortLabel: "Send",
            icon: <Send className="size-3.5" />,
            onClick: () => void queueApprovedEmails(selectedSendable),
            hidden: selectedSendable.length === 0,
          },
          {
            label: "Bulk Delete",
            shortLabel: "Delete",
            icon: <Trash2 className="size-3.5" />,
            onClick: () => openDelete(selectedRows.map(String)),
          },
        ]
      : [
          {
            label: "Generate New Leads",
            shortLabel: "Generate",
            icon: <UsersRound className="size-3.5" />,
            onClick: () => router.push("/leads/generate-leads"),
          },
        ];

  const visibleButtons = tableButtons.filter((button) => !button.hidden);

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
            <div className="flex min-w-0 items-center gap-1 sm:gap-2" key={`${single.label}-${index}`}>
              {index !== 0 && <div className="hidden h-5 w-px bg-border sm:block" />}
              <Button
                onClick={single.onClick}
                disabled={globalBusy && single.label !== `${selectedRows.length} Leads Selected`}
                className="border-transparent px-2! py-1.5! text-xs! gap-x-1 sm:px-3! sm:text-sm!"
              >
                {single.icon && <span className="shrink-0">{single.icon}</span>}
                <span className="sm:hidden">{single.shortLabel ?? single.label}</span>
                <span className="hidden sm:inline">{single.label}</span>
              </Button>
            </div>
          ))}
        </div>
      </div>

      {progressMessage && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-purple-500/20 bg-purple-500/10 px-3 py-2">
          <Loader2 className="size-4 animate-spin text-purple-300" />
          <Typography variants="span" text={progressMessage} className="text-sm! text-purple-200" />
        </div>
      )}

      {isListEmpty ? (
        <EmptyPlaceholder
          variant="empty"
          actionLabel="Generate New Leads"
          onAction={() => router.push("/leads/generate-leads")}
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
          <Table columns={columns} data={currentData} selectedRows={selectedRows} setSelectedRows={setSelectedRows} />
          <Pagination currentPage={page} totalPages={totalPage} onPageChange={onPageChange} />
        </>
      )}

      <Modal
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setDeleteIds([]);
        }}
        title="Delete Lead"
        description={`You’re about to delete ${deleteIds.length} selected lead${deleteIds.length === 1 ? "" : "s"}. This action cannot be undone.`}
        size="sm"
        footer={
          <>
            <Button
              onClick={() => {
                setDeleteOpen(false);
                setDeleteIds([]);
              }}
              className="flex-1 sm:flex-none"
            >
              Cancel
            </Button>
            <Button onClick={onDeleteConfirm} className="flex-1 bg-red-600 border-red-600 sm:flex-none">
              Delete
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
        onApprove={(id) => {
          approveLeadById(id);
        }}
      />

      <EmailQueueModal open={queueOpen} items={queueItems} onClose={() => setQueueOpen(false)} />
    </section>
  );
}

export default React.memo(Home);
