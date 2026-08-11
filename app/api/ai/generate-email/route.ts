import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { handleApiError, ok } from "@/lib/api/response";
import { leadIdSchema } from "@/lib/validation/lead.schema";
import { generateEmailForLead, reviewEmailForLead } from "@/services/ai.service";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    const body = await req.json();
    const { leadId } = leadIdSchema.parse(body);
    await generateEmailForLead(user.id, leadId);
    const lead = await reviewEmailForLead(user.id, leadId);
    return ok(lead);
  } catch (error) {
    return handleApiError(error);
  }
}
