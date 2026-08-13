import { FieldValue, WriteBatch } from "firebase-admin/firestore";
import { AppError } from "@/lib/api/errors";
import { collections, db } from "@/lib/firebase/firestore";
import { mapPool } from "@/lib/utils/async-pool";
import { toIso } from "@/lib/utils/serialize";
import { ContactChannel, Lead, LeadSource, OutreachChannel } from "@/types/lead";

const FIRESTORE_BATCH_LIMIT = 400;

function resolveContactChannel(email?: string, phone?: string, preferred?: ContactChannel): ContactChannel {
  if (preferred) return preferred;
  if (email) return "email";
  if (phone) return "phone";
  return "none";
}

function resolveOutreachChannel(email?: string, phone?: string): OutreachChannel {
  if (email) return "email";
  if (phone) return "whatsapp";
  return "email";
}

function mapOutreachChannel(value: unknown): OutreachChannel {
  if (value === "whatsapp" || value === "phone") return "whatsapp";
  return "email";
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
      channel: mapOutreachChannel(outreach.channel),
      subject: outreach.subject ? String(outreach.subject) : undefined,
      body: outreach.body ? String(outreach.body) : undefined,
      status: (outreach.status as Lead["outreach"]["status"]) || "not_generated",
      approval: (outreach.approval as Lead["outreach"]["approval"]) || "pending",
      sendStatus: (outreach.sendStatus as Lead["outreach"]["sendStatus"]) || "not_sent",
      generatedAt: toIso(outreach.generatedAt),
      approvedAt: toIso(outreach.approvedAt),
      sentAt: toIso(outreach.sentAt),
      whatsappMessageId: outreach.whatsappMessageId ? String(outreach.whatsappMessageId) : null,
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

function defaultOutreach(channel: OutreachChannel = "email") {
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

function buildLeadPayload(userId: string, input: CreateLeadInput) {
  const email = input.email?.trim() || undefined;
  const phone = input.phone?.trim() || undefined;
  const channel = resolveContactChannel(email, phone, input.contactChannel);
  const outreachChannel = resolveOutreachChannel(email, phone);

  return {
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
    outreach: defaultOutreach(outreachChannel),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

async function commitBatches(build: (batch: WriteBatch, start: number, end: number) => void, total: number) {
  for (let start = 0; start < total; start += FIRESTORE_BATCH_LIMIT) {
    const end = Math.min(start + FIRESTORE_BATCH_LIMIT, total);
    const batch = db().batch();
    build(batch, start, end);
    await batch.commit();
  }
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

export type UpdateLeadInput = Partial<CreateLeadInput> & {
  outreach?: Partial<Lead["outreach"]>;
  aiReview?: Partial<Lead["aiReview"]>;
};

export async function createLead(userId: string, input: CreateLeadInput): Promise<Lead> {
  const ref = db().collection(collections.leads).doc();
  const payload = buildLeadPayload(userId, input);
  await ref.set(payload);

  const now = new Date().toISOString();
  return mapLead(ref.id, {
    ...payload,
    createdAt: now,
    updatedAt: now,
  } as Record<string, unknown>);
}

export async function createLeadsBulk(userId: string, inputs: CreateLeadInput[]): Promise<Lead[]> {
  if (inputs.length === 0) return [];

  const now = new Date().toISOString();
  const prepared = inputs.map((input) => {
    const ref = db().collection(collections.leads).doc();
    const payload = buildLeadPayload(userId, input);
    return { ref, payload };
  });

  await commitBatches((batch, start, end) => {
    for (let i = start; i < end; i += 1) {
      batch.set(prepared[i].ref, prepared[i].payload);
    }
  }, prepared.length);

  return prepared.map(({ ref, payload }) =>
    mapLead(ref.id, {
      ...payload,
      createdAt: now,
      updatedAt: now,
    } as Record<string, unknown>),
  );
}

export async function updateLead(userId: string, leadId: string, input: UpdateLeadInput): Promise<Lead> {
  const existing = await getLeadForUser(userId, leadId);

  const payload: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };

  for (const key of [
    "businessName",
    "category",
    "city",
    "country",
    "description",
    "email",
    "phone",
    "website",
    "address",
    "contactChannel",
    "source",
  ] as const) {
    if (input[key] !== undefined) {
      payload[key] = typeof input[key] === "string" ? String(input[key]).trim() || null : input[key];
    }
  }

  if (input.outreach) {
    payload.outreach = {
      ...existing.outreach,
      ...input.outreach,
      subject: input.outreach.subject !== undefined ? input.outreach.subject : existing.outreach.subject,
      body: input.outreach.body !== undefined ? input.outreach.body : existing.outreach.body,
    };
  }

  if (input.aiReview) {
    payload.aiReview = {
      ...existing.aiReview,
      ...input.aiReview,
      issues: input.aiReview.issues !== undefined ? input.aiReview.issues : existing.aiReview.issues,
    };
  }

  await db().collection(collections.leads).doc(leadId).set(payload, { merge: true });
  return getLeadForUser(userId, leadId);
}

export async function deleteLead(userId: string, leadId: string): Promise<void> {
  await getLeadForUser(userId, leadId);
  await db().collection(collections.leads).doc(leadId).delete();
}

export async function bulkDeleteLeads(userId: string, ids: string[]) {
  if (ids.length === 0) return [];

  const uniqueIds = [...new Set(ids)];
  const snaps = await mapPool(uniqueIds, 20, async (id) => {
    const snap = await db().collection(collections.leads).doc(id).get();
    return { id, snap };
  });

  const results: Array<{ id: string; success: boolean; error?: string }> = [];
  const deletable: string[] = [];

  for (const { id, snap } of snaps) {
    if (!snap.exists) {
      results.push({ id, success: false, error: "Lead not found." });
      continue;
    }
    const data = snap.data() as Record<string, unknown>;
    if (String(data.userId || "") !== userId) {
      results.push({ id, success: false, error: "You do not have access to this lead." });
      continue;
    }
    deletable.push(id);
  }

  if (deletable.length > 0) {
    await commitBatches((batch, start, end) => {
      for (let i = start; i < end; i += 1) {
        batch.delete(db().collection(collections.leads).doc(deletable[i]));
      }
    }, deletable.length);

    for (const id of deletable) {
      results.push({ id, success: true });
    }
  }

  return results;
}

export async function approveLead(userId: string, leadId: string): Promise<Lead> {
  const lead = await getLeadForUser(userId, leadId);

  if (lead.aiReview.status !== "approved") {
    throw new AppError("AI_REVIEW_REQUIRED", "Lead must pass AI review before approval.");
  }

  if (lead.outreach.status === "not_generated" || !lead.outreach.body) {
    throw new AppError("EMAIL_REQUIRED", "Lead must have a generated outreach message before approval.");
  }

  if (lead.outreach.channel === "email" && !lead.outreach.subject) {
    throw new AppError("EMAIL_REQUIRED", "Lead must have a generated email subject before approval.");
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
  return mapPool(ids, 5, async (id) => {
    try {
      const lead = await approveLead(userId, id);
      return { leadId: id, success: true as const, lead };
    } catch (error) {
      return {
        leadId: id,
        success: false as const,
        error: error instanceof Error ? error.message : "Failed to approve lead.",
      };
    }
  });
}

export async function patchLeadFields(userId: string, leadId: string, fields: Record<string, unknown>) {
  const existing = await getLeadForUser(userId, leadId);
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

  // Avoid a second round-trip when the caller only needs confirmation + merged fields.
  const now = new Date().toISOString();
  return {
    ...existing,
    ...(fields as Partial<Lead>),
    outreach: (fields.outreach as Lead["outreach"]) || existing.outreach,
    aiReview: (fields.aiReview as Lead["aiReview"]) || existing.aiReview,
    updatedAt: now,
  };
}
