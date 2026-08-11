import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { handleApiError, ok } from "@/lib/api/response";
import { bulkIdsSchema } from "@/lib/validation/lead.schema";
import { bulkApproveLeads } from "@/services/leads.service";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    const body = await req.json();
    const { ids } = bulkIdsSchema.parse(body);
    const results = await bulkApproveLeads(user.id, ids);
    return ok({ results });
  } catch (error) {
    return handleApiError(error);
  }
}
