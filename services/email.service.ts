import { FieldValue } from "firebase-admin/firestore";
import { AppError } from "@/lib/api/errors";
import { refreshAccessToken, sendGmailMessage } from "@/lib/gmail/oauth";
import { collections, db } from "@/lib/firebase/firestore";
import { getRandomDelay } from "@/lib/utils/delay";
import { toIso } from "@/lib/utils/serialize";
import { EmailQueueItem } from "@/types/lead";
import { getLeadForUser, patchLeadFields } from "./leads.service";
import { getSettings, updateSettings } from "./settings.service";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function mapQueueItem(id: string, data: Record<string, unknown>): EmailQueueItem {
  return {
    id,
    userId: String(data.userId || ""),
    leadId: String(data.leadId || ""),
    businessName: data.businessName ? String(data.businessName) : undefined,
    email: String(data.email || ""),
    subject: String(data.subject || ""),
    body: String(data.body || ""),
    status: (data.status as EmailQueueItem["status"]) || "queued",
    scheduledAt: toIso(data.scheduledAt),
    sentAt: toIso(data.sentAt),
    delaySeconds: typeof data.delaySeconds === "number" ? data.delaySeconds : 0,
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  };
}

export async function listQueue(userId: string): Promise<EmailQueueItem[]> {
  const snap = await db().collection(collections.emailQueue).where("userId", "==", userId).get();
  return snap.docs
    .map((doc) => mapQueueItem(doc.id, doc.data() as Record<string, unknown>))
    .sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
}

async function getValidGmailAccessToken(userId: string) {
  const settings = await getSettings(userId);

  if (!settings.emailConnected) {
    throw new AppError("EMAIL_NOT_CONNECTED", "Connect Gmail in Settings before sending emails.", 400);
  }

  if (!settings.gmailAccessToken && !settings.gmailRefreshToken) {
    throw new AppError("EMAIL_PROVIDER_NOT_CONFIGURED", "Gmail is not connected. Please connect Gmail again.", 400);
  }

  const expiresSoon = !settings.gmailTokenExpiry || settings.gmailTokenExpiry <= Date.now() + 60_000;

  if (!expiresSoon && settings.gmailAccessToken) {
    return settings.gmailAccessToken;
  }

  if (!settings.gmailRefreshToken) {
    throw new AppError("EMAIL_PROVIDER_NOT_CONFIGURED", "Gmail session expired. Please connect Gmail again.", 400);
  }

  const refreshed = await refreshAccessToken(settings.gmailRefreshToken);
  await updateSettings(userId, {
    gmailAccessToken: refreshed.accessToken,
    gmailTokenExpiry: Date.now() + refreshed.expiresIn * 1000,
    emailConnected: true,
  });

  return refreshed.accessToken;
}

export async function queueEmails(userId: string, leadIds: string[]) {
  const settings = await getSettings(userId);

  if (!settings.emailConnected) {
    throw new AppError("EMAIL_NOT_CONNECTED", "Connect Gmail in Settings before sending emails.", 400);
  }

  const results = [];
  const queuedItems: EmailQueueItem[] = [];
  let cumulativeDelay = 0;

  for (let index = 0; index < leadIds.length; index += 1) {
    const leadId = leadIds[index];
    try {
      const lead = await getLeadForUser(userId, leadId);

      if (!lead.email) {
        throw new AppError("MISSING_EMAIL", "Lead does not have an email address.");
      }
      if (lead.aiReview.status !== "approved") {
        throw new AppError("AI_REVIEW_REQUIRED", "Lead AI review must be approved.");
      }
      if (lead.outreach.approval !== "approved") {
        throw new AppError("MANUAL_APPROVAL_REQUIRED", "Lead must be manually approved.");
      }
      if (!lead.outreach.subject || !lead.outreach.body) {
        throw new AppError("EMAIL_REQUIRED", "Lead must have subject and body.");
      }

      // First message (or single lead) sends immediately; delay only spaces subsequent sends.
      const delaySeconds = index === 0 ? 0 : getRandomDelay(settings.minDelay, settings.maxDelay);
      cumulativeDelay += delaySeconds;
      const scheduledAt = new Date(Date.now() + cumulativeDelay * 1000);
      const ref = db().collection(collections.emailQueue).doc();

      await ref.set({
        userId,
        leadId,
        businessName: lead.businessName,
        email: lead.email,
        subject: lead.outreach.subject,
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
        email: lead.email,
        subject: lead.outreach.subject,
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
        error: error instanceof Error ? error.message : "Failed to queue email.",
      });
    }
  }

  return {
    emailConnected: settings.emailConnected,
    providerConfigured: true,
    message: `Queued ${queuedItems.length} email(s). Sending will respect your Settings delay (${settings.minDelay}-${settings.maxDelay}s).`,
    results,
    items: queuedItems,
    queueIds: queuedItems.map((item) => item.id),
  };
}

async function markQueueStatus(queueId: string, status: EmailQueueItem["status"], extra: Record<string, unknown> = {}) {
  await db()
    .collection(collections.emailQueue)
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

export async function processQueuedEmails(userId: string, queueIds: string[]) {
  for (const queueId of queueIds) {
    const snap = await db().collection(collections.emailQueue).doc(queueId).get();
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

      // Wait the configured per-email delay before sending
      await sleep(Math.max(0, item.delaySeconds) * 1000);

      const accessToken = await getValidGmailAccessToken(userId);
      await sendGmailMessage(accessToken, {
        to: item.email,
        subject: item.subject,
        body: item.body,
      });

      await markQueueStatus(queueId, "sent", { sentAt: FieldValue.serverTimestamp() });

      const lead = await getLeadForUser(userId, item.leadId);
      await patchLeadFields(userId, item.leadId, {
        outreach: {
          ...lead.outreach,
          status: "sent",
          sendStatus: "sent",
          sentAt: FieldValue.serverTimestamp(),
        },
      });
    } catch (error) {
      console.error("[email-queue-send]", queueId, error);
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
