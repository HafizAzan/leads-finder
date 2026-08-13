export type WhatsAppStatus =
  | "disconnected"
  | "initializing"
  | "qr"
  | "authenticated"
  | "ready"
  | "error";

export type WhatsAppConnectionState = {
  status: WhatsAppStatus;
  qrCodeDataUrl: string | null;
  phoneNumber: string | null;
  pushName: string | null;
  syncPercent: number | null;
  error: string | null;
};
