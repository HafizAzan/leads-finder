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

type UpdateSettingsInput = {
  emailProvider?: "gmail" | "smtp";
  emailAddress?: string;
  emailConnected?: boolean;
  minDelay?: number;
  maxDelay?: number;
  disconnect?: boolean;
  gmailAccessToken?: string | null;
  gmailRefreshToken?: string | null;
  gmailTokenExpiry?: number | null;
};

export async function updateSettings(userId: string, input: UpdateSettingsInput): Promise<ServerSettings> {
  const current = await getSettings(userId);

  const nextMin = input.minDelay ?? current.minDelay;
  const nextMax = input.maxDelay ?? current.maxDelay;

  if (nextMin < 0) {
    throw new AppError("INVALID_INPUT", "Minimum delay cannot be negative.");
  }
  if (nextMax < nextMin) {
    throw new AppError("INVALID_INPUT", "Maximum delay cannot be smaller than minimum.");
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
          emailProvider: input.emailProvider ?? current.emailProvider,
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
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (input.gmailAccessToken !== undefined) payload.gmailAccessToken = input.gmailAccessToken;
  if (input.gmailRefreshToken !== undefined) payload.gmailRefreshToken = input.gmailRefreshToken;
  if (input.gmailTokenExpiry !== undefined) payload.gmailTokenExpiry = input.gmailTokenExpiry;

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
