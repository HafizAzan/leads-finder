import { FieldValue } from "firebase-admin/firestore";
import { AppError } from "@/lib/api/errors";
import { collections, db } from "@/lib/firebase/firestore";
import { getWhatsAppManager } from "@/lib/whatsapp/client";
import { getRandomDelay } from "@/lib/utils/delay";
import { toIso } from "@/lib/utils/serialize";
import { normalizePhoneForWhatsApp } from "@/lib/whatsapp/phone";
import { SendStatus, WhatsAppQueueItem } from "@/types/lead";
import { getLeadForUser, patchLeadFields } from "./leads.service";
import { getSettings, syncWhatsAppConnectionToSettings } from "./settings.service";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let ackHandlerBound = false;

function ensureAckHandler() {
  if (ackHandlerBound) return;
  ackHandlerBound = true;

  getWhatsAppManager().setAckHandler(async ({ userId, leadId, queueId, sendStatus }) => {
    await applyWhatsAppAckUpdate({ userId, leadId, queueId, sendStatus });
  });
}

export function ensureWhatsAppAckHandler() {
  ensureAckHandler();
}

export async function applyWhatsAppAckUpdate(input: {
  userId: string;
  leadId: string;
  queueId: string;
  sendStatus: Extract<SendStatus, "sent" | "delivered" | "read" | "failed">;
}) {
  const { userId, leadId, queueId, sendStatus } = input;

  if (sendStatus === "failed") {
    await markQueueStatus(queueId, "failed");
  }

  try {
    const lead = await getLeadForUser(userId, leadId);
    const current = lead.outreach.sendStatus;
    const rank: Record<string, number> = {
      not_sent: 0,
      queued: 1,
      sending: 2,
      sent: 3,
      delivered: 4,
      read: 5,
      failed: -1,
      skipped: 0,
    };

    // Don't downgrade (e.g. read → delivered) or clobber failed incorrectly after success path
    if (sendStatus !== "failed" && (rank[current] ?? 0) >= (rank[sendStatus] ?? 0)) {
      return;
    }

    await patchLeadFields(userId, leadId, {
      outreach: {
        ...lead.outreach,
        status: sendStatus === "failed" ? "failed" : sendStatus,
        sendStatus,
        ...(sendStatus === "failed" ? {} : {}),
      },
    });
  } catch (err) {
    console.error("[whatsapp-ack]", queueId, err);
  }
}

function mapQueueItem(id: string, data: Record<string, unknown>): WhatsAppQueueItem {
  return {
    id,
    userId: String(data.userId || ""),
    leadId: String(data.leadId || ""),
    businessName: data.businessName ? String(data.businessName) : undefined,
    phone: String(data.phone || ""),
    body: String(data.body || ""),
    status: (data.status as WhatsAppQueueItem["status"]) || "queued",
    scheduledAt: toIso(data.scheduledAt),
    sentAt: toIso(data.sentAt),
    delaySeconds: typeof data.delaySeconds === "number" ? data.delaySeconds : 0,
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  };
}

export async function listWhatsAppQueue(userId: string): Promise<WhatsAppQueueItem[]> {
  const snap = await db().collection(collections.whatsappQueue).where("userId", "==", userId).get();
  return snap.docs
    .map((doc) => mapQueueItem(doc.id, doc.data() as Record<string, unknown>))
    .sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
}

function assertWhatsAppReady(userId: string) {
  ensureAckHandler();
  const mgr = getWhatsAppManager();
  if (!mgr.isReady()) {
    throw new AppError(
      "WHATSAPP_NOT_CONNECTED",
      "Connect WhatsApp via QR in Settings before sending.",
      400,
    );
  }

  const state = mgr.getState();
  if (state.phoneNumber) {
    void syncWhatsAppConnectionToSettings(userId, {
      connected: true,
      displayNumber: state.phoneNumber,
    });
  }
}

export async function queueWhatsAppMessages(userId: string, leadIds: string[]) {
  const settings = await getSettings(userId);
  assertWhatsAppReady(userId);

  const results = [];
  const queuedItems: WhatsAppQueueItem[] = [];
  let cumulativeDelay = 0;

  for (let index = 0; index < leadIds.length; index += 1) {
    const leadId = leadIds[index];
    try {
      const lead = await getLeadForUser(userId, leadId);

      if (!lead.phone) {
        throw new AppError("MISSING_PHONE", "Lead does not have a phone number.");
      }

      const normalizedPhone = normalizePhoneForWhatsApp(lead.phone);
      if (!normalizedPhone) {
        throw new AppError("INVALID_PHONE", `Lead phone number is invalid for WhatsApp: ${lead.phone}`);
      }

      if (lead.aiReview.status !== "approved") {
        throw new AppError("AI_REVIEW_REQUIRED", "Lead AI review must be approved.");
      }
      if (lead.outreach.approval !== "approved") {
        throw new AppError("MANUAL_APPROVAL_REQUIRED", "Lead must be manually approved.");
      }
      if (!lead.outreach.body) {
        throw new AppError("MESSAGE_REQUIRED", "Lead must have a generated WhatsApp message body.");
      }
      if (lead.outreach.channel !== "whatsapp") {
        throw new AppError("WRONG_CHANNEL", "Lead outreach channel is email. Use email send instead.");
      }

      // First message (or single lead) sends immediately; delay only spaces subsequent sends.
      const delaySeconds =
        index === 0 ? 0 : getRandomDelay(settings.whatsappMinDelay, settings.whatsappMaxDelay);
      cumulativeDelay += delaySeconds;
      const scheduledAt = new Date(Date.now() + cumulativeDelay * 1000);
      const ref = db().collection(collections.whatsappQueue).doc();

      await ref.set({
        userId,
        leadId,
        businessName: lead.businessName,
        phone: normalizedPhone,
        body: lead.outreach.body,
        status: "queued",
        delaySeconds,
        scheduledAt,
        sentAt: null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      await patchLeadFields(userId, leadId, {
        outreach: {
          ...lead.outreach,
          status: "queued",
          sendStatus: "queued",
        },
      });

      const item = mapQueueItem(ref.id, {
        userId,
        leadId,
        businessName: lead.businessName,
        phone: normalizedPhone,
        body: lead.outreach.body,
        status: "queued",
        delaySeconds,
        scheduledAt,
      });

      queuedItems.push(item);
      results.push({ leadId, success: true, queueId: ref.id, delaySeconds });
    } catch (error) {
      results.push({
        leadId,
        success: false,
        error: error instanceof Error ? error.message : "Failed to queue WhatsApp message.",
      });
    }
  }

  return {
    whatsappConnected: true,
    message: `Queued ${queuedItems.length} WhatsApp message(s). Sending will respect your WhatsApp delay (${settings.whatsappMinDelay}-${settings.whatsappMaxDelay}s).`,
    results,
    items: queuedItems,
    queueIds: queuedItems.map((item) => item.id),
  };
}

async function markQueueStatus(queueId: string, status: WhatsAppQueueItem["status"], extra: Record<string, unknown> = {}) {
  await db()
    .collection(collections.whatsappQueue)
    .doc(queueId)
    .set(
      {
        status,
        ...extra,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
}

export async function processQueuedWhatsApp(userId: string, queueIds: string[]) {
  assertWhatsAppReady(userId);
  const mgr = getWhatsAppManager();

  for (const queueId of queueIds) {
    const snap = await db().collection(collections.whatsappQueue).doc(queueId).get();
    if (!snap.exists) continue;

    const item = mapQueueItem(snap.id, snap.data() as Record<string, unknown>);
    if (item.userId !== userId || item.status === "sent") continue;

    try {
      const leadBeforeSend = await getLeadForUser(userId, item.leadId);
      await markQueueStatus(queueId, "sending");
      await patchLeadFields(userId, item.leadId, {
        outreach: {
          ...leadBeforeSend.outreach,
          status: "sending",
          sendStatus: "sending",
        },
      });

      await sleep(Math.max(0, item.delaySeconds) * 1000);

      if (!mgr.isReady()) {
        throw new AppError("WHATSAPP_NOT_CONNECTED", "WhatsApp session disconnected during send.", 400);
      }

      const result = await mgr.sendMessage(item.phone, item.body);
      if (!result.success) {
        throw new AppError("WHATSAPP_SEND_FAILED", result.error || "WhatsApp send failed.", 502);
      }

      if (result.messageId) {
        mgr.registerPendingSend(result.messageId, {
          userId,
          leadId: item.leadId,
          queueId,
        });
        await markQueueStatus(queueId, "sent", {
          sentAt: FieldValue.serverTimestamp(),
          whatsappMessageId: result.messageId,
        });
      } else {
        await markQueueStatus(queueId, "sent", { sentAt: FieldValue.serverTimestamp() });
      }

      const lead = await getLeadForUser(userId, item.leadId);
      await patchLeadFields(userId, item.leadId, {
        outreach: {
          ...lead.outreach,
          status: "sent",
          sendStatus: "sent",
          sentAt: FieldValue.serverTimestamp(),
          ...(result.messageId ? { whatsappMessageId: result.messageId } : {}),
        },
      });
    } catch (error) {
      console.error("[whatsapp-queue-send]", queueId, error);
      await markQueueStatus(queueId, "failed");

      try {
        const lead = await getLeadForUser(userId, item.leadId);
        await patchLeadFields(userId, item.leadId, {
          outreach: {
            ...lead.outreach,
            status: "failed",
            sendStatus: "failed",
          },
        });
      } catch {
        // ignore secondary update errors
      }
    }
  }
}
