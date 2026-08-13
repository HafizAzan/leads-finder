import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { handleApiError, ok } from "@/lib/api/response";
import { updateLeadSchema } from "@/lib/validation/lead.schema";
import { deleteLead, getLeadForUser, updateLead } from "@/services/leads.service";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser(req);
    const { id } = await params;
    const lead = await getLeadForUser(user.id, id);
    return ok(lead);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser(req);
    const { id } = await params;
    const body = await req.json();
    const input = updateLeadSchema.parse(body);
    const lead = await updateLead(user.id, id, input);
    return ok(lead);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser(req);
    const { id } = await params;
    await deleteLead(user.id, id);
    return ok({ id });
  } catch (error) {
    return handleApiError(error);
  }
}
