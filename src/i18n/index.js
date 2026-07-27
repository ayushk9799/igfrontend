import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import { storage } from '../utils/authStorage';
import en from './locales/en.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import es from './locales/es.json';
import it from './locales/it.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';

const LANGUAGE_STORAGE_KEY = 'app_language';
const SUPPORTED_LANGUAGES = ['en', 'fr', 'de', 'es', 'it', 'ja', 'ko'];

const savedLanguage = storage.getString(LANGUAGE_STORAGE_KEY);
const deviceLanguage = getLocales()[0]?.languageCode ?? 'en';
const initialLanguage = savedLanguage
    || (SUPPORTED_LANGUAGES.includes(deviceLanguage) ? deviceLanguage : 'en');

i18n
    .use(initReactI18next)
    .init({
        resources: {
            en: { translation: en },
            fr: { translation: fr },
            de: { translation: de },
            es: { translation: es },
            it: { translation: it },
            ja: { translation: ja },
            ko: { translation: ko },
        },
        lng: initialLanguage,
        fallbackLng: 'en',
        supportedLngs: SUPPORTED_LANGUAGES,
        initImmediate: false,
        interpolation: {
            escapeValue: false,
        },
        react: {
            useSuspense: false,
        },
    });

export const changeAppLanguage = async (language) => {
    if (!SUPPORTED_LANGUAGES.includes(language)) return;

    storage.set(LANGUAGE_STORAGE_KEY, language);
    await i18n.changeLanguage(language);
};

export default i18n;
