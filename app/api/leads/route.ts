import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { handleApiError, ok } from "@/lib/api/response";
import { createLeadSchema } from "@/lib/validation/lead.schema";
import { createLead, listLeads } from "@/services/leads.service";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    const leads = await listLeads(user.id);
    return ok(leads);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    const body = await req.json();
    const input = createLeadSchema.parse(body);
    const lead = await createLead(user.id, {
      ...input,
      email: input.email || undefined,
      website: input.website || undefined,
    });
    return ok(lead, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
