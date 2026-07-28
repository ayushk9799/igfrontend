import i18n from './index';
import frenchUi from './locales/frUi.json';
import germanUi from './locales/deUi.json';
import spanishUi from './locales/esUi.json';
import italianUi from './locales/itUi.json';
import japaneseUi from './locales/jaUi.json';
import koreanUi from './locales/koUi.json';

const UI_TRANSLATIONS = {
    fr: frenchUi,
    de: germanUi,
    es: spanishUi,
    it: italianUi,
    ja: japaneseUi,
    ko: koreanUi,
};

const UI_LOCALES = {
    en: 'en-US',
    fr: 'fr-FR',
    de: 'de-DE',
    es: 'es-ES',
    it: 'it-IT',
    ja: 'ja-JP',
    ko: 'ko-KR',
};

const getLanguageCode = () => (
    i18n.resolvedLanguage?.split('-')[0] ?? 'en'
);

const splitWhitespace = (value) => {
    const leading = value.match(/^\s*/)?.[0] ?? '';
    const trailing = value.match(/\s*$/)?.[0] ?? '';
    const text = value.slice(leading.length, value.length - trailing.length);
    return { leading, text, trailing };
};

/**
 * Translates developer-authored UI literals while leaving dynamic/user content
 * untouched. English literals are the stable keys so existing screens can be
 * migrated without inventing hundreds of opaque identifiers.
 */
export const translateUiText = (value) => {
    if (typeof value !== 'string') return value;

    const translations = UI_TRANSLATIONS[getLanguageCode()];
    if (!translations) return value;

    const { leading, text, trailing } = splitWhitespace(value);
    if (!text) return value;

    return `${leading}${translations[text] ?? text}${trailing}`;
};

export const translateUiTemplate = (template, values = []) => {
    const translated = translateUiText(template);
    return translated.replace(/\{\{(\d+)\}\}/g, (match, index) => (
        values[Number(index)] ?? match
    ));
};

export const getUiLocale = () => UI_LOCALES[getLanguageCode()] ?? UI_LOCALES.en;

export const getContentLanguage = getLanguageCode;

const RELATIVE_TIME_SHORT_UNITS = {
    second: 'sec',
    minute: 'min',
    hour: 'hr',
    day: 'day',
    week: 'wk',
    month: 'mo',
    quarter: 'qtr',
    year: 'yr',
};

const formatRelativeTimeFallback = (value, unit, style) => {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return '';
    if (numericValue === 0) return 'now';

    const amount = Math.abs(numericValue);
    const normalizedUnit = String(unit).replace(/s$/, '');
    const label = style === 'long'
        ? `${normalizedUnit}${amount === 1 ? '' : 's'}`
        : (RELATIVE_TIME_SHORT_UNITS[normalizedUnit] || normalizedUnit);
    const relativeValue = `${amount} ${label}`;

    return numericValue < 0 ? `${relativeValue} ago` : `in ${relativeValue}`;
};

export const formatRelativeTime = (value, unit, options = {}) => {
    const formatterOptions = {
        numeric: 'auto',
        style: 'short',
        ...options,
    };
    const RelativeTimeFormat = typeof Intl !== 'undefined'
        ? Intl.RelativeTimeFormat
        : undefined;

    // Some Hermes release runtimes do not include RelativeTimeFormat. Babel's
    // transpiled constructor reads `.prototype`, so calling an absent formatter
    // crashes the entire React Native list row instead of throwing locally.
    if (typeof RelativeTimeFormat === 'function') {
        try {
            return new RelativeTimeFormat(getUiLocale(), formatterOptions).format(value, unit);
        } catch (error) {
            console.warn('Intl.RelativeTimeFormat failed; using fallback:', error);
        }
    }

    return formatRelativeTimeFallback(value, unit, formatterOptions.style);
};
