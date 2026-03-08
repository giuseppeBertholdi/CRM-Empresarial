const DEFAULT_COUNTRY_CODE = "55";

export function normalizePhoneForWhatsapp(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;

  if (digits.startsWith("00")) {
    return digits.slice(2);
  }

  if (digits.length >= 12) return digits;
  if (digits.length >= 10 && digits.length <= 11) {
    return `${DEFAULT_COUNTRY_CODE}${digits}`;
  }

  return null;
}

export function buildWhatsappUrl(phone: string, text?: string) {
  const normalized = normalizePhoneForWhatsapp(phone);
  if (!normalized) return null;

  const base = `https://wa.me/${normalized}`;
  if (!text?.trim()) return base;
  return `${base}?text=${encodeURIComponent(text)}`;
}










