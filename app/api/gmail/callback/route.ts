import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/gmail/oauth";
import { saveGmailConnection } from "@/services/settings.service";

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const settingsUrl = new URL("/leads/settings", url.origin);

  if (oauthError) {
    settingsUrl.searchParams.set("gmail", "error");
    settingsUrl.searchParams.set("message", oauthError);
    return NextResponse.redirect(settingsUrl);
  }

  if (!code || !state) {
    settingsUrl.searchParams.set("gmail", "error");
    settingsUrl.searchParams.set("message", "Missing OAuth code.");
    return NextResponse.redirect(settingsUrl);
  }

  try {
    const parsed = JSON.parse(Buffer.from(state, "base64url").toString("utf8")) as { userId?: string };
    if (!parsed.userId) {
      throw new Error("Invalid OAuth state.");
    }

    const tokens = await exchangeCodeForTokens(code);
    await saveGmailConnection(parsed.userId, {
      email: tokens.email,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
    });

    settingsUrl.searchParams.set("gmail", "connected");
    settingsUrl.searchParams.set("email", tokens.email);
    return NextResponse.redirect(settingsUrl);
  } catch (error) {
    console.error("[gmail-callback]", error);
    settingsUrl.searchParams.set("gmail", "error");
    settingsUrl.searchParams.set(
      "message",
      error instanceof Error ? error.message : "Failed to connect Gmail.",
    );
    return NextResponse.redirect(settingsUrl);
  }
}
