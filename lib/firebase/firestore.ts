import { getAdminDb } from "./admin";

export const collections = {
  users: "users",
  leads: "leads",
  settings: "settings",
  emailQueue: "emailQueue",
  whatsappQueue: "whatsappQueue",
} as const;

export function db() {
  return getAdminDb();
}
