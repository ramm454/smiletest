// frontend/hooks/useTranslation.ts
import { useEffect, useState } from 'react';
import { i18n } from '@/lib/i18n';

export function useTranslation() {
  const [language, setLanguage] = useState(i18n.getCurrentLanguage());
  const [isLoading, setIsLoading] = useState(false);
  
  useEffect(() => {
    // Auto-detect language on mount
    detectLanguage();
  }, []);
  
  const detectLanguage = async () => {
    setIsLoading(true);
    try {
      const detected = await i18n.detectLanguage();
      setLanguage(detected);
    } catch (error) {
      console.error('Language detection failed:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const t = async (key: string, params?: any): Promise<string> => {
    return i18n.translate(key, params);
  };
  
  const changeLanguage = async (lang: string) => {
    setIsLoading(true);
    try {
      await i18n.setLanguage(lang);
      setLanguage(lang);
    } catch (error) {
      console.error('Language change failed:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  return {
    t,
    language,
    isLoading,
    changeLanguage,
    detectLanguage
  };
}