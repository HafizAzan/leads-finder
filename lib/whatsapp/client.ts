import { rm } from "fs/promises";
import path from "path";
import QRCode from "qrcode";
import type { Client, Message } from "whatsapp-web.js";
import { getChromeLaunchConfig, getChromeNotFoundMessage } from "@/lib/whatsapp/browser";
import { getWhatsAppAuthPath } from "@/lib/whatsapp/data-dir";
import { ackToSendStatus } from "@/lib/whatsapp/message-ack";
import type { WhatsAppConnectionState } from "@/lib/whatsapp/types";

export type { WhatsAppConnectionState, WhatsAppStatus } from "@/lib/whatsapp/types";

export type PendingOutreachSend = {
  userId: string;
  leadId: string;
  queueId: string;
};

const CLIENT_ID = "leads-finder";
const AUTH_PATH = getWhatsAppAuthPath();

const defaultState = (): WhatsAppConnectionState => ({
  status: "disconnected",
  qrCodeDataUrl: null,
  phoneNumber: null,
  pushName: null,
  syncPercent: null,
  error: null,
});

type AckHandler = (payload: {
  userId: string;
  leadId: string;
  queueId: string;
  sendStatus: "sent" | "delivered" | "read" | "failed";
}) => void | Promise<void>;

class WhatsAppManager {
  private client: Client | null = null;
  private state: WhatsAppConnectionState = defaultState();
  private initializing = false;
  private linkClientId: string | null = null;
  private authReadyTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingByMessageId = new Map<string, PendingOutreachSend>();
  private ackByMessageId = new Map<string, number>();
  private onAck: AckHandler | null = null;

  setAckHandler(handler: AckHandler | null) {
    this.onAck = handler;
  }

  getState(): WhatsAppConnectionState {
    return { ...this.state };
  }

  isReady() {
    return this.state.status === "ready" && Boolean(this.client);
  }

  registerPendingSend(messageId: string, pending: PendingOutreachSend) {
    this.pendingByMessageId.set(messageId, pending);
  }

  async connect(options?: { restore?: boolean; forceNewQr?: boolean }): Promise<WhatsAppConnectionState> {
    if (this.client && this.state.status === "ready" && !options?.forceNewQr) {
      return this.getState();
    }

    if (this.client || this.initializing) {
      await this.abortConnection();
    }

    if (options?.forceNewQr) {
      await this.clearSessionDir(CLIENT_ID).catch(() => undefined);
    }

    return this.startClient(CLIENT_ID);
  }

  private async startClient(linkClientId: string): Promise<WhatsAppConnectionState> {
    this.linkClientId = linkClientId;
    this.initializing = true;
    this.state = {
      ...defaultState(),
      status: "initializing",
    };

    try {
      const { Client, LocalAuth } = await import("whatsapp-web.js");
      const chrome = await getChromeLaunchConfig();
      if (!chrome) {
        throw new Error(getChromeNotFoundMessage());
      }

      const client = new Client({
        authStrategy: new LocalAuth({
          dataPath: AUTH_PATH,
          clientId: linkClientId,
        }),
        puppeteer: {
          headless: chrome.headless ?? true,
          executablePath: chrome.executablePath,
          args: chrome.args,
        },
      });

      this.client = client;
      this.attachListeners(client);

      void client.initialize().catch((err) => {
        this.state = {
          ...defaultState(),
          status: "error",
          error: err instanceof Error ? err.message : "Failed to initialize WhatsApp",
        };
        this.client = null;
        this.initializing = false;
        this.linkClientId = null;
      });

      return this.getState();
    } catch (err) {
      this.state = {
        ...defaultState(),
        status: "error",
        error: err instanceof Error ? err.message : "Failed to initialize WhatsApp",
      };
      this.client = null;
      this.initializing = false;
      this.linkClientId = null;
      return this.getState();
    }
  }

  private async abortConnection() {
    this.initializing = false;
    this.clearAuthReadyWatchdog();
    if (!this.client) return;
    try {
      await this.client.destroy();
    } catch {
      // ignore
    }
    this.client = null;
  }

  async disconnect(options?: { removeSession?: boolean }): Promise<WhatsAppConnectionState> {
    this.clearAuthReadyWatchdog();
    this.initializing = false;
    const removeSession = options?.removeSession ?? false;
    const wasReady = this.state.status === "ready";
    const previousClientId = this.linkClientId;
    const client = this.client;

    this.client = null;
    this.linkClientId = null;

    if (client) {
      try {
        if (removeSession && wasReady) {
          await Promise.race([
            client.logout(),
            new Promise<void>((_, reject) => setTimeout(() => reject(new Error("logout timeout")), 20_000)),
          ]);
        } else {
          await Promise.race([
            client.destroy(),
            new Promise<void>((_, reject) => setTimeout(() => reject(new Error("destroy timeout")), 20_000)),
          ]);
        }
      } catch (err) {
        console.warn("[whatsapp] disconnect cleanup:", err);
        try {
          await client.destroy();
        } catch {
          // ignore
        }
      }
    }

    if (removeSession) {
      await this.clearSessionDir(previousClientId || CLIENT_ID).catch(() => undefined);
      await this.clearSessionDir(CLIENT_ID).catch(() => undefined);
    }

    this.state = defaultState();
    return this.getState();
  }

  async sendMessage(
    to: string,
    message: string,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.client || this.state.status !== "ready") {
      return { success: false, error: "WhatsApp is not connected. Scan QR in Settings." };
    }

    const { sendWhatsAppText } = await import("@/lib/whatsapp/send");
    return sendWhatsAppText(this.client, to, message);
  }

  private async clearSessionDir(clientId: string) {
    const dir = path.join(AUTH_PATH, `session-${clientId}`);
    await rm(dir, { recursive: true, force: true });
  }

  private startAuthReadyWatchdog() {
    this.clearAuthReadyWatchdog();
    this.authReadyTimer = setTimeout(() => {
      if (this.state.status === "authenticated" || this.state.status === "initializing") {
        this.state = {
          ...this.state,
          error: "WhatsApp sync timed out. Disconnect and scan QR again.",
        };
      }
    }, 120_000);
  }

  private clearAuthReadyWatchdog() {
    if (this.authReadyTimer) {
      clearTimeout(this.authReadyTimer);
      this.authReadyTimer = null;
    }
  }

  private attachListeners(client: Client) {
    client.on("qr", async (qr: string) => {
      const qrCodeDataUrl = await QRCode.toDataURL(qr, { margin: 2, width: 280 });
      this.state = {
        ...this.state,
        status: "qr",
        qrCodeDataUrl,
        error: null,
      };
    });

    client.on("authenticated", () => {
      this.startAuthReadyWatchdog();
      this.state = {
        ...this.state,
        status: "authenticated",
        qrCodeDataUrl: null,
        syncPercent: null,
        error: null,
      };
    });

    client.on("loading_screen", (percent: number) => {
      if (typeof percent === "number") {
        this.state = {
          ...this.state,
          status: "authenticated",
          syncPercent: percent,
        };
      }
    });

    client.on("ready", () => {
      this.clearAuthReadyWatchdog();
      this.initializing = false;
      const info = client.info;
      this.state = {
        status: "ready",
        qrCodeDataUrl: null,
        phoneNumber: info?.wid?.user ?? null,
        pushName: info?.pushname ?? null,
        syncPercent: null,
        error: null,
      };
    });

    client.on("auth_failure", (message: string) => {
      this.initializing = false;
      this.state = {
        ...defaultState(),
        status: "error",
        error: message || "Authentication failed",
      };
    });

    client.on("disconnected", (reason: string) => {
      this.initializing = false;
      this.state = {
        ...defaultState(),
        status: "disconnected",
        error: reason || null,
      };
      this.client = null;
    });

    client.on("message_ack", (msg: Message, ack: number) => {
      const id = msg.id?._serialized;
      if (!id) return;

      this.ackByMessageId.set(id, ack);
      const sendStatus = ackToSendStatus(ack);
      const pending = this.pendingByMessageId.get(id);
      if (!pending || !sendStatus || !this.onAck) return;

      if (sendStatus === "read" || sendStatus === "failed") {
        this.pendingByMessageId.delete(id);
      }

      void Promise.resolve(
        this.onAck({
          userId: pending.userId,
          leadId: pending.leadId,
          queueId: pending.queueId,
          sendStatus,
        }),
      ).catch((err) => console.error("[whatsapp] ack handler failed:", err));
    });
  }
}

type GlobalWithWa = typeof globalThis & {
  __leadsFinderWhatsAppManager?: WhatsAppManager;
};

const waGlobal = globalThis as GlobalWithWa;

export function getWhatsAppManager(): WhatsAppManager {
  if (!waGlobal.__leadsFinderWhatsAppManager) {
    waGlobal.__leadsFinderWhatsAppManager = new WhatsAppManager();
  }

  const mgr = waGlobal.__leadsFinderWhatsAppManager;
  // Re-bind so HMR picks up latest method bodies
  mgr.getState = WhatsAppManager.prototype.getState.bind(mgr);
  mgr.isReady = WhatsAppManager.prototype.isReady.bind(mgr);
  mgr.connect = WhatsAppManager.prototype.connect.bind(mgr);
  mgr.disconnect = WhatsAppManager.prototype.disconnect.bind(mgr);
  mgr.sendMessage = WhatsAppManager.prototype.sendMessage.bind(mgr);
  mgr.registerPendingSend = WhatsAppManager.prototype.registerPendingSend.bind(mgr);
  mgr.setAckHandler = WhatsAppManager.prototype.setAckHandler.bind(mgr);
  return mgr;
}
