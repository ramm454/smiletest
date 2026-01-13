// frontend/hocs/withTranslation.tsx
import React, { useEffect, useState } from 'react';
import { i18n } from '@/lib/i18n-client';

export function withTranslation<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  translationKeys: Record<string, string> = {}
) {
  return function WithTranslationComponent(props: P) {
    const [translations, setTranslations] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
      loadTranslations();
      
      // Listen for language changes
      const handleLanguageChange = () => {
        loadTranslations();
      };
      
      window.addEventListener('languageChanged', handleLanguageChange);
      
      return () => {
        window.removeEventListener('languageChanged', handleLanguageChange);
      };
    }, []);

    const loadTranslations = async () => {
      setIsLoading(true);
      try {
        const keys = Object.values(translationKeys);
        const translated = await i18n.translateBatch(keys);
        
        const newTranslations: Record<string, string> = {};
        Object.entries(translationKeys).forEach(([key, translationKey], index) => {
          newTranslations[key] = translated[index];
        });
        
        setTranslations(newTranslations);
      } catch (error) {
        console.error('Failed to load translations:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (isLoading && Object.keys(translationKeys).length > 0) {
      return <div className="animate-pulse">Loading translations...</div>;
    }

    return <WrappedComponent {...props} t={translations} />;
  };
}

// Usage example:
// export default withTranslation(MyComponent, {
//   welcome: 'Welcome to our app',
//   description: 'This is a description',
// });