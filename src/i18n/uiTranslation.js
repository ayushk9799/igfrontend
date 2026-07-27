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

export const formatRelativeTime = (value, unit, options = {}) => (
    new Intl.RelativeTimeFormat(getUiLocale(), {
        numeric: 'auto',
        style: 'short',
        ...options,
    }).format(value, unit)
);
