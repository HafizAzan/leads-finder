import type { Client, Message } from "whatsapp-web.js";

type WidLike = {
  _serialized?: string;
  user?: string;
  server?: string;
};

function widToId(wid: unknown): string | null {
  if (!wid) return null;
  if (typeof wid === "string") return wid;
  const obj = wid as WidLike;
  if (obj._serialized) return obj._serialized;
  if (obj.user && obj.server) return `${obj.user}@${obj.server}`;
  return null;
}

function phoneToPnId(to: string): string | null {
  if (to.includes("@lid") || to.includes("@g.us") || to.includes("@newsletter")) {
    return to;
  }
  if (to.includes("@c.us") || to.includes("@s.whatsapp.net")) {
    return to.replace("@s.whatsapp.net", "@c.us");
  }
  const digits = to.replace(/\D/g, "");
  if (!digits) return null;
  return `${digits}@c.us`;
}

async function lookupLidPair(client: Client, pnId: string): Promise<{ lid?: string; pn?: string }> {
  try {
    const results = await client.getContactLidAndPhone([pnId]);
    const first = results?.[0];
    return {
      lid: first?.lid || undefined,
      pn: first?.pn || undefined,
    };
  } catch (err) {
    console.warn("[whatsapp] getContactLidAndPhone failed:", err);
    return {};
  }
}

async function ensureChatReady(client: Client, chatId: string) {
  const page = (client as Client & { pupPage?: { evaluate: Function } }).pupPage;
  if (!page?.evaluate) return;

  try {
    await page.evaluate(async (id: string) => {
      const w = window as unknown as {
        WWebJS?: { enforceLidAndPnRetrieval?: (userId: string) => Promise<unknown> };
        require: (name: string) => {
          createWid?: (id: string) => unknown;
          findOrCreateLatestChat?: (wid: unknown) => Promise<unknown>;
        };
      };

      try {
        if (typeof w.WWebJS?.enforceLidAndPnRetrieval === "function") {
          await w.WWebJS.enforceLidAndPnRetrieval(id);
        }
      } catch {
        // ignore
      }

      try {
        const widFactory = w.require("WAWebWidFactory");
        const findChat = w.require("WAWebFindChatAction");
        const wid = widFactory.createWid?.(id);
        await findChat.findOrCreateLatestChat?.(wid);
      } catch {
        // ignore — sendMessage will surface the real error
      }
    }, chatId);
  } catch (err) {
    console.warn("[whatsapp] ensureChatReady failed:", err);
  }
}

/**
 * Resolve a WhatsApp chat id that works with current LID migration.
 * Tries LID first, then phone WID.
 */
export async function resolveWhatsAppChatIds(client: Client, to: string): Promise<string[]> {
  const pnId = phoneToPnId(to);
  if (!pnId) return [];

  if (pnId.includes("@lid") || pnId.includes("@g.us")) {
    return [pnId];
  }

  const digits = pnId.replace(/@c\.us$/i, "").replace(/\D/g, "");
  const candidates: string[] = [];

  const pair = await lookupLidPair(client, pnId);
  if (pair.lid) candidates.push(pair.lid);
  if (pair.pn) candidates.push(pair.pn);

  try {
    const numberId = await client.getNumberId(digits);
    const serialized = widToId(numberId);
    if (!serialized) {
      // Number not registered on WhatsApp
      return [];
    }
    if (serialized.includes("@lid")) {
      candidates.unshift(serialized);
    } else {
      candidates.push(serialized);
    }
  } catch (err) {
    console.warn("[whatsapp] getNumberId failed:", err);
  }

  candidates.push(pnId);

  return [...new Set(candidates.filter(Boolean))];
}

export async function sendWhatsAppText(
  client: Client,
  to: string,
  message: string,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const chatIds = await resolveWhatsAppChatIds(client, to);
  if (chatIds.length === 0) {
    return {
      success: false,
      error: `Number is not on WhatsApp or could not be resolved: ${to}`,
    };
  }

  let lastError = "Failed to send WhatsApp message";

  for (const chatId of chatIds) {
    try {
      await ensureChatReady(client, chatId);
      const sent = (await client.sendMessage(chatId, message, { sendSeen: false })) as Message;
      return { success: true, messageId: sent?.id?._serialized || undefined };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.warn(`[whatsapp] send failed for ${chatId}:`, lastError);
      // Try next candidate on LID / chat resolution failures
      if (!/no lid for user|lid is missing|chat not found|not registered/i.test(lastError)) {
        break;
      }
    }
  }

  return { success: false, error: lastError };
}
