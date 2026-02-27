/**
 * Phone number formatting utilities for Israeli numbers.
 *
 * Storage format:  972XXXXXXXXX  (WhatsApp / E.164 without +)
 * Display format:  05X-XXXXXXX  (Israeli local)
 */

/** Convert any Israeli phone to WhatsApp-ready 972XXXXXXXXX format. */
export function formatForWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('972')) return digits;
  if (digits.startsWith('0')) return '972' + digits.slice(1);
  return '972' + digits;
}

/** Convert any Israeli phone to display format 05X-XXXXXXX. */
export function formatForDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  let local: string;
  if (digits.startsWith('972')) {
    local = '0' + digits.slice(3);
  } else if (digits.startsWith('0')) {
    local = digits;
  } else {
    local = '0' + digits;
  }
  if (local.length >= 4) {
    return local.slice(0, 3) + '-' + local.slice(3);
  }
  return local;
}

/** Check if a phone string looks like a valid Israeli mobile number. */
export function isValidIsraeliMobile(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  // 05X-XXXXXXX = 10 digits, or 972-5X-XXXXXXX = 12 digits
  if (digits.startsWith('972') && digits.length === 12 && digits[3] === '5') return true;
  if (digits.startsWith('05') && digits.length === 10) return true;
  return false;
}
