import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { handleApiError } from "@/lib/api/response";
import { getGmailAuthUrl } from "@/lib/gmail/oauth";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    const state = Buffer.from(JSON.stringify({ userId: user.id, ts: Date.now() })).toString("base64url");
    const url = getGmailAuthUrl(state);
    return NextResponse.redirect(url);
  } catch (error) {
    return handleApiError(error);
  }
}
