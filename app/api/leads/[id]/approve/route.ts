import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { handleApiError, ok } from "@/lib/api/response";
import { approveLead } from "@/services/leads.service";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser(req);
    const { id } = await params;
    const lead = await approveLead(user.id, id);
    return ok(lead);
  } catch (error) {
    return handleApiError(error);
  }
}
