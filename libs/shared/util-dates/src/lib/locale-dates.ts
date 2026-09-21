import {
  format as formatDateFn,
  formatRelative as formatRelativeFn,
  type FormatOptions,
  type FormatRelativeOptions,
  type Locale,
} from 'date-fns';
import { normalizeDateFormat } from './format';

/**
 * Supported locale codes mapped to date-fns locale imports.
 *
 * We use a lazy-loading pattern to avoid bundling all locales upfront.
 * Add new locales here as the application grows.
 */
type LocaleModule = Record<string, Locale>;

function extractLocale(module: LocaleModule): Locale {
  const locale = Object.values(module)[0];
  if (!locale) {
    throw new Error('[util-dates] Failed to resolve date-fns locale module');
  }

  return locale;
}

const LOCALE_IMPORT_MAP: Record<string, () => Promise<Locale>> = {
  'en-US': async () => extractLocale(await import('date-fns/locale/en-US')),
  'en-GB': async () => extractLocale(await import('date-fns/locale/en-GB')),
  'zh-CN': async () => extractLocale(await import('date-fns/locale/zh-CN')),
  'zh-TW': async () => extractLocale(await import('date-fns/locale/zh-TW')),
  'ja-JP': async () => extractLocale(await import('date-fns/locale/ja')),
  'ko-KR': async () => extractLocale(await import('date-fns/locale/ko')),
  'de-DE': async () => extractLocale(await import('date-fns/locale/de')),
  'fr-FR': async () => extractLocale(await import('date-fns/locale/fr')),
  'es-ES': async () => extractLocale(await import('date-fns/locale/es')),
  'it-IT': async () => extractLocale(await import('date-fns/locale/it')),
  'pt-BR': async () => extractLocale(await import('date-fns/locale/pt-BR')),
  'ru-RU': async () => extractLocale(await import('date-fns/locale/ru')),
  'ar-SA': async () => extractLocale(await import('date-fns/locale/ar-SA')),
};

/** Cache for loaded locales to avoid repeated dynamic imports. */
const localeCache = new Map<string, Locale>();

/**
 * Normalizes a locale string to a supported date-fns locale key.
 *
 * Falls back to language-only code (e.g. "en-XX" -> "en-US") and
 * ultimately to "en-US" if no match is found.
 */
function normalizeLocaleCode(locale: string): string {
  if (LOCALE_IMPORT_MAP[locale]) {
    return locale;
  }

  const languageOnly = locale.split('-')[0];
  const fallback = `${languageOnly}-${languageOnly.toUpperCase()}`;

  if (LOCALE_IMPORT_MAP[fallback]) {
    return fallback;
  }

  // Special cases for common locales without a direct 1:1 mapping
  const specialCases: Record<string, string> = {
    en: 'en-US',
    'en-US': 'en-US',
    zh: 'zh-CN',
    ja: 'ja-JP',
    ko: 'ko-KR',
    de: 'de-DE',
    fr: 'fr-FR',
    es: 'es-ES',
    it: 'it-IT',
    pt: 'pt-BR',
    ru: 'ru-RU',
    ar: 'ar-SA',
  };

  if (specialCases[languageOnly]) {
    return specialCases[languageOnly];
  }

  return 'en-US';
}

/**
 * Loads a date-fns locale object asynchronously.
 *
 * @param locale - BCP 47 locale string (e.g. "zh-CN", "en-US")
 * @returns The loaded date-fns Locale object
 */
export async function loadDateLocale(locale: string): Promise<Locale> {
  const normalized = normalizeLocaleCode(locale);

  const cached = localeCache.get(normalized);
  if (cached) {
    return cached;
  }

  const loader = LOCALE_IMPORT_MAP[normalized];
  if (!loader) {
    throw new Error(`[util-dates] Unsupported locale: ${locale}`);
  }

  const dateFnsLocale = await loader();
  localeCache.set(normalized, dateFnsLocale);

  return dateFnsLocale;
}

/**
 * Returns a locale-aware formatter object bound to a specific locale.
 *
 * This is useful when you want to pre-configure formatters for a given locale
 * and reuse them across components without passing locale options every time.
 *
 * @param locale - BCP 47 locale string (e.g. "zh-CN", "en-US")
 * @returns An object with bound `formatDate`, `formatTime`, and `formatRelative` functions
 *
 * @example
 * const formatter = await getLocaleAwareFormatter('zh-CN');
 * formatter.formatDate(new Date()) // => "2025年4月29日"
 */
export async function getLocaleAwareFormatter(locale: string) {
  const dateFnsLocale = await loadDateLocale(locale);
  const baseFormatOptions: FormatOptions = { locale: dateFnsLocale };
  const baseRelativeOptions: FormatRelativeOptions = { locale: dateFnsLocale };

  return {
    locale: dateFnsLocale,

    /**
     * Formats a date using the bound locale.
     */
    formatDate(
      date: Date | number | string,
      formatStr = 'PP',
      options?: Omit<FormatOptions, 'locale'>,
    ): string {
      return formatDateFn(date, normalizeDateFormat(formatStr), {
        ...baseFormatOptions,
        ...options,
      });
    },

    /**
     * Formats a time using the bound locale.
     */
    formatTime(
      date: Date | number | string,
      formatStr = 'p',
      options?: Omit<FormatOptions, 'locale'>,
    ): string {
      return formatDateFn(date, normalizeDateFormat(formatStr), {
        ...baseFormatOptions,
        ...options,
      });
    },

    /**
     * Formats a date relative to a base date using the bound locale.
     */
    formatRelative(
      date: Date | number | string,
      baseDate: Date | number | string = new Date(),
      options?: Omit<FormatRelativeOptions, 'locale'>,
    ): string {
      return formatRelativeFn(date, baseDate, { ...baseRelativeOptions, ...options });
    },
  };
}

export type LocaleAwareFormatter = Awaited<
  ReturnType<typeof getLocaleAwareFormatter>
>;
