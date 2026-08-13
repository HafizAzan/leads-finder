import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { handleApiError, ok } from "@/lib/api/response";
import { getWhatsAppManager } from "@/lib/whatsapp/client";
import { syncWhatsAppConnectionToSettings } from "@/services/settings.service";
import { ensureWhatsAppAckHandler } from "@/services/whatsapp.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    ensureWhatsAppAckHandler();
    const body = await req.json().catch(() => ({}));
    const forceNewQr = Boolean(body?.forceNewQr);
    const restore = body?.restore !== false && !forceNewQr;

    const state = await getWhatsAppManager().connect({
      restore,
      forceNewQr,
    });

    if (state.status === "ready" && state.phoneNumber) {
      await syncWhatsAppConnectionToSettings(user.id, {
        connected: true,
        displayNumber: state.phoneNumber,
      });
    }

    return ok(state);
  } catch (error) {
    return handleApiError(error);
  }
}
