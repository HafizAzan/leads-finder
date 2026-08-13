import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { handleApiError, ok } from "@/lib/api/response";
import { getWhatsAppManager } from "@/lib/whatsapp/client";
import { syncWhatsAppConnectionToSettings } from "@/services/settings.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    const body = await req.json().catch(() => ({}));
    const removeSession = body?.removeSession !== false;

    const state = await getWhatsAppManager().disconnect({ removeSession });
    await syncWhatsAppConnectionToSettings(user.id, {
      connected: false,
      displayNumber: "",
    });

    return ok(state);
  } catch (error) {
    return handleApiError(error);
  }
}
