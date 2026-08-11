import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { handleApiError, ok } from "@/lib/api/response";
import { settingsUpdateSchema } from "@/lib/validation/settings.schema";
import { getSettings, toPublicSettings, updateSettings } from "@/services/settings.service";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    const settings = await getSettings(user.id);
    return ok(toPublicSettings(settings));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    const body = await req.json();
    const input = settingsUpdateSchema.parse(body);
    const settings = await updateSettings(user.id, input);
    return ok(toPublicSettings(settings));
  } catch (error) {
    return handleApiError(error);
  }
}
