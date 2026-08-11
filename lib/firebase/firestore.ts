import { getAdminDb } from "./admin";

export const collections = {
  users: "users",
  leads: "leads",
  settings: "settings",
  emailQueue: "emailQueue",
} as const;

export function db() {
  return getAdminDb();
}
