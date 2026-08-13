"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ExternalLink,
  Loader2,
  Mail,
  MessageCircle,
  Pencil,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import Button from "@/app/components/ui/button";
import Input from "@/app/components/ui/input";
import Modal from "@/app/components/ui/modal";
import Select from "@/app/components/ui/select";
import Textarea from "@/app/components/ui/textarea";
import Typography from "@/app/components/ui/typography";
import { TableStatus } from "@/app/components/common/table-text";
import { ApiClientError, apiGet, apiSend } from "@/lib/api/client";
import { Lead } from "@/types/lead";

const channelLabel: Record<Lead["contactChannel"], string> = {
  email: "Email",
  phone: "WhatsApp",
  none: "None",
};

const aiReviewLabel: Record<Lead["aiReview"]["status"], string> = {
  pending: "Pending",
  approved: "Approved",
  warning: "Warning",
};

const approvalLabel: Record<Lead["outreach"]["approval"], string> = {
  pending: "Pending",
  approved: "Approved",
};

const sendStatusLabel: Record<Lead["outreach"]["sendStatus"], string> = {
  not_sent: "Not Sent",
  queued: "Queued",
  sending: "Sending",
  sent: "Sent",
  delivered: "Delivered",
  read: "Read",
  failed: "Failed",
  skipped: "Skipped",
};

type LeadDraft = {
  businessName: string;
  category: string;
  city: string;
  country: string;
  description: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  contactChannel: Lead["contactChannel"];
  source: Lead["source"];
  outreachChannel: Lead["outreach"]["channel"];
  outreachSubject: string;
  outreachBody: string;
  outreachStatus: Lead["outreach"]["status"];
  outreachApproval: Lead["outreach"]["approval"];
  outreachSendStatus: Lead["outreach"]["sendStatus"];
  aiReviewStatus: Lead["aiReview"]["status"];
  aiReviewIssues: string;
};

function toDraft(lead: Lead): LeadDraft {
  return {
    businessName: lead.businessName || "",
    category: lead.category || "",
    city: lead.city || "",
    country: lead.country || "",
    description: lead.description || "",
    email: lead.email || "",
    phone: lead.phone || "",
    website: lead.website || "",
    address: lead.address || "",
    contactChannel: lead.contactChannel,
    source: lead.source,
    outreachChannel: lead.outreach.channel,
    outreachSubject: lead.outreach.subject || "",
    outreachBody: lead.outreach.body || "",
    outreachStatus: lead.outreach.status,
    outreachApproval: lead.outreach.approval,
    outreachSendStatus: lead.outreach.sendStatus,
    aiReviewStatus: lead.aiReview.status,
    aiReviewIssues: (lead.aiReview.issues || []).join("\n"),
  };
}

function DetailField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <Typography variants="span" text={label} className="mb-1 block text-xs! text-muted" />
      <Typography variants="p" text={value?.trim() ? value : "—"} className="text-sm! text-foreground break-words" />
    </div>
  );
}

function LeadDetail() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const leadId = params?.id;

  const [lead, setLead] = useState<Lead | null>(null);
  const [draft, setDraft] = useState<LeadDraft | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const loadLead = useCallback(async () => {
    if (!leadId) return;
    try {
      const data = await apiGet<Lead>(`/api/leads/${leadId}`);
      setLead(data);
      setDraft(toDraft(data));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load lead.");
      setLead(null);
      setDraft(null);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    setLoading(true);
    void loadLead();
  }, [loadLead]);

  const onFix = async () => {
    if (!lead) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await apiSend<Lead>("/api/ai/fix-email", "POST", { leadId: lead.id });
      setLead(updated);
      setDraft(toDraft(updated));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to fix message.");
    } finally {
      setBusy(false);
    }
  };

  const onApprove = async () => {
    if (!lead) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await apiSend<Lead>(`/api/leads/${lead.id}/approve`, "POST");
      setLead(updated);
      setDraft(toDraft(updated));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to approve lead.");
    } finally {
      setBusy(false);
    }
  };

  const onSave = async () => {
    if (!lead || !draft) return;
    if (!draft.businessName.trim() || !draft.category.trim() || !draft.city.trim() || !draft.country.trim()) {
      setError("Business name, category, city, and country are required.");
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await apiSend<Lead>(`/api/leads/${lead.id}`, "PATCH", {
        businessName: draft.businessName.trim(),
        category: draft.category.trim(),
        city: draft.city.trim(),
        country: draft.country.trim(),
        description: draft.description,
        email: draft.email.trim(),
        phone: draft.phone.trim(),
        website: draft.website.trim(),
        address: draft.address,
        contactChannel: draft.contactChannel,
        source: draft.source,
        outreach: {
          channel: draft.outreachChannel,
          subject: draft.outreachChannel === "whatsapp" ? "" : draft.outreachSubject,
          body: draft.outreachBody,
          status: draft.outreachStatus,
          approval: draft.outreachApproval,
          sendStatus: draft.outreachSendStatus,
        },
        aiReview: {
          status: draft.aiReviewStatus,
          issues: draft.aiReviewIssues
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean),
        },
      });
      setLead(updated);
      setDraft(toDraft(updated));
      setEditing(false);
      setMessage("Lead saved.");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to save lead.");
    } finally {
      setBusy(false);
    }
  };

  const onCancelEdit = () => {
    if (lead) setDraft(toDraft(lead));
    setEditing(false);
    setError(null);
  };

  const onDelete = async () => {
    if (!lead) return;
    setBusy(true);
    setError(null);
    try {
      await apiSend(`/api/leads/${lead.id}`, "DELETE");
      router.push("/leads");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to delete lead.");
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <section className="flex min-h-[50vh] items-center justify-center px-4">
        <Loader2 className="size-6 animate-spin text-purple-300" />
      </section>
    );
  }

  if (!lead || !draft) {
    return (
      <section className="px-3 py-6 sm:px-4">
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-6 text-center">
          <Typography variants="p" text={error || "Lead not found."} className="mb-4 text-sm! text-red-300" />
          <Button onClick={() => router.push("/leads")}>Back to leads</Button>
        </div>
      </section>
    );
  }

  const hasOutreach = Boolean(lead.outreach.body);
  const canFix = !editing && lead.aiReview.status === "warning";
  const canApprove =
    !editing &&
    lead.aiReview.status === "approved" &&
    lead.outreach.approval === "pending" &&
    hasOutreach &&
    (lead.outreach.channel === "whatsapp" || Boolean(lead.outreach.subject));

  return (
    <section className="px-3 py-3 sm:px-4 sm:py-4">
      <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Button
            onClick={() => router.push("/leads")}
            className="mb-3 border-border bg-transparent px-2! py-1.5! text-muted hover:bg-sidebar hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Back
          </Button>
          <Typography
            variants="h3"
            text={editing ? draft.businessName || "Untitled lead" : lead.businessName}
            className="mb-1.5 break-words text-foreground"
          />
          <div className="flex flex-wrap items-center gap-2">
            <TableStatus text={channelLabel[editing ? draft.contactChannel : lead.contactChannel]} />
            <TableStatus text={aiReviewLabel[editing ? draft.aiReviewStatus : lead.aiReview.status]} />
            <TableStatus text={approvalLabel[editing ? draft.outreachApproval : lead.outreach.approval]} />
            <TableStatus text={sendStatusLabel[editing ? draft.outreachSendStatus : lead.outreach.sendStatus]} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {editing ? (
            <>
              <Button
                onClick={onCancelEdit}
                disabled={busy}
                className="border-border bg-transparent text-muted hover:bg-sidebar hover:text-foreground"
              >
                <X className="size-3.5" />
                Cancel
              </Button>
              <Button onClick={() => void onSave()} disabled={busy} className="bg-purple-600 border-purple-600">
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                Save
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={() => {
                  setDraft(toDraft(lead));
                  setEditing(true);
                  setMessage(null);
                  setError(null);
                }}
                disabled={busy}
                className="border-border bg-transparent text-foreground hover:bg-sidebar"
              >
                <Pencil className="size-3.5" />
                Edit
              </Button>
              {canFix && (
                <Button onClick={() => void onFix()} disabled={busy} className="bg-yellow-600 border-yellow-600">
                  {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Wrench className="size-3.5" />}
                  Fix
                </Button>
              )}
              {canApprove && (
                <Button onClick={() => void onApprove()} disabled={busy} className="bg-purple-600 border-purple-600">
                  <Check className="size-3.5" />
                  Approve
                </Button>
              )}
              <Button
                onClick={() => setDeleteOpen(true)}
                disabled={busy}
                className="border-red-600/50 bg-red-600/20 text-red-200 hover:bg-red-600/30"
              >
                <Trash2 className="size-3.5" />
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      {(error || message) && (
        <div
          className={`mb-4 rounded-lg border px-3 py-2 text-sm ${
            error
              ? "border-red-500/30 bg-red-500/10 text-red-300"
              : "border-green-500/30 bg-green-500/10 text-green-300"
          }`}
        >
          {error || message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
            <Typography variants="h4" text="Business details" className="mb-4 text-foreground" />
            {editing ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="Business Name"
                  value={draft.businessName}
                  onChange={(e) => setDraft((prev) => (prev ? { ...prev, businessName: e.target.value } : prev))}
                />
                <Input
                  label="Category"
                  value={draft.category}
                  onChange={(e) => setDraft((prev) => (prev ? { ...prev, category: e.target.value } : prev))}
                />
                <Input
                  label="City"
                  value={draft.city}
                  onChange={(e) => setDraft((prev) => (prev ? { ...prev, city: e.target.value } : prev))}
                />
                <Input
                  label="Country"
                  value={draft.country}
                  onChange={(e) => setDraft((prev) => (prev ? { ...prev, country: e.target.value } : prev))}
                />
                <Input
                  label="Email"
                  value={draft.email}
                  onChange={(e) => setDraft((prev) => (prev ? { ...prev, email: e.target.value } : prev))}
                  optional
                />
                <Input
                  label="Phone"
                  value={draft.phone}
                  onChange={(e) => setDraft((prev) => (prev ? { ...prev, phone: e.target.value } : prev))}
                  optional
                />
                <Input
                  label="Website"
                  value={draft.website}
                  onChange={(e) => setDraft((prev) => (prev ? { ...prev, website: e.target.value } : prev))}
                  optional
                />
                <Input
                  label="Address"
                  value={draft.address}
                  onChange={(e) => setDraft((prev) => (prev ? { ...prev, address: e.target.value } : prev))}
                  optional
                />
                <Select
                  label="Contact Channel"
                  value={draft.contactChannel}
                  options={[
                    { label: "Email", value: "email" },
                    { label: "WhatsApp", value: "phone" },
                    { label: "None", value: "none" },
                  ]}
                  onValueChange={(value) =>
                    setDraft((prev) =>
                      prev ? { ...prev, contactChannel: value as Lead["contactChannel"] } : prev,
                    )
                  }
                />
                <Select
                  label="Source"
                  value={draft.source}
                  options={[
                    { label: "Google Maps", value: "google_maps" },
                    { label: "Manual", value: "manual" },
                    { label: "Import", value: "import" },
                  ]}
                  onValueChange={(value) =>
                    setDraft((prev) => (prev ? { ...prev, source: value as Lead["source"] } : prev))
                  }
                />
                <div className="sm:col-span-2">
                  <Textarea
                    label="Description"
                    value={draft.description}
                    onChange={(e) => setDraft((prev) => (prev ? { ...prev, description: e.target.value } : prev))}
                    optional
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <DetailField label="Business Name" value={lead.businessName} />
                  <DetailField label="Category" value={lead.category} />
                  <DetailField label="City" value={lead.city} />
                  <DetailField label="Country" value={lead.country} />
                  <DetailField label="Email" value={lead.email} />
                  <DetailField label="Phone" value={lead.phone} />
                  <DetailField label="Website" value={lead.website} />
                  <DetailField label="Address" value={lead.address} />
                  <DetailField label="Source" value={lead.source} />
                  <DetailField label="Contact Channel" value={channelLabel[lead.contactChannel]} />
                  <DetailField label="Created" value={lead.createdAt ? new Date(lead.createdAt).toLocaleString() : null} />
                  <DetailField label="Updated" value={lead.updatedAt ? new Date(lead.updatedAt).toLocaleString() : null} />
                </div>

                {lead.website && (
                  <a
                    href={lead.website}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex items-center gap-1.5 text-sm text-purple-300 hover:text-purple-200"
                  >
                    <ExternalLink className="size-3.5" />
                    Open website
                  </a>
                )}

                {lead.description && (
                  <div className="mt-5 border-t border-border pt-4">
                    <Typography variants="span" text="Description" className="mb-1.5 block text-xs! text-muted" />
                    <p className="whitespace-pre-wrap text-sm leading-6 text-foreground/90">{lead.description}</p>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-2">
              {(editing ? draft.outreachChannel : lead.outreach.channel) === "whatsapp" ? (
                <MessageCircle className="size-4 text-purple-300" />
              ) : (
                <Mail className="size-4 text-purple-300" />
              )}
              <Typography
                variants="h4"
                text={
                  (editing ? draft.outreachChannel : lead.outreach.channel) === "whatsapp"
                    ? "WhatsApp outreach"
                    : "Email outreach"
                }
                className="text-foreground"
              />
            </div>

            {editing ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Select
                    label="Channel"
                    value={draft.outreachChannel}
                    options={[
                      { label: "Email", value: "email" },
                      { label: "WhatsApp", value: "whatsapp" },
                    ]}
                    onValueChange={(value) =>
                      setDraft((prev) =>
                        prev ? { ...prev, outreachChannel: value as Lead["outreach"]["channel"] } : prev,
                      )
                    }
                  />
                  <Select
                    label="Approval"
                    value={draft.outreachApproval}
                    options={[
                      { label: "Pending", value: "pending" },
                      { label: "Approved", value: "approved" },
                    ]}
                    onValueChange={(value) =>
                      setDraft((prev) =>
                        prev ? { ...prev, outreachApproval: value as Lead["outreach"]["approval"] } : prev,
                      )
                    }
                  />
                  <Select
                    label="Outreach Status"
                    value={draft.outreachStatus}
                    options={[
                      { label: "Not Generated", value: "not_generated" },
                      { label: "Generated", value: "generated" },
                      { label: "Ready", value: "ready" },
                      { label: "Queued", value: "queued" },
                      { label: "Sending", value: "sending" },
                      { label: "Sent", value: "sent" },
                      { label: "Delivered", value: "delivered" },
                      { label: "Read", value: "read" },
                      { label: "Failed", value: "failed" },
                      { label: "Skipped", value: "skipped" },
                    ]}
                    onValueChange={(value) =>
                      setDraft((prev) =>
                        prev ? { ...prev, outreachStatus: value as Lead["outreach"]["status"] } : prev,
                      )
                    }
                  />
                  <Select
                    label="Send Status"
                    value={draft.outreachSendStatus}
                    options={[
                      { label: "Not Sent", value: "not_sent" },
                      { label: "Queued", value: "queued" },
                      { label: "Sending", value: "sending" },
                      { label: "Sent", value: "sent" },
                      { label: "Delivered", value: "delivered" },
                      { label: "Read", value: "read" },
                      { label: "Failed", value: "failed" },
                      { label: "Skipped", value: "skipped" },
                    ]}
                    onValueChange={(value) =>
                      setDraft((prev) =>
                        prev ? { ...prev, outreachSendStatus: value as Lead["outreach"]["sendStatus"] } : prev,
                      )
                    }
                  />
                </div>
                {draft.outreachChannel === "email" && (
                  <Input
                    label="Subject"
                    value={draft.outreachSubject}
                    onChange={(e) => setDraft((prev) => (prev ? { ...prev, outreachSubject: e.target.value } : prev))}
                    optional
                  />
                )}
                <Textarea
                  label={draft.outreachChannel === "whatsapp" ? "Message" : "Message body"}
                  value={draft.outreachBody}
                  onChange={(e) => setDraft((prev) => (prev ? { ...prev, outreachBody: e.target.value } : prev))}
                  className="min-h-40"
                  optional
                />
              </div>
            ) : (
              <>
                <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <DetailField label="Channel" value={lead.outreach.channel} />
                  <DetailField label="Approval" value={approvalLabel[lead.outreach.approval]} />
                  <DetailField label="Send Status" value={sendStatusLabel[lead.outreach.sendStatus]} />
                </div>

                {lead.outreach.channel === "email" && (
                  <div className="mb-3">
                    <Typography variants="span" text="Subject" className="mb-1 block text-xs! text-muted" />
                    <div className="rounded-lg border border-border bg-sidebar px-3 py-2 text-sm text-foreground">
                      {lead.outreach.subject || "—"}
                    </div>
                  </div>
                )}

                <div>
                  <Typography
                    variants="span"
                    text={lead.outreach.channel === "whatsapp" ? "Message" : "Message body"}
                    className="mb-1 block text-xs! text-muted"
                  />
                  <div className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-sidebar px-3 py-3 text-sm leading-6 text-foreground">
                    {lead.outreach.body || "No outreach message generated yet."}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
            <Typography variants="h4" text="AI review" className="mb-4 text-foreground" />
            {editing ? (
              <div className="space-y-4">
                <Select
                  label="AI Review Status"
                  value={draft.aiReviewStatus}
                  options={[
                    { label: "Pending", value: "pending" },
                    { label: "Approved", value: "approved" },
                    { label: "Warning", value: "warning" },
                  ]}
                  onValueChange={(value) =>
                    setDraft((prev) =>
                      prev ? { ...prev, aiReviewStatus: value as Lead["aiReview"]["status"] } : prev,
                    )
                  }
                />
                <Textarea
                  label="Issues / website findings (one per line)"
                  value={draft.aiReviewIssues}
                  onChange={(e) => setDraft((prev) => (prev ? { ...prev, aiReviewIssues: e.target.value } : prev))}
                  optional
                />
              </div>
            ) : (
              <>
                <div className="mb-3">
                  <TableStatus text={aiReviewLabel[lead.aiReview.status]} />
                </div>

                {lead.aiReview.status === "approved" ? (
                  <Typography
                    variants="p"
                    text="AI review passed. Ready for manual approval."
                    className="text-sm! text-green-300"
                  />
                ) : lead.aiReview.status === "warning" ? (
                  <Typography variants="p" text="Needs attention before approval." className="text-sm! text-yellow-300" />
                ) : (
                  <Typography variants="p" text="Generate outreach to run AI review." className="text-sm! text-muted" />
                )}

                {lead.aiReview.issues.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <Typography variants="span" text="Findings" className="block text-xs! text-muted" />
                    <ul className="list-disc space-y-1 pl-5">
                      {lead.aiReview.issues.map((issue) => (
                        <li key={issue} className="text-sm text-muted">
                          {issue}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {lead.aiReview.reviewedAt && (
                  <Typography
                    variants="span"
                    text={`Reviewed ${new Date(lead.aiReview.reviewedAt).toLocaleString()}`}
                    className="mt-3 block text-xs! text-muted"
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete Lead"
        description={`You’re about to delete “${lead.businessName}”. This cannot be undone.`}
        size="sm"
        footer={
          <>
            <Button onClick={() => setDeleteOpen(false)} className="flex-1 sm:flex-none">
              Cancel
            </Button>
            <Button onClick={() => void onDelete()} disabled={busy} className="flex-1 bg-red-600 border-red-600 sm:flex-none">
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Delete
            </Button>
          </>
        }
      />
    </section>
  );
}

export default React.memo(LeadDetail);
