import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import es from './locales/es.json';
import pt from './locales/pt.json';

const SUPPORTED_LANGUAGES = ['en', 'es', 'pt'] as const;
const LANGUAGE_KEY = 'app-language';

function getInitialLanguage(): string {
  const saved = localStorage.getItem(LANGUAGE_KEY);
  if (saved && (SUPPORTED_LANGUAGES as readonly string[]).includes(saved)) return saved;

  const browserLang = navigator.language?.slice(0, 2);
  if ((SUPPORTED_LANGUAGES as readonly string[]).includes(browserLang)) return browserLang;

  return 'es';
}

const resources = {
  en: {
    translation: en,
  },
  es: {
    translation: es,
  },
  pt: {
    translation: pt,
  },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: getInitialLanguage(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
