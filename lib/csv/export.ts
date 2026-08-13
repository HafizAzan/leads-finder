import { Lead } from "@/types/lead";

const CSV_HEADERS = [
  "businessName",
  "category",
  "city",
  "country",
  "email",
  "phone",
  "website",
  "address",
  "description",
  "contactChannel",
  "source",
  "aiReviewStatus",
  "outreachChannel",
  "outreachSubject",
  "outreachBody",
  "approval",
  "sendStatus",
  "createdAt",
] as const;

function escapeCsvCell(value: string) {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function leadToRow(lead: Lead): Record<(typeof CSV_HEADERS)[number], string> {
  return {
    businessName: lead.businessName || "",
    category: lead.category || "",
    city: lead.city || "",
    country: lead.country || "",
    email: lead.email || "",
    phone: lead.phone || "",
    website: lead.website || "",
    address: lead.address || "",
    description: lead.description || "",
    contactChannel: lead.contactChannel || "",
    source: lead.source || "",
    aiReviewStatus: lead.aiReview.status || "",
    outreachChannel: lead.outreach.channel || "",
    outreachSubject: lead.outreach.subject || "",
    outreachBody: lead.outreach.body || "",
    approval: lead.outreach.approval || "",
    sendStatus: lead.outreach.sendStatus || "",
    createdAt: lead.createdAt || "",
  };
}

export function leadsToCsv(leads: Lead[]): string {
  const lines = [CSV_HEADERS.join(",")];

  for (const lead of leads) {
    const row = leadToRow(lead);
    lines.push(CSV_HEADERS.map((header) => escapeCsvCell(row[header])).join(","));
  }

  return lines.join("\r\n");
}

export function downloadLeadsCsv(leads: Lead[], filename = "leads.csv") {
  const csv = leadsToCsv(leads);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
