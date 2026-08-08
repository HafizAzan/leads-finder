import { Lead } from "@/app/types/lead";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const WARNING_ISSUES = [
  "Opening is too generic.",
  "Message is longer than necessary.",
  "Call to action is unclear.",
  "Personalization is weak.",
] as const;

const SUBJECT_VARIANTS = [
  (lead: Lead) => `Quick idea for ${lead.businessName} in ${lead.city}`,
  (lead: Lead) => `Helping ${lead.category.toLowerCase()} teams in ${lead.city}`,
  (lead: Lead) => `${lead.businessName}: a short growth note`,
  (lead: Lead) => `Noticed ${lead.businessName} — worth a quick chat?`,
];

function hashSeed(value: string): number {
  return value.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

export function getRandomDelay(minDelay: number, maxDelay: number): number {
  const min = Math.max(0, Math.floor(minDelay));
  const max = Math.max(min, Math.floor(maxDelay));
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export async function generateMockEmail(lead: Lead): Promise<Pick<Lead["outreach"], "subject" | "body" | "channel">> {
  await wait(450 + (hashSeed(lead.id) % 350));

  const variant = SUBJECT_VARIANTS[hashSeed(lead.id) % SUBJECT_VARIANTS.length];
  const subject = variant(lead);
  const contactLine = lead.email
    ? `I can send details to ${lead.email}.`
    : lead.phone
      ? `Happy to walk through this on a quick call at ${lead.phone}.`
      : "Happy to share a short overview if useful.";

  const focus = lead.description?.trim() || `your ${lead.category.toLowerCase()} work`;
  const body = [
    `Hi ${lead.businessName} team,`,
    "",
    `I came across your ${lead.category.toLowerCase()} presence in ${lead.city}, ${lead.country}, and wanted to share a concise idea related to ${focus}.`,
    "",
    `We help similar businesses tighten lead follow-up without adding busywork. If that sounds relevant, ${contactLine}`,
    "",
    "Would you be open to a 10-minute chat this week?",
    "",
    "Best,",
    "AI Lead Finder",
  ].join("\n");

  return {
    subject,
    body,
    channel: lead.email ? "email" : "phone",
  };
}

export async function reviewMockEmail(lead: Lead): Promise<Lead["aiReview"]> {
  await wait(300 + (hashSeed(lead.id + lead.outreach.subject) % 250));

  const seed = hashSeed(`${lead.id}:${lead.outreach.subject}:${lead.outreach.body.length}`);
  const shouldWarn = seed % 3 !== 0;

  if (!shouldWarn) {
    return { status: "approved", issues: [] };
  }

  const issueCount = (seed % 3) + 1;
  const issues = Array.from({ length: issueCount }, (_, index) => WARNING_ISSUES[(seed + index) % WARNING_ISSUES.length]);

  return {
    status: "warning",
    issues: [...new Set(issues)],
  };
}

export async function fixMockEmail(lead: Lead): Promise<{ outreach: Lead["outreach"]; aiReview: Lead["aiReview"] }> {
  await wait(400);

  let subject = lead.outreach.subject;
  let body = lead.outreach.body;
  const issues = lead.aiReview.issues;

  if (issues.some((issue) => issue.toLowerCase().includes("generic"))) {
    subject = `${lead.businessName}: tailored idea for ${lead.city}`;
    body = body.replace(
      /I came across your .+ presence/,
      `I specifically noticed how ${lead.businessName} approaches ${lead.category.toLowerCase()} work`,
    );
  }

  if (issues.some((issue) => issue.toLowerCase().includes("longer"))) {
    const lines = body.split("\n").filter(Boolean);
    body = [
      lines[0] || `Hi ${lead.businessName} team,`,
      "",
      `Quick note for your ${lead.category.toLowerCase()} team in ${lead.city}: we help peers simplify outreach follow-up.`,
      "",
      lead.email ? `Can I send a 3-bullet overview to ${lead.email}?` : "Open to a brief call this week?",
      "",
      "Best,",
      "AI Lead Finder",
    ].join("\n");
  }

  if (issues.some((issue) => issue.toLowerCase().includes("call to action") || issue.toLowerCase().includes("unclear"))) {
    body = `${body.trim()}\n\nReply with “interested” and I’ll share next steps.`;
  }

  if (issues.some((issue) => issue.toLowerCase().includes("personalization"))) {
    const detail = lead.description?.trim() || `${lead.category} services in ${lead.city}`;
    body = body.replace(
      /Wanted to share a concise idea related to .+?\./i,
      `Wanted to share a concise idea related to ${detail}.`,
    );
    if (!body.includes(detail)) {
      body = body.replace(
        /\n\n/,
        `\n\nGiven your focus on ${detail}, this may be a practical fit.\n\n`,
      );
    }
  }

  await wait(350);

  const draftLead: Lead = {
    ...lead,
    outreach: {
      ...lead.outreach,
      subject,
      body,
      status: "generated",
    },
  };

  // Force an approved re-review after fix for predictable UX
  await wait(300);
  const aiReview: Lead["aiReview"] = { status: "approved", issues: [] };

  return {
    outreach: {
      ...draftLead.outreach,
      status: "generated",
      approval: "pending",
    },
    aiReview,
  };
}

export function approveLead(lead: Lead): Lead {
  if (lead.aiReview.status !== "approved") return lead;
  if (lead.outreach.status === "not_generated") return lead;

  return {
    ...lead,
    outreach: {
      ...lead.outreach,
      approval: "approved",
      status: lead.outreach.status === "generated" ? "ready" : lead.outreach.status,
    },
  };
}

export function canQueueLead(lead: Lead): boolean {
  return (
    lead.aiReview.status === "approved" &&
    lead.outreach.approval === "approved" &&
    Boolean(lead.email) &&
    lead.outreach.sendStatus !== "sent" &&
    lead.outreach.sendStatus !== "sending"
  );
}

export function searchLeadMatches(lead: Lead, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const haystack = [
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
    .toLowerCase();

  return haystack.includes(q);
}
