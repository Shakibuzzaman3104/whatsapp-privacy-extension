/**
 * @author Shakib
 * @since 25/10/26
 *
 * On-device rules that decide whether a message holds private details.
 * Pure functions: no DOM, no network.
 */

export type SensitiveKind =
  | 'otp'
  | 'card'
  | 'bank'
  | 'password'
  | 'phone'
  | 'email'
  | 'money'
  | 'address';

export const SENSITIVE_KINDS: SensitiveKind[] = [
  'otp', 'card', 'bank', 'password', 'phone', 'email', 'money', 'address',
];

export type KindToggles = Partial<Record<SensitiveKind, boolean>>;

export interface Classification {
  sensitive: boolean;
  kinds: SensitiveKind[];
}

// Bengali digits are normalised to ASCII so every rule below sees one script.
const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
const normaliseDigits = (text: string) =>
  text.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));

const OTP_KEYWORD =
  /\b(otp|one[- ]time|verification|verify|confirmation|security|login|auth(?:entication)?|passcode|2fa|code)\b|ওটিপি|কোড|যাচাই/i;
const OTP_CODE = /(?:^|[^\d])(?:[A-Z]-)?(\d{4,8})(?!\d)/;

const CARD_CANDIDATE = /(?:\d[ -]?){13,19}/g;

const IBAN = /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,3})?\b/;
const ACCOUNT =
  /\b(?:a\/c|acc(?:oun)?t|account)\s*(?:no\.?|number|#)?\s*[:#-]?\s*\d[\d -]{7,20}\d/i;

// Allows a few words between the keyword and its value: "the wifi password at the flat is sunflower22".
const PASSWORD =
  /\b(?:password|passwd|pwd|pass|pin|passcode)(?:\s+[\w']+){0,4}?\s*(?:\bis\b|:|=|-)\s*\S{3,}|\bpin\s+(?:is\s+)?\d{4,6}\b|পাসওয়ার্ড\s*\S+|পিন\s*\d{4,6}/i;

const PHONE_INTL = /\+\d{1,3}[\s.-]?\(?\d{1,4}\)?(?:[\s.-]?\d{2,4}){2,4}/;
const PHONE_BD = /(?:^|[^\d])01[3-9]\d{2}[\s-]?\d{6}(?!\d)/;
const PHONE_US = /\(\d{3}\)\s?\d{3}[\s.-]\d{4}/;

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]{2,}/;

const MONEY =
  /(?:[$€£₹৳]\s?\d[\d,]*(?:\.\d+)?)|\b(?:tk|bdt|taka|usd|eur|gbp|inr|rs\.?)\s?\d[\d,]*(?:\.\d+)?|\d[\d,]*(?:\.\d+)?\s?(?:tk|taka|bdt|টাকা)\b|\b(?:trxid|txnid|transaction id|cash ?in|cash ?out|send money|debited|credited|balance)\b|বিকাশ|নগদ|bkash|nagad|rocket/i;

const ADDRESS =
  /\b(?:house|flat|apt|apartment|road|rd|street|st|avenue|ave|lane|block|sector)\b\.?\s*#?\s*\d+\w?|\b\d+\w?\s+[A-Z][a-z]+\s+(?:street|st|road|rd|avenue|ave|lane|ln|boulevard|blvd|drive|dr)\b|বাসা|রোড|সড়ক/i;

/** Luhn checksum used by every major card network. */
export function luhnValid(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48;
    if (n < 0 || n > 9) return false;
    if (double) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    double = !double;
  }
  return digits.length >= 13 && sum % 10 === 0;
}

function hasCard(text: string): boolean {
  for (const match of text.match(CARD_CANDIDATE) ?? []) {
    const digits = match.replace(/\D/g, '');
    if (digits.length >= 13 && digits.length <= 19 && luhnValid(digits)) return true;
  }
  return false;
}

function hasAddress(text: string): boolean {
  if (!ADDRESS.test(text)) return false;
  // An address has a number and at least one more part after a comma or a second keyword.
  return /\d/.test(text) && (text.includes(',') || /\b(?:street|st|road|rd|avenue|ave)\b/i.test(text));
}

const RULES: Record<SensitiveKind, (text: string) => boolean> = {
  otp: (t) => OTP_KEYWORD.test(t) && OTP_CODE.test(t),
  card: hasCard,
  bank: (t) => IBAN.test(t) || ACCOUNT.test(t),
  password: (t) => PASSWORD.test(t),
  phone: (t) => PHONE_INTL.test(t) || PHONE_BD.test(t) || PHONE_US.test(t),
  email: (t) => EMAIL.test(t),
  money: (t) => MONEY.test(t),
  address: hasAddress,
};

export function classify(text: string, enabled: KindToggles = {}): Classification {
  const normalised = normaliseDigits(text);
  const kinds = SENSITIVE_KINDS.filter(
    (kind) => enabled[kind] !== false && RULES[kind](normalised),
  );
  return { sensitive: kinds.length > 0, kinds };
}
