export type WebsitePageSnapshot = {
  url: string;
  ok: boolean;
  status: number | null;
  title: string | null;
  metaDescription: string | null;
  headings: string[];
  textSample: string;
  wordCount: number;
  hasViewportMeta: boolean;
  hasCanonical: boolean;
  formCount: number;
  linkCount: number;
  imageWithoutAlt: number;
};

export type WebsiteAnalysisSnapshot = {
  website: string;
  origin: string | null;
  https: boolean;
  pages: WebsitePageSnapshot[];
  emailsFound: string[];
  phonesFound: string[];
  rawSignals: string[];
  fetchedAt: string;
};

const EMAIL_RE = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
const PHONE_RE = /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}/g;

function withProtocol(website: string) {
  const trimmed = website.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function stripTags(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function matchOne(html: string, re: RegExp) {
  const m = html.match(re);
  return m?.[1]?.trim() || null;
}

function matchAll(html: string, re: RegExp) {
  return [...html.matchAll(re)].map((m) => (m[1] || "").trim()).filter(Boolean);
}

async function fetchHtml(url: string, timeoutMs = 8000): Promise<{ html: string; status: number } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "LeadsFinderBot/1.0 (+website-analysis)",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    const contentType = response.headers.get("content-type") || "";
    if (!response.ok && response.status >= 500) {
      return { html: "", status: response.status };
    }
    if (!contentType.includes("html") && !contentType.includes("text/") && contentType.length > 0) {
      return { html: "", status: response.status };
    }

    const html = (await response.text()).slice(0, 250_000);
    return { html, status: response.status };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function parsePage(url: string, html: string, status: number): WebsitePageSnapshot {
  const title = matchOne(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const metaDescription =
    matchOne(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i) ||
    matchOne(html, /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["'][^>]*>/i);

  const headings = [
    ...matchAll(html, /<h1[^>]*>([\s\S]*?)<\/h1>/gi).map(stripTags),
    ...matchAll(html, /<h2[^>]*>([\s\S]*?)<\/h2>/gi).map(stripTags),
  ]
    .filter(Boolean)
    .slice(0, 12);

  const text = stripTags(html);
  const words = text ? text.split(/\s+/).filter(Boolean) : [];
  const hasViewportMeta = /<meta[^>]+name=["']viewport["']/i.test(html);
  const hasCanonical = /rel=["']canonical["']/i.test(html);
  const formCount = (html.match(/<form\b/gi) || []).length;
  const linkCount = (html.match(/<a\b/gi) || []).length;
  const images = html.match(/<img\b[^>]*>/gi) || [];
  const imageWithoutAlt = images.filter((img) => !/\salt\s*=/i.test(img)).length;

  return {
    url,
    ok: status >= 200 && status < 400,
    status,
    title,
    metaDescription,
    headings,
    textSample: text.slice(0, 2500),
    wordCount: words.length,
    hasViewportMeta,
    hasCanonical,
    formCount,
    linkCount,
    imageWithoutAlt,
  };
}

function collectContacts(html: string) {
  const emails = new Set<string>();
  const phones = new Set<string>();

  for (const match of html.matchAll(/mailto:([^"'?\s>]+)/gi)) {
    const raw = decodeURIComponent(match[1] || "").split("?")[0].trim().toLowerCase();
    if (raw.includes("@")) emails.add(raw);
  }
  for (const match of html.matchAll(EMAIL_RE)) {
    const raw = (match[1] || "").trim().toLowerCase();
    if (raw.includes("@")) emails.add(raw);
  }
  for (const match of html.matchAll(PHONE_RE)) {
    const digits = (match[0] || "").replace(/\D/g, "");
    if (digits.length >= 8 && digits.length <= 15) phones.add(match[0].trim());
  }

  return {
    emails: [...emails].slice(0, 8),
    phones: [...phones].slice(0, 8),
  };
}

function buildSignals(pages: WebsitePageSnapshot[], https: boolean): string[] {
  const signals: string[] = [];
  if (!https) signals.push("Website URL is not HTTPS.");

  const home = pages[0];
  if (!home) {
    signals.push("Could not fetch any website pages.");
    return signals;
  }

  if (!home.ok) signals.push(`Homepage returned HTTP ${home.status ?? "error"}.`);
  if (!home.title) signals.push("Homepage missing <title>.");
  if (home.title && home.title.length < 5) signals.push("Homepage title looks too short/weak.");
  if (!home.metaDescription) signals.push("Missing meta description (SEO).");
  if (!home.hasViewportMeta) signals.push("Missing viewport meta (likely weak mobile setup).");
  if (!home.hasCanonical) signals.push("No canonical link found.");
  if (home.wordCount < 80) signals.push("Homepage has very little readable content.");
  if (home.formCount === 0) signals.push("No forms detected on homepage (lead capture may be weak).");
  if (home.imageWithoutAlt > 0) signals.push(`${home.imageWithoutAlt} image(s) missing alt text.`);
  if (home.linkCount < 3) signals.push("Very few links on homepage — navigation may be incomplete.");

  for (const page of pages.slice(1)) {
    if (!page.ok) signals.push(`${page.url} returned HTTP ${page.status ?? "error"}.`);
    if (page.ok && page.wordCount < 40) signals.push(`${page.url} has almost no content.`);
  }

  const contactOk = pages.some((p) => /contact/i.test(p.url) && p.ok);
  const aboutOk = pages.some((p) => /about/i.test(p.url) && p.ok);
  if (!contactOk) signals.push("Contact page missing or unreachable.");
  if (!aboutOk) signals.push("About page missing or unreachable.");

  return signals.slice(0, 20);
}

/**
 * Fetch homepage + common pages and build a compact snapshot for AI outreach.
 */
export async function analyzeWebsite(website?: string | null): Promise<WebsiteAnalysisSnapshot | null> {
  const raw = website?.trim();
  if (!raw) return null;

  const startUrl = withProtocol(raw);
  if (!startUrl) return null;

  let origin: string;
  try {
    origin = new URL(startUrl).origin;
  } catch {
    return null;
  }

  const https = origin.startsWith("https://");
  const paths = ["", "/contact", "/about", "/services", "/privacy", "/privacy-policy"];
  const urls = [...new Set(paths.map((p) => (p ? `${origin}${p}` : startUrl.startsWith(origin) ? startUrl : origin)))];

  const pages: WebsitePageSnapshot[] = [];
  const emailsFound = new Set<string>();
  const phonesFound = new Set<string>();

  for (const url of urls.slice(0, 5)) {
    const fetched = await fetchHtml(url);
    if (!fetched) {
      pages.push({
        url,
        ok: false,
        status: null,
        title: null,
        metaDescription: null,
        headings: [],
        textSample: "",
        wordCount: 0,
        hasViewportMeta: false,
        hasCanonical: false,
        formCount: 0,
        linkCount: 0,
        imageWithoutAlt: 0,
      });
      continue;
    }

    if (fetched.html) {
      const contacts = collectContacts(fetched.html);
      contacts.emails.forEach((e) => emailsFound.add(e));
      contacts.phones.forEach((p) => phonesFound.add(p));
      pages.push(parsePage(url, fetched.html, fetched.status));
    } else {
      pages.push({
        url,
        ok: false,
        status: fetched.status,
        title: null,
        metaDescription: null,
        headings: [],
        textSample: "",
        wordCount: 0,
        hasViewportMeta: false,
        hasCanonical: false,
        formCount: 0,
        linkCount: 0,
        imageWithoutAlt: 0,
      });
    }
  }

  return {
    website: raw,
    origin,
    https,
    pages,
    emailsFound: [...emailsFound],
    phonesFound: [...phonesFound],
    rawSignals: buildSignals(pages, https),
    fetchedAt: new Date().toISOString(),
  };
}
