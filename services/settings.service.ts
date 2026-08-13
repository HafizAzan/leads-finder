import { FieldValue } from "firebase-admin/firestore";
import { AppError } from "@/lib/api/errors";
import { collections, db } from "@/lib/firebase/firestore";
import { toIso } from "@/lib/utils/serialize";
import { UserSettings } from "@/types/lead";

const defaults = {
  emailProvider: "gmail" as const,
  emailAddress: "",
  emailConnected: false,
  minDelay: 10,
  maxDelay: 90,
  whatsappConnected: false,
  whatsappDisplayNumber: "",
  whatsappMinDelay: 10,
  whatsappMaxDelay: 90,
};

export type GmailTokenSettings = {
  gmailAccessToken?: string | null;
  gmailRefreshToken?: string | null;
  gmailTokenExpiry?: number | null;
};

export type ServerSettings = UserSettings & GmailTokenSettings;

function mapSettings(id: string, data: Record<string, unknown> | undefined): ServerSettings {
  return {
    id,
    emailProvider: data?.emailProvider === "smtp" ? "smtp" : "gmail",
    emailAddress: typeof data?.emailAddress === "string" ? data.emailAddress : "",
    emailConnected: Boolean(data?.emailConnected),
    minDelay: typeof data?.minDelay === "number" ? data.minDelay : defaults.minDelay,
    maxDelay: typeof data?.maxDelay === "number" ? data.maxDelay : defaults.maxDelay,
    whatsappConnected: Boolean(data?.whatsappConnected),
    whatsappDisplayNumber: typeof data?.whatsappDisplayNumber === "string" ? data.whatsappDisplayNumber : "",
    whatsappMinDelay: typeof data?.whatsappMinDelay === "number" ? data.whatsappMinDelay : defaults.whatsappMinDelay,
    whatsappMaxDelay: typeof data?.whatsappMaxDelay === "number" ? data.whatsappMaxDelay : defaults.whatsappMaxDelay,
    createdAt: toIso(data?.createdAt),
    updatedAt: toIso(data?.updatedAt),
    gmailAccessToken: typeof data?.gmailAccessToken === "string" ? data.gmailAccessToken : null,
    gmailRefreshToken: typeof data?.gmailRefreshToken === "string" ? data.gmailRefreshToken : null,
    gmailTokenExpiry: typeof data?.gmailTokenExpiry === "number" ? data.gmailTokenExpiry : null,
  };
}

export function toPublicSettings(settings: ServerSettings): UserSettings {
  return {
    id: settings.id,
    emailProvider: settings.emailProvider,
    emailAddress: settings.emailAddress,
    emailConnected: settings.emailConnected,
    minDelay: settings.minDelay,
    maxDelay: settings.maxDelay,
    whatsappConnected: settings.whatsappConnected,
    whatsappDisplayNumber: settings.whatsappDisplayNumber,
    whatsappMinDelay: settings.whatsappMinDelay,
    whatsappMaxDelay: settings.whatsappMaxDelay,
    createdAt: settings.createdAt,
    updatedAt: settings.updatedAt,
  };
}

export async function getSettings(userId: string): Promise<ServerSettings> {
  const ref = db().collection(collections.settings).doc(userId);
  const snap = await ref.get();

  if (!snap.exists) {
    await ref.set({
      ...defaults,
      gmailAccessToken: null,
      gmailRefreshToken: null,
      gmailTokenExpiry: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return {
      id: userId,
      ...defaults,
      createdAt: null,
      updatedAt: null,
      gmailAccessToken: null,
      gmailRefreshToken: null,
      gmailTokenExpiry: null,
    };
  }

  return mapSettings(userId, snap.data() as Record<string, unknown>);
}

export type UpdateSettingsInput = {
  emailProvider?: "gmail" | "smtp";
  emailAddress?: string;
  emailConnected?: boolean;
  minDelay?: number;
  maxDelay?: number;
  disconnect?: boolean;
  gmailAccessToken?: string | null;
  gmailRefreshToken?: string | null;
  gmailTokenExpiry?: number | null;
  whatsappDisplayNumber?: string;
  whatsappConnected?: boolean;
  whatsappMinDelay?: number;
  whatsappMaxDelay?: number;
  disconnectWhatsApp?: boolean;
};

export async function syncWhatsAppConnectionToSettings(
  userId: string,
  input: { connected: boolean; displayNumber: string },
) {
  await db()
    .collection(collections.settings)
    .doc(userId)
    .set(
      {
        whatsappConnected: input.connected,
        whatsappDisplayNumber: input.displayNumber,
        // Clear legacy Meta Cloud fields if present
        whatsappAccessToken: null,
        whatsappPhoneNumberId: "",
        whatsappTemplateName: "",
        whatsappTemplateLanguage: "",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
}

export async function updateSettings(userId: string, input: UpdateSettingsInput): Promise<ServerSettings> {
  const current = await getSettings(userId);

  const nextMin = input.minDelay ?? current.minDelay;
  const nextMax = input.maxDelay ?? current.maxDelay;
  const nextWaMin = input.whatsappMinDelay ?? current.whatsappMinDelay;
  const nextWaMax = input.whatsappMaxDelay ?? current.whatsappMaxDelay;

  if (nextMin < 0 || nextWaMin < 0) {
    throw new AppError("INVALID_INPUT", "Minimum delay cannot be negative.");
  }
  if (nextMax < nextMin) {
    throw new AppError("INVALID_INPUT", "Maximum delay cannot be smaller than minimum.");
  }
  if (nextWaMax < nextWaMin) {
    throw new AppError("INVALID_INPUT", "WhatsApp maximum delay cannot be smaller than minimum.");
  }

  if (input.disconnect) {
    await db()
      .collection(collections.settings)
      .doc(userId)
      .set(
        {
          emailConnected: false,
          emailAddress: "",
          gmailAccessToken: null,
          gmailRefreshToken: null,
          gmailTokenExpiry: null,
          minDelay: nextMin,
          maxDelay: nextMax,
          whatsappMinDelay: nextWaMin,
          whatsappMaxDelay: nextWaMax,
          emailProvider: input.emailProvider ?? current.emailProvider,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    return getSettings(userId);
  }

  if (input.disconnectWhatsApp) {
    await syncWhatsAppConnectionToSettings(userId, { connected: false, displayNumber: "" });
    await db()
      .collection(collections.settings)
      .doc(userId)
      .set(
        {
          whatsappMinDelay: nextWaMin,
          whatsappMaxDelay: nextWaMax,
          minDelay: nextMin,
          maxDelay: nextMax,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    return getSettings(userId);
  }

  const payload: Record<string, unknown> = {
    emailProvider: input.emailProvider ?? current.emailProvider,
    emailAddress: input.emailAddress ?? current.emailAddress,
    emailConnected: input.emailConnected ?? current.emailConnected,
    minDelay: nextMin,
    maxDelay: nextMax,
    whatsappMinDelay: nextWaMin,
    whatsappMaxDelay: nextWaMax,
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (input.gmailAccessToken !== undefined) payload.gmailAccessToken = input.gmailAccessToken;
  if (input.gmailRefreshToken !== undefined) payload.gmailRefreshToken = input.gmailRefreshToken;
  if (input.gmailTokenExpiry !== undefined) payload.gmailTokenExpiry = input.gmailTokenExpiry;
  if (input.whatsappConnected !== undefined) payload.whatsappConnected = input.whatsappConnected;
  if (input.whatsappDisplayNumber !== undefined) payload.whatsappDisplayNumber = input.whatsappDisplayNumber;

  await db().collection(collections.settings).doc(userId).set(payload, { merge: true });
  return getSettings(userId);
}

export async function saveGmailConnection(
  userId: string,
  input: {
    email: string;
    accessToken: string;
    refreshToken?: string;
    expiresIn: number;
  },
) {
  const current = await getSettings(userId);

  return updateSettings(userId, {
    emailProvider: "gmail",
    emailAddress: input.email,
    emailConnected: true,
    gmailAccessToken: input.accessToken,
    gmailRefreshToken: input.refreshToken || current.gmailRefreshToken || null,
    gmailTokenExpiry: Date.now() + input.expiresIn * 1000,
  });
}
