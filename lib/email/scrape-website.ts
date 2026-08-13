const EMAIL_RE =
  /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;

const BLOCKED_LOCAL = new Set([
  "noreply",
  "no-reply",
  "donotreply",
  "do-not-reply",
  "mailer-daemon",
  "postmaster",
  "abuse",
  "webmaster",
]);

const BLOCKED_DOMAINS = new Set([
  "example.com",
  "example.org",
  "domain.com",
  "email.com",
  "sentry.io",
  "wixpress.com",
  "schema.org",
]);

function isUsefulEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) return false;
  if (normalized.endsWith(".png") || normalized.endsWith(".jpg") || normalized.endsWith(".jpeg") || normalized.endsWith(".gif") || normalized.endsWith(".webp")) {
    return false;
  }

  const [local, domain] = normalized.split("@");
  if (!local || !domain) return false;
  if (BLOCKED_LOCAL.has(local)) return false;
  if (BLOCKED_DOMAINS.has(domain)) return false;
  if (domain.includes("googleusercontent") || domain.includes("googleapis")) return false;
  return true;
}

function scoreEmail(email: string) {
  const local = email.split("@")[0] || "";
  if (["info", "hello", "contact", "sales", "admin", "office", "support"].includes(local)) return 3;
  if (local.includes("info") || local.includes("contact") || local.includes("hello")) return 2;
  return 1;
}

function extractEmailsFromHtml(html: string): string[] {
  const found = new Set<string>();

  for (const match of html.matchAll(/mailto:([^"'?\s>]+)/gi)) {
    const raw = decodeURIComponent(match[1] || "").split("?")[0].trim().toLowerCase();
    if (isUsefulEmail(raw)) found.add(raw);
  }

  for (const match of html.matchAll(EMAIL_RE)) {
    const raw = (match[1] || "").trim().toLowerCase();
    if (isUsefulEmail(raw)) found.add(raw);
  }

  return [...found].sort((a, b) => scoreEmail(b) - scoreEmail(a));
}

async function fetchHtml(url: string, timeoutMs = 3500): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "LeadsFinderBot/1.0 (+local-dev email-enrichment)",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      if (!contentType.includes("text/") && contentType.length > 0) return null;
    }

    const text = await response.text();
    return text.slice(0, 200_000);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function withProtocol(website: string) {
  const trimmed = website.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/**
 * Best-effort email discovery — homepage first, then /contact only.
 */
export async function scrapeEmailFromWebsite(website?: string): Promise<string | undefined> {
  const url = website ? withProtocol(website) : null;
  if (!url) return undefined;

  let origin: string;
  try {
    origin = new URL(url).origin;
  } catch {
    return undefined;
  }

  const candidates = [url.startsWith(origin) ? url : origin, `${origin}/contact`];

  for (const candidate of candidates) {
    const html = await fetchHtml(candidate);
    if (!html) continue;
    const emails = extractEmailsFromHtml(html);
    if (emails[0]) return emails[0];
  }

  return undefined;
}

export async function enrichBusinessesWithEmails<T extends { website?: string; email?: string }>(
  businesses: T[],
  concurrency = 10,
): Promise<T[]> {
  const results = [...businesses];
  let index = 0;

  async function worker() {
    while (index < results.length) {
      const current = index;
      index += 1;
      const item = results[current];
      if (item.email?.trim() || !item.website?.trim()) continue;

      const email = await scrapeEmailFromWebsite(item.website);
      if (email) results[current] = { ...item, email };
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, Math.max(results.length, 1)) }, () => worker());
  await Promise.all(workers);
  return results;
}
