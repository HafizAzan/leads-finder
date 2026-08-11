import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { handleApiError, ok } from "@/lib/api/response";
import { generateLeadsSchema } from "@/lib/validation/lead.schema";
import { generateLeadsFromDiscovery } from "@/services/generate-leads.service";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    const body = await req.json();
    const input = generateLeadsSchema.parse(body);
    const result = await generateLeadsFromDiscovery(user.id, input);
    return ok(result, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
