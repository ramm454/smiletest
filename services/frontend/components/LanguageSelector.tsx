// frontend/components/LanguageSelector.tsx
'use client';

import { useState, useEffect } from 'react';
import { i18n } from '@/lib/i18n-client';
import { Globe } from 'lucide-react';

export function LanguageSelector() {
  const [languages, setLanguages] = useState<any[]>([]);
  const [currentLang, setCurrentLang] = useState('en');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadLanguages();
    
    // Set current language from localStorage or detected
    const savedLang = localStorage.getItem('preferredLanguage');
    if (savedLang) {
      setCurrentLang(savedLang);
    }
    
    // Listen for language changes
    const handleLanguageChange = (event: CustomEvent) => {
      setCurrentLang(event.detail.language);
    };
    
    window.addEventListener('languageChanged', handleLanguageChange as EventListener);
    
    return () => {
      window.removeEventListener('languageChanged', handleLanguageChange as EventListener);
    };
  }, []);

  const loadLanguages = async () => {
    try {
      const langs = await i18n.getAvailableLanguages();
      setLanguages(langs);
    } catch (error) {
      console.error('Failed to load languages:', error);
    }
  };

  const handleLanguageChange = async (langCode: string) => {
    if (langCode === currentLang) return;
    
    setIsLoading(true);
    try {
      await i18n.changeLanguage(langCode);
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to change language:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const currentLanguage = languages.find(lang => lang.code === currentLang);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
      >
        <Globe size={18} />
        <span className="font-medium">
          {currentLanguage?.nativeName || currentLanguage?.name || currentLang.toUpperCase()}
        </span>
        {isLoading && (
          <div className="ml-2 animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-300 rounded-lg shadow-lg z-50">
            <div className="py-2">
              {languages.map((language) => (
                <button
                  key={language.code}
                  onClick={() => handleLanguageChange(language.code)}
                  className={`w-full px-4 py-2 text-left hover:bg-gray-100 transition-colors ${
                    language.code === currentLang ? 'bg-blue-50 text-blue-700' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{language.nativeName}</span>
                    <span className="text-sm text-gray-500">{language.name}</span>
                  </div>
                </button>
              ))}
            </div>
            <div className="border-t px-4 py-2 text-sm text-gray-500">
              Auto-detected: {navigator.language}
            </div>
          </div>
        </>
      )}
    </div>
  );
}