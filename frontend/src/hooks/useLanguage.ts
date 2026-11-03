import { useState, useEffect } from 'react';
import { Language, UI_TRANSLATIONS } from '../locales/translations';

export function useLanguage() {
  const [lang, setLang] = useState<Language>(() => {
    return (localStorage.getItem('threadflow_lang') as Language) || 'en';
  });

  useEffect(() => {
    const handleLangChange = (e: any) => {
      if (e.detail?.lang) {
        setLang(e.detail.lang as Language);
      }
    };

    window.addEventListener('threadflow-lang-change', handleLangChange);
    return () => window.removeEventListener('threadflow-lang-change', handleLangChange);
  }, []);

  const t = UI_TRANSLATIONS[lang] || UI_TRANSLATIONS.en;

  return {
    lang,
    isTa: lang === 'ta',
    t,
  };
}
