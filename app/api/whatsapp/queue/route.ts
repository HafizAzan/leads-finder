import { after } from "next/server";
import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { handleApiError, ok } from "@/lib/api/response";
import { leadIdsSchema } from "@/lib/validation/lead.schema";
import { listWhatsAppQueue, processQueuedWhatsApp, queueWhatsAppMessages } from "@/services/whatsapp.service";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    const items = await listWhatsAppQueue(user.id);
    return ok(items);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    const body = await req.json();
    const { leadIds } = leadIdsSchema.parse(body);
    const result = await queueWhatsAppMessages(user.id, leadIds);

    if (result.queueIds.length > 0) {
      after(async () => {
        await processQueuedWhatsApp(user.id, result.queueIds);
      });
    }

    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}
