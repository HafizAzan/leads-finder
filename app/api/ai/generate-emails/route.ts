import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { handleApiError, ok } from "@/lib/api/response";
import { leadIdsSchema } from "@/lib/validation/lead.schema";
import { generateEmailsForLeads } from "@/services/ai.service";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    const body = await req.json();
    const { leadIds } = leadIdsSchema.parse(body);
    const results = await generateEmailsForLeads(user.id, leadIds);
    return ok({ results });
  } catch (error) {
    return handleApiError(error);
  }
}
