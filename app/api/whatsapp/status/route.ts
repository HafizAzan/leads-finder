import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { handleApiError, ok } from "@/lib/api/response";
import { getWhatsAppManager } from "@/lib/whatsapp/client";
import { syncWhatsAppConnectionToSettings } from "@/services/settings.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    const state = getWhatsAppManager().getState();

    // Only push "connected" into settings when session is live; disconnect clears via disconnect API.
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
