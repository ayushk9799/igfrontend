import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import { storage } from '../utils/authStorage';
import en from './locales/en.json';
import fr from './locales/fr.json';

const LANGUAGE_STORAGE_KEY = 'app_language';
const SUPPORTED_LANGUAGES = ['en', 'fr'];

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
