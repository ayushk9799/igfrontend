import i18n from './index';
import frenchUi from './locales/frUi.json';

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
    if (typeof value !== 'string' || !i18n.resolvedLanguage?.startsWith('fr')) {
        return value;
    }

    const { leading, text, trailing } = splitWhitespace(value);
    if (!text) return value;

    return `${leading}${frenchUi[text] ?? text}${trailing}`;
};

export const translateUiTemplate = (template, values = []) => {
    const translated = translateUiText(template);
    return translated.replace(/\{\{(\d+)\}\}/g, (match, index) => (
        values[Number(index)] ?? match
    ));
};

export const getUiLocale = () => (
    i18n.resolvedLanguage?.startsWith('fr') ? 'fr-FR' : 'en-US'
);

export const formatRelativeTime = (value, unit, options = {}) => (
    new Intl.RelativeTimeFormat(getUiLocale(), {
        numeric: 'auto',
        style: 'short',
        ...options,
    }).format(value, unit)
);
