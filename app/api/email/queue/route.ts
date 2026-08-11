import { after } from "next/server";
import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { handleApiError, ok } from "@/lib/api/response";
import { leadIdsSchema } from "@/lib/validation/lead.schema";
import { listQueue, processQueuedEmails, queueEmails } from "@/services/email.service";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    const items = await listQueue(user.id);
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
    const result = await queueEmails(user.id, leadIds);

    if (result.queueIds.length > 0) {
      after(async () => {
        await processQueuedEmails(user.id, result.queueIds);
      });
    }

    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}
