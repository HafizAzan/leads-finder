import { NextRequest } from "next/server";
import { ensureUser } from "@/services/users.service";

/**
 * Temporary auth bridge until Firebase Auth is wired.
 * Prefer DEV_USER_ID from env. Optionally accept x-user-id header in development only.
 */
export async function getCurrentUser(req?: NextRequest) {
  const headerUserId =
    process.env.NODE_ENV === "development" ? req?.headers.get("x-user-id")?.trim() : undefined;

  const userId = headerUserId || process.env.DEV_USER_ID || "dev-user";
  const email = process.env.DEV_USER_EMAIL || `${userId}@example.com`;
  const name = process.env.DEV_USER_NAME || "Dev User";

  await ensureUser({ id: userId, email, name });

  return {
    id: userId,
    email,
    name,
  };
}
