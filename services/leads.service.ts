import { FieldValue } from "firebase-admin/firestore";
import { AppError } from "@/lib/api/errors";
import { collections, db } from "@/lib/firebase/firestore";
import { toIso } from "@/lib/utils/serialize";
import { ContactChannel, Lead, LeadSource } from "@/types/lead";

function resolveContactChannel(email?: string, phone?: string, preferred?: ContactChannel): ContactChannel {
  if (preferred) return preferred;
  if (email) return "email";
  if (phone) return "phone";
  return "none";
}

function mapLead(id: string, data: Record<string, unknown>): Lead {
  const aiReview = (data.aiReview || {}) as Record<string, unknown>;
  const outreach = (data.outreach || {}) as Record<string, unknown>;

  return {
    id,
    userId: String(data.userId || ""),
    businessName: String(data.businessName || ""),
    category: String(data.category || ""),
    city: String(data.city || ""),
    country: String(data.country || ""),
    description: data.description ? String(data.description) : undefined,
    email: data.email ? String(data.email) : undefined,
    phone: data.phone ? String(data.phone) : undefined,
    website: data.website ? String(data.website) : undefined,
    address: data.address ? String(data.address) : undefined,
    contactChannel: (data.contactChannel as ContactChannel) || "none",
    source: (data.source as LeadSource) || "manual",
    aiReview: {
      status: (aiReview.status as Lead["aiReview"]["status"]) || "pending",
      issues: Array.isArray(aiReview.issues) ? (aiReview.issues as string[]) : [],
      reviewedAt: toIso(aiReview.reviewedAt),
    },
    outreach: {
      channel: outreach.channel === "phone" ? "phone" : "email",
      subject: outreach.subject ? String(outreach.subject) : undefined,
      body: outreach.body ? String(outreach.body) : undefined,
      status: (outreach.status as Lead["outreach"]["status"]) || "not_generated",
      approval: (outreach.approval as Lead["outreach"]["approval"]) || "pending",
      sendStatus: (outreach.sendStatus as Lead["outreach"]["sendStatus"]) || "not_sent",
      generatedAt: toIso(outreach.generatedAt),
      approvedAt: toIso(outreach.approvedAt),
      sentAt: toIso(outreach.sentAt),
    },
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  };
}

function defaultAiReview() {
  return {
    status: "pending" as const,
    issues: [] as string[],
    reviewedAt: null,
  };
}

function defaultOutreach(channel: "email" | "phone" = "email") {
  return {
    channel,
    subject: "",
    body: "",
    status: "not_generated" as const,
    approval: "pending" as const,
    sendStatus: "not_sent" as const,
    generatedAt: null,
    approvedAt: null,
    sentAt: null,
  };
}

export async function listLeads(userId: string): Promise<Lead[]> {
  const snap = await db().collection(collections.leads).where("userId", "==", userId).get();

  const leads = snap.docs.map((doc) => mapLead(doc.id, doc.data() as Record<string, unknown>));
  return leads.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

export async function getLeadForUser(userId: string, leadId: string): Promise<Lead> {
  const snap = await db().collection(collections.leads).doc(leadId).get();
  if (!snap.exists) {
    throw new AppError("NOT_FOUND", "Lead not found.", 404);
  }

  const lead = mapLead(snap.id, snap.data() as Record<string, unknown>);
  if (lead.userId !== userId) {
    throw new AppError("UNAUTHORIZED", "You do not have access to this lead.", 403);
  }

  return lead;
}

type CreateLeadInput = {
  businessName: string;
  category: string;
  city: string;
  country: string;
  description?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  contactChannel?: ContactChannel;
  source?: LeadSource;
};

export async function createLead(userId: string, input: CreateLeadInput): Promise<Lead> {
  const email = input.email?.trim() || undefined;
  const phone = input.phone?.trim() || undefined;
  const channel = resolveContactChannel(email, phone, input.contactChannel);
  const ref = db().collection(collections.leads).doc();

  const payload = {
    userId,
    businessName: input.businessName.trim(),
    category: input.category.trim(),
    city: input.city.trim(),
    country: input.country.trim(),
    description: input.description?.trim() || null,
    email: email || null,
    phone: phone || null,
    website: input.website?.trim() || null,
    address: input.address?.trim() || null,
    contactChannel: channel,
    source: input.source || "manual",
    aiReview: defaultAiReview(),
    outreach: defaultOutreach(channel === "phone" ? "phone" : "email"),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  await ref.set(payload);
  return getLeadForUser(userId, ref.id);
}

export async function createLeadsBulk(userId: string, inputs: CreateLeadInput[]): Promise<Lead[]> {
  const created: Lead[] = [];
  for (const input of inputs) {
    created.push(await createLead(userId, input));
  }
  return created;
}

export async function updateLead(userId: string, leadId: string, input: Partial<CreateLeadInput>): Promise<Lead> {
  await getLeadForUser(userId, leadId);

  const payload: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };

  for (const key of ["businessName", "category", "city", "country", "description", "email", "phone", "website", "address", "contactChannel", "source"] as const) {
    if (input[key] !== undefined) {
      payload[key] = typeof input[key] === "string" ? String(input[key]).trim() || null : input[key];
    }
  }

  await db().collection(collections.leads).doc(leadId).set(payload, { merge: true });
  return getLeadForUser(userId, leadId);
}

export async function deleteLead(userId: string, leadId: string): Promise<void> {
  await getLeadForUser(userId, leadId);
  await db().collection(collections.leads).doc(leadId).delete();
}

export async function bulkDeleteLeads(userId: string, ids: string[]) {
  const results = [];

  for (const id of ids) {
    try {
      await deleteLead(userId, id);
      results.push({ id, success: true });
    } catch (error) {
      results.push({
        id,
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete lead.",
      });
    }
  }

  return results;
}

export async function approveLead(userId: string, leadId: string): Promise<Lead> {
  const lead = await getLeadForUser(userId, leadId);

  if (lead.aiReview.status !== "approved") {
    throw new AppError("AI_REVIEW_REQUIRED", "Lead must pass AI review before approval.");
  }

  if (lead.outreach.status === "not_generated" || !lead.outreach.subject || !lead.outreach.body) {
    throw new AppError("EMAIL_REQUIRED", "Lead must have a generated email before approval.");
  }

  await db()
    .collection(collections.leads)
    .doc(leadId)
    .set(
      {
        outreach: {
          ...lead.outreach,
          approval: "approved",
          status: "ready",
          approvedAt: FieldValue.serverTimestamp(),
        },
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

  return getLeadForUser(userId, leadId);
}

export async function bulkApproveLeads(userId: string, ids: string[]) {
  const results = [];

  for (const id of ids) {
    try {
      const lead = await approveLead(userId, id);
      results.push({ leadId: id, success: true, lead });
    } catch (error) {
      results.push({
        leadId: id,
        success: false,
        error: error instanceof Error ? error.message : "Failed to approve lead.",
      });
    }
  }

  return results;
}

export async function patchLeadFields(userId: string, leadId: string, fields: Record<string, unknown>) {
  await getLeadForUser(userId, leadId);
  await db()
    .collection(collections.leads)
    .doc(leadId)
    .set(
      {
        ...fields,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  return getLeadForUser(userId, leadId);
}
