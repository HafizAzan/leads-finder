import { FieldValue } from "firebase-admin/firestore";
import { AppError } from "@/lib/api/errors";
import { aiChat } from "@/lib/ai/client";
import { generatedEmailSchema, reviewEmailSchema } from "@/lib/validation/ai.schema";
import { Lead } from "@/types/lead";
import { getLeadForUser, patchLeadFields } from "./leads.service";

function leadContext(lead: Lead) {
  return {
    businessName: lead.businessName,
    category: lead.category,
    city: lead.city,
    country: lead.country,
    description: lead.description || null,
    email: lead.email || null,
    phone: lead.phone || null,
    website: lead.website || null,
    address: lead.address || null,
  };
}

async function parseJsonResponse<T>(content: string, schema: { parse: (value: unknown) => T }): Promise<T> {
  const cleaned = content.replace(/```json|```/g, "").trim();
  try {
    return schema.parse(JSON.parse(cleaned));
  } catch {
    throw new AppError("AI_INVALID_RESPONSE", "AI returned an invalid response format.", 502);
  }
}

export async function generateEmailForLead(userId: string, leadId: string) {
  const lead = await getLeadForUser(userId, leadId);

  const result = await aiChat([
    {
      role: "system",
      content:
        "You write concise, professional B2B outreach emails. Return JSON only with keys subject and body. Personalize using provided facts only. Do not invent facts. Avoid generic mass-email language. Include a clear call to action.",
    },
    {
      role: "user",
      content: JSON.stringify({
        instruction: "Generate a personalized outreach email for this lead.",
        lead: leadContext(lead),
      }),
    },
  ]);

  const email = await parseJsonResponse(result.content, generatedEmailSchema);
  const channel = lead.email ? "email" : "phone";

  return patchLeadFields(userId, leadId, {
    outreach: {
      channel,
      subject: email.subject,
      body: email.body,
      status: "generated",
      approval: "pending",
      sendStatus: "not_sent",
    },
    aiReview: {
      status: "pending",
      issues: [],
      reviewedAt: null,
    },
  });
}

export async function reviewEmailForLead(userId: string, leadId: string) {
  const lead = await getLeadForUser(userId, leadId);

  if (!lead.outreach.subject || !lead.outreach.body) {
    throw new AppError("EMAIL_REQUIRED", "Lead does not have a generated email to review.");
  }

  const result = await aiChat([
    {
      role: "system",
      content:
        'You review outreach emails. Return JSON only: {"status":"approved"|"warning","issues":string[]}. Check personalization, clarity, relevance, unsupported claims, excessive length, weak CTA, generic language, and obvious mistakes. Do not rewrite the email. If no issues, status=approved and issues=[].',
    },
    {
      role: "user",
      content: JSON.stringify({
        lead: leadContext(lead),
        email: {
          subject: lead.outreach.subject,
          body: lead.outreach.body,
        },
      }),
    },
  ]);

  const review = await parseJsonResponse(result.content, reviewEmailSchema);

  return patchLeadFields(userId, leadId, {
    aiReview: {
      status: review.status,
      issues: review.status === "approved" ? [] : review.issues,
      reviewedAt: FieldValue.serverTimestamp(),
    },
  });
}

export async function fixEmailForLead(userId: string, leadId: string) {
  const lead = await getLeadForUser(userId, leadId);

  if (lead.aiReview.status !== "warning") {
    throw new AppError("NO_WARNING", "Only warning emails can be fixed.");
  }

  if (!lead.outreach.subject || !lead.outreach.body) {
    throw new AppError("EMAIL_REQUIRED", "Lead does not have a generated email to fix.");
  }

  const result = await aiChat([
    {
      role: "system",
      content:
        "You fix outreach emails. Return JSON only with keys subject and body. Fix ONLY the listed issues. Do not invent new facts. Keep the email concise and professional.",
    },
    {
      role: "user",
      content: JSON.stringify({
        lead: leadContext(lead),
        currentEmail: {
          subject: lead.outreach.subject,
          body: lead.outreach.body,
        },
        issues: lead.aiReview.issues,
      }),
    },
  ]);

  const email = await parseJsonResponse(result.content, generatedEmailSchema);

  await patchLeadFields(userId, leadId, {
    outreach: {
      ...lead.outreach,
      subject: email.subject,
      body: email.body,
      status: "generated",
      approval: "pending",
      generatedAt: FieldValue.serverTimestamp(),
    },
  });

  return reviewEmailForLead(userId, leadId);
}

export async function generateEmailsForLeads(userId: string, leadIds: string[]) {
  const results = [];

  for (const leadId of leadIds) {
    try {
      await generateEmailForLead(userId, leadId);
      await reviewEmailForLead(userId, leadId);
      results.push({ leadId, success: true });
    } catch (error) {
      results.push({
        leadId,
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate email.",
      });
    }
  }

  return results;
}

export async function reviewEmailsForLeads(userId: string, leadIds: string[]) {
  const results = [];

  for (const leadId of leadIds) {
    try {
      const lead = await reviewEmailForLead(userId, leadId);
      results.push({ leadId, success: true, status: lead.aiReview.status });
    } catch (error) {
      results.push({
        leadId,
        success: false,
        error: error instanceof Error ? error.message : "Failed to review email.",
      });
    }
  }

  return results;
}

export async function fixEmailsForLeads(userId: string, leadIds: string[]) {
  const results = [];

  for (const leadId of leadIds) {
    try {
      const current = await getLeadForUser(userId, leadId);
      if (current.aiReview.status !== "warning") {
        results.push({
          leadId,
          success: false,
          status: current.aiReview.status,
          error: "Lead is not in warning status.",
        });
        continue;
      }

      const lead = await fixEmailForLead(userId, leadId);
      results.push({ leadId, success: true, status: lead.aiReview.status });
    } catch (error) {
      results.push({
        leadId,
        success: false,
        status: "warning" as const,
        error: error instanceof Error ? error.message : "Failed to fix email.",
      });
    }
  }

  return results;
}
