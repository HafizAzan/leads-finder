import { FieldValue } from "firebase-admin/firestore";
import { AppError } from "@/lib/api/errors";
import { aiChat } from "@/lib/ai/client";
import { mapPool } from "@/lib/utils/async-pool";
import { generatedOutreachWithReviewSchema, reviewEmailSchema } from "@/lib/validation/ai.schema";
import { analyzeWebsite, WebsiteAnalysisSnapshot } from "@/lib/website/analyze-site";
import { Lead } from "@/types/lead";
import { getLeadForUser, patchLeadFields } from "./leads.service";

const AI_BULK_CONCURRENCY = 1;

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

function compactWebsiteForPrompt(snapshot: WebsiteAnalysisSnapshot) {
  return {
    website: snapshot.website,
    https: snapshot.https,
    emailsFound: snapshot.emailsFound,
    phonesFound: snapshot.phonesFound,
    autoSignals: snapshot.rawSignals,
    pages: snapshot.pages.map((page) => ({
      url: page.url,
      ok: page.ok,
      status: page.status,
      title: page.title,
      metaDescription: page.metaDescription,
      headings: page.headings.slice(0, 8),
      wordCount: page.wordCount,
      hasViewportMeta: page.hasViewportMeta,
      hasCanonical: page.hasCanonical,
      formCount: page.formCount,
      linkCount: page.linkCount,
      imageWithoutAlt: page.imageWithoutAlt,
      textSample: page.textSample.slice(0, 1200),
    })),
  };
}

function buildTemplateOutreach(lead: Lead, useWhatsApp: boolean) {
  const where = [lead.city, lead.country].filter(Boolean).join(", ");
  const subject = useWhatsApp ? "" : `Quick idea for ${lead.businessName}`;

  const body = useWhatsApp
    ? `Hi ${lead.businessName} team — I help ${lead.category || "local"} businesses in ${where || "your area"} improve their website, bookings, and WhatsApp follow-ups. Open to a quick chat this week?`
    : `Hi ${lead.businessName} team,\n\nI reviewed your online presence for ${lead.category || "your business"} in ${where || "your area"} and spotted a few opportunities around website clarity, trust, and lead capture.\n\nWould you be open to a short call this week to walk through them?\n\nBest regards`;

  return { subject, body };
}

function systemPrompt(useWhatsApp: boolean, hasWebsite: boolean) {
  const channelRules = useWhatsApp
    ? `Channel = WhatsApp. Return JSON with "subject":"" (always empty) and "body" = the single WhatsApp message (friendly, concise, under ~500 chars when possible). No email subject.`
    : `Channel = Email. Return JSON with "subject" (compelling, specific) and "body" (short professional email).`;

  const analysisRules = hasWebsite
    ? `A websiteSnapshot is provided. First analyze it thoroughly for:
- technical issues (HTTPS, broken/missing pages, SEO title/meta, mobile viewport, accessibility/alt text, forms, thin content)
- logical/business issues (unclear offer, weak CTAs, missing contact/about, trust gaps, confusing messaging)
Then craft outreach that references 2-3 concrete findings (not a raw bug dump). Put the key findings in "websiteFindings" (short bullets) and any copy-quality concerns in "issues".`
    : `No website snapshot. Write useful generic outreach from lead fields only. "websiteFindings" should be [].`;

  return `You are a website auditor and B2B outreach copywriter.
${analysisRules}
${channelRules}
Return ONLY JSON:
{"subject":"...","body":"...","websiteFindings":["..."],"reviewStatus":"approved"|"warning","issues":["..."]}
reviewStatus=warning only if the generated outreach itself is weak/unclear; website problems belong in websiteFindings.`;
}

async function parseJsonResponse<T>(content: string, schema: { parse: (value: unknown) => T }): Promise<T> {
  let cleaned = content.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/```json|```/g, "").trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  try {
    return schema.parse(JSON.parse(cleaned));
  } catch {
    throw new AppError("AI_INVALID_RESPONSE", "AI returned an invalid response format.", 502);
  }
}

export async function generateEmailForLead(userId: string, leadId: string) {
  const lead = await getLeadForUser(userId, leadId);
  const hasEmail = Boolean(lead.email?.trim());
  const hasPhone = Boolean(lead.phone?.trim());
  const useWhatsApp = !hasEmail && hasPhone;

  if (!hasEmail && !hasPhone) {
    throw new AppError("NO_CONTACT", "Lead has neither email nor phone for outreach.", 400);
  }

  const channel = useWhatsApp ? "whatsapp" : "email";
  let subject = "";
  let body = "";
  let reviewStatus: "approved" | "warning" = "approved";
  let issues: string[] = [];
  let websiteFindings: string[] = [];

  const websiteSnapshot = lead.website?.trim() ? await analyzeWebsite(lead.website) : null;

  try {
    const result = await aiChat([
      {
        role: "system",
        content: systemPrompt(useWhatsApp, Boolean(websiteSnapshot)),
      },
      {
        role: "user",
        content: JSON.stringify({
          channel,
          lead: leadContext(lead),
          websiteSnapshot: websiteSnapshot ? compactWebsiteForPrompt(websiteSnapshot) : null,
        }),
      },
    ]);

    const parsed = await parseJsonResponse(result.content, generatedOutreachWithReviewSchema);
    if (!useWhatsApp && !parsed.subject?.trim()) {
      throw new AppError("AI_INVALID_RESPONSE", "AI returned an email without a subject.", 502);
    }

    subject = useWhatsApp ? "" : parsed.subject;
    body = parsed.body;
    reviewStatus = parsed.reviewStatus === "warning" ? "warning" : "approved";
    websiteFindings = (parsed.websiteFindings || []).map((item) => item.trim()).filter(Boolean).slice(0, 10);
    const copyIssues = reviewStatus === "approved" ? [] : parsed.issues.slice(0, 5);
    // Surface website findings in AI review panel so user sees the analysis
    issues = [...websiteFindings.map((f) => `Site: ${f}`), ...copyIssues].slice(0, 12);
    if (websiteFindings.length > 0 && reviewStatus === "approved") {
      // Keep approved for send flow, but still show findings
      reviewStatus = "approved";
    }
  } catch (error) {
    console.warn("[ai] generate fallback used:", error instanceof Error ? error.message : error);

    const template = buildTemplateOutreach(lead, useWhatsApp);
    subject = template.subject;
    body = template.body;
    reviewStatus = "warning";
    const signalFindings = (websiteSnapshot?.rawSignals || []).slice(0, 6).map((f) => `Site: ${f}`);
    issues = [
      ...signalFindings,
      "Generated with template fallback because AI timed out or failed. Please review before sending.",
    ].slice(0, 12);
  }

  return patchLeadFields(userId, leadId, {
    outreach: {
      channel,
      subject,
      body,
      status: "generated",
      approval: "pending",
      sendStatus: "not_sent",
      generatedAt: FieldValue.serverTimestamp(),
    },
    aiReview: {
      status: reviewStatus,
      issues,
      reviewedAt: FieldValue.serverTimestamp(),
    },
  });
}

export async function reviewEmailForLead(userId: string, leadId: string) {
  const lead = await getLeadForUser(userId, leadId);

  if (!lead.outreach.body) {
    throw new AppError("EMAIL_REQUIRED", "Lead does not have a generated message to review.");
  }
  if (lead.outreach.channel === "email" && !lead.outreach.subject) {
    throw new AppError("EMAIL_REQUIRED", "Lead does not have a generated email to review.");
  }

  try {
    const result = await aiChat([
      {
        role: "system",
        content:
          'Return ONLY JSON: {"status":"approved"|"warning","issues":[]}. Keep issues short. Focus on outreach copy quality, not website bugs.',
      },
      {
        role: "user",
        content: JSON.stringify({
          channel: lead.outreach.channel,
          subject: lead.outreach.subject,
          body: lead.outreach.body,
          businessName: lead.businessName,
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
  } catch (error) {
    console.warn("[ai] review fallback used:", error instanceof Error ? error.message : error);
    return patchLeadFields(userId, leadId, {
      aiReview: {
        status: "warning",
        issues: ["AI review unavailable. Please manually review this message."],
        reviewedAt: FieldValue.serverTimestamp(),
      },
    });
  }
}

export async function fixEmailForLead(userId: string, leadId: string) {
  const lead = await getLeadForUser(userId, leadId);

  if (lead.aiReview.status !== "warning") {
    throw new AppError("NO_WARNING", "Only warning emails can be fixed.");
  }

  if (!lead.outreach.body) {
    throw new AppError("EMAIL_REQUIRED", "Lead does not have a generated message to fix.");
  }

  const useWhatsApp = lead.outreach.channel === "whatsapp";
  const websiteSnapshot = lead.website?.trim() ? await analyzeWebsite(lead.website) : null;

  try {
    const result = await aiChat([
      {
        role: "system",
        content: `${systemPrompt(useWhatsApp, Boolean(websiteSnapshot))} Fix the current outreach using the listed issues.`,
      },
      {
        role: "user",
        content: JSON.stringify({
          channel: lead.outreach.channel,
          currentOutreach: {
            subject: lead.outreach.subject,
            body: lead.outreach.body,
          },
          issues: lead.aiReview.issues,
          lead: leadContext(lead),
          websiteSnapshot: websiteSnapshot ? compactWebsiteForPrompt(websiteSnapshot) : null,
        }),
      },
    ]);

    const email = await parseJsonResponse(result.content, generatedOutreachWithReviewSchema);
    const websiteFindings = (email.websiteFindings || []).map((item) => item.trim()).filter(Boolean).slice(0, 10);
    await patchLeadFields(userId, leadId, {
      outreach: {
        ...lead.outreach,
        subject: useWhatsApp ? "" : email.subject,
        body: email.body,
        status: "generated",
        approval: "pending",
        generatedAt: FieldValue.serverTimestamp(),
      },
      aiReview: {
        status: email.reviewStatus === "warning" ? "warning" : "approved",
        issues: [
          ...websiteFindings.map((f) => `Site: ${f}`),
          ...(email.reviewStatus === "warning" ? email.issues.slice(0, 5) : []),
        ].slice(0, 12),
        reviewedAt: FieldValue.serverTimestamp(),
      },
    });
    return getLeadForUser(userId, leadId);
  } catch (error) {
    console.warn("[ai] fix fallback used:", error instanceof Error ? error.message : error);
    const template = buildTemplateOutreach(lead, useWhatsApp);
    await patchLeadFields(userId, leadId, {
      outreach: {
        ...lead.outreach,
        subject: template.subject,
        body: template.body,
        status: "generated",
        approval: "pending",
        generatedAt: FieldValue.serverTimestamp(),
      },
    });
  }

  return reviewEmailForLead(userId, leadId);
}

export async function generateEmailsForLeads(userId: string, leadIds: string[]) {
  return mapPool(leadIds, AI_BULK_CONCURRENCY, async (leadId) => {
    try {
      await generateEmailForLead(userId, leadId);
      return { leadId, success: true as const };
    } catch (error) {
      return {
        leadId,
        success: false as const,
        error: error instanceof Error ? error.message : "Failed to generate email.",
      };
    }
  });
}

export async function reviewEmailsForLeads(userId: string, leadIds: string[]) {
  return mapPool(leadIds, AI_BULK_CONCURRENCY, async (leadId) => {
    try {
      const lead = await reviewEmailForLead(userId, leadId);
      return { leadId, success: true as const, status: lead.aiReview.status };
    } catch (error) {
      return {
        leadId,
        success: false as const,
        error: error instanceof Error ? error.message : "Failed to review email.",
      };
    }
  });
}

export async function fixEmailsForLeads(userId: string, leadIds: string[]) {
  return mapPool(leadIds, AI_BULK_CONCURRENCY, async (leadId) => {
    try {
      const current = await getLeadForUser(userId, leadId);
      if (current.aiReview.status !== "warning") {
        return {
          leadId,
          success: false as const,
          status: current.aiReview.status,
          error: "Lead is not in warning status.",
        };
      }

      const lead = await fixEmailForLead(userId, leadId);
      return { leadId, success: true as const, status: lead.aiReview.status };
    } catch (error) {
      return {
        leadId,
        success: false as const,
        status: "warning" as const,
        error: error instanceof Error ? error.message : "Failed to fix email.",
      };
    }
  });
}
