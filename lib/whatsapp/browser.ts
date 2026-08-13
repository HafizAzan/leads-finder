import { existsSync } from "fs";
import path from "path";
import { getPuppeteerCacheDir } from "@/lib/whatsapp/data-dir";

process.env.PUPPETEER_CACHE_DIR = getPuppeteerCacheDir();
process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD = "true";
process.env.PUPPETEER_SKIP_DOWNLOAD = "true";

const WINDOWS_CHROME_PATHS = [
  path.join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe"),
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
];

const LINUX_CHROME_PATHS = [
  "/usr/bin/google-chrome-stable",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
];

export type ChromeLaunchConfig = {
  executablePath: string;
  args: string[];
  headless?: boolean | "shell";
};

export async function getChromeLaunchConfig(): Promise<ChromeLaunchConfig | null> {
  const localChrome = process.env.CHROMIUM_LOCAL_EXEC_PATH;
  if (localChrome && existsSync(localChrome)) {
    return {
      executablePath: localChrome,
      args: defaultChromeArgs(),
      headless: true,
    };
  }

  const bundled = await tryBundledChromePath();
  if (bundled) {
    return {
      executablePath: bundled,
      args: defaultChromeArgs(),
      headless: true,
    };
  }

  for (const chromePath of [...WINDOWS_CHROME_PATHS, ...LINUX_CHROME_PATHS]) {
    if (chromePath && existsSync(chromePath)) {
      return {
        executablePath: chromePath,
        args: defaultChromeArgs(),
        headless: true,
      };
    }
  }

  return null;
}

export function getChromeNotFoundMessage() {
  return "Chrome/Chromium not found. Install Google Chrome, or set CHROMIUM_LOCAL_EXEC_PATH to chrome.exe.";
}

async function tryBundledChromePath(): Promise<string | undefined> {
  try {
    const puppeteer = await import("puppeteer");
    const bundled = await puppeteer.default.executablePath();
    if (bundled && existsSync(bundled)) return bundled;
  } catch {
    // fall through
  }

  try {
    const puppeteer = await import("puppeteer-core");
    const bundled = await puppeteer.default.executablePath();
    if (bundled && existsSync(bundled)) return bundled;
  } catch {
    // fall through
  }

  return undefined;
}

function defaultChromeArgs(): string[] {
  return ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"];
}
