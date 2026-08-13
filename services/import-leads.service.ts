import { AppError } from "@/lib/api/errors";
import { parseCsv, rowsToObjects } from "@/lib/csv/parse";
import { createLeadsBulk } from "./leads.service";
import { Lead } from "@/types/lead";

const MAX_IMPORT_ROWS = 500;

const HEADER_ALIASES: Record<string, string[]> = {
  businessName: ["businessname", "business_name", "business", "company", "companyname", "company_name", "name"],
  category: ["category", "type", "industry"],
  city: ["city", "town"],
  country: ["country", "nation"],
  description: ["description", "desc", "notes", "about"],
  email: ["email", "email_address", "emailaddress", "mail"],
  phone: ["phone", "phone_number", "phonenumber", "mobile", "tel", "telephone"],
  website: ["website", "url", "web", "site"],
  address: ["address", "street", "location"],
};

export type ImportLeadRowError = {
  row: number;
  message: string;
};

export type ImportLeadsResult = {
  imported: number;
  skipped: number;
  leads: Lead[];
  errors: ImportLeadRowError[];
};

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function buildHeaderMap(headers: string[]) {
  const map = new Map<string, number>();
  const normalized = headers.map(normalizeHeader);

  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const index = normalized.findIndex((header) => aliases.includes(header));
    if (index >= 0) map.set(field, index);
  }

  return map;
}

function getCell(row: string[], headerMap: Map<string, number>, field: string) {
  const index = headerMap.get(field);
  if (index === undefined) return "";
  return (row[index] || "").trim();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidWebsite(value: string) {
  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    return Boolean(url.hostname.includes("."));
  } catch {
    return false;
  }
}

function normalizeWebsite(value: string) {
  if (!value) return undefined;
  const withProtocol = value.includes("://") ? value : `https://${value}`;
  return isValidWebsite(withProtocol) ? withProtocol : undefined;
}

export async function importLeadsFromCsv(userId: string, csvText: string): Promise<ImportLeadsResult> {
  const { headers, rows } = parseCsv(csvText);

  if (headers.length === 0 || rows.length === 0) {
    throw new AppError("CSV_EMPTY", "CSV file is empty or has no data rows.", 400);
  }

  if (rows.length > MAX_IMPORT_ROWS) {
    throw new AppError(
      "CSV_TOO_LARGE",
      `CSV has too many rows. Maximum allowed is ${MAX_IMPORT_ROWS}.`,
      400,
    );
  }

  const headerMap = buildHeaderMap(headers);
  const required = ["businessName", "category", "city", "country"] as const;
  const missingRequired = required.filter((field) => !headerMap.has(field));

  if (missingRequired.length > 0) {
    throw new AppError(
      "CSV_INVALID_HEADERS",
      `CSV is missing required columns: ${missingRequired.join(", ")}. Expected headers like businessName, category, city, country.`,
      400,
    );
  }

  const errors: ImportLeadRowError[] = [];
  const inputs: Array<{
    businessName: string;
    category: string;
    city: string;
    country: string;
    description?: string;
    email?: string;
    phone?: string;
    website?: string;
    address?: string;
    source: "import";
  }> = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2; // header is row 1
    const businessName = getCell(row, headerMap, "businessName");
    const category = getCell(row, headerMap, "category");
    const city = getCell(row, headerMap, "city");
    const country = getCell(row, headerMap, "country");
    const description = getCell(row, headerMap, "description");
    const email = getCell(row, headerMap, "email");
    const phone = getCell(row, headerMap, "phone");
    const websiteRaw = getCell(row, headerMap, "website");
    const address = getCell(row, headerMap, "address");

    if (!businessName || !category || !city || !country) {
      errors.push({
        row: rowNumber,
        message: "Missing required fields (businessName, category, city, country).",
      });
      return;
    }

    // Invalid / placeholder emails & websites are ignored — row still imports.
    const resolvedEmail = email && isValidEmail(email) ? email : undefined;
    const website = websiteRaw ? normalizeWebsite(websiteRaw) : undefined;

    inputs.push({
      businessName,
      category,
      city,
      country,
      description: description || undefined,
      email: resolvedEmail,
      phone: phone || undefined,
      website,
      address: address || undefined,
      source: "import",
    });
  });

  if (inputs.length === 0) {
    throw new AppError(
      "CSV_NO_VALID_ROWS",
      errors[0]?.message
        ? `No valid rows to import. First error (row ${errors[0].row}): ${errors[0].message}`
        : "No valid rows to import.",
      400,
    );
  }

  const leads = await createLeadsBulk(userId, inputs);

  return {
    imported: leads.length,
    skipped: errors.length,
    leads,
    errors: errors.slice(0, 25),
  };
}

/** Used only for debugging/tests of header mapping. */
export function previewCsvHeaders(csvText: string) {
  const { headers, rows } = parseCsv(csvText);
  return {
    headers,
    sample: rowsToObjects(headers, rows.slice(0, 3)),
  };
}
