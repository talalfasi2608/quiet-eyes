export const locales = ["en", "he"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

export const rtlLocales: Locale[] = ["he"];

export function isRtl(locale: Locale): boolean {
  return rtlLocales.includes(locale);
}
