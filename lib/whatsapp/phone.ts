/**
 * Normalize phone to WhatsApp/Meta-compatible digits (E.164 without +).
 */
export function normalizePhoneForWhatsApp(phone: string, defaultCountryCode = "971"): string | null {
  const raw = phone.trim();
  if (!raw) return null;

  let digits = raw.replace(/[^\d+]/g, "");

  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  if (digits.startsWith("+")) {
    digits = digits.slice(1);
  }

  // Local UAE-style numbers starting with 0
  if (digits.startsWith("0") && digits.length >= 9 && digits.length <= 11) {
    digits = `${defaultCountryCode}${digits.slice(1)}`;
  }

  // Already looks like international without +
  digits = digits.replace(/\D/g, "");

  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}
