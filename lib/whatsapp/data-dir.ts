import path from "path";

export function getDataDir() {
  return path.join(process.cwd(), "data");
}

export function getWhatsAppAuthPath() {
  return path.join(getDataDir(), ".wwebjs_auth");
}

export function getPuppeteerCacheDir() {
  return path.join(getDataDir(), ".puppeteer");
}
