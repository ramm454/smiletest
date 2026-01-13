// frontend/lib/i18n-client.ts
import axios from 'axios';

class I18nClient {
  private baseUrl: string;
  private currentLang: string = 'en';
  private cache = new Map<string, string>();
  private pendingRequests = new Map<string, Promise<string>>();

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || '/api/i18n';
    
    // Try to detect language on initialization
    this.detectLanguage();
  }

  async detectLanguage(): Promise<string> {
    try {
      const response = await axios.get(`${this.baseUrl}/detect`, {
        headers: {
          'Accept-Language': navigator.language,
          'X-Client-Time': new Date().toISOString()
        }
      });
      
      this.currentLang = response.data.detectedLanguage;
      
      // Store in localStorage for future visits
      localStorage.setItem('preferredLanguage', this.currentLang);
      
      return this.currentLang;
    } catch (error) {
      console.warn('Language detection failed, using default:', error);
      return this.currentLang;
    }
  }

  async translate(key: string, params?: Record<string, any>): Promise<string> {
    // Check cache first
    const cacheKey = this.getCacheKey(key, params);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // Check for pending request
    if (this.pendingRequests.has(cacheKey)) {
      return this.pendingRequests.get(cacheKey)!;
    }

    // Create new translation request
    const promise = this.fetchTranslation(key, params);
    this.pendingRequests.set(cacheKey, promise);

    try {
      const translation = await promise;
      this.cache.set(cacheKey, translation);
      return translation;
    } finally {
      this.pendingRequests.delete(cacheKey);
    }
  }

  async translateBatch(keys: string[], params?: Record<string, any>): Promise<string[]> {
    try {
      const response = await axios.post(`${this.baseUrl}/translate-batch`, {
        texts: keys,
        targetLang: this.currentLang,
        context: params
      });

      // Cache results
      keys.forEach((key, index) => {
        const cacheKey = this.getCacheKey(key, params);
        this.cache.set(cacheKey, response.data.translated[index]);
      });

      return response.data.translated;
    } catch (error) {
      console.error('Batch translation failed:', error);
      return keys; // Return keys as fallback
    }
  }

  async changeLanguage(lang: string): Promise<void> {
    if (lang === this.currentLang) return;

    this.currentLang = lang;
    
    // Clear cache on language change
    this.cache.clear();
    
    // Store preference
    localStorage.setItem('preferredLanguage', lang);
    
    // Notify components of language change
    window.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: lang } }));
    
    // Force page refresh or update translations
    this.reloadTranslations();
  }

  getCurrentLanguage(): string {
    return this.currentLang;
  }

  async getAvailableLanguages(): Promise<Array<{code: string, name: string, nativeName: string}>> {
    try {
      const response = await axios.get(`${this.baseUrl}/languages`);
      return response.data.languages;
    } catch (error) {
      console.error('Failed to fetch languages:', error);
      return [];
    }
  }

  private async fetchTranslation(key: string, params?: Record<string, any>): Promise<string> {
    try {
      const response = await axios.post(`${this.baseUrl}/translate`, {
        text: key,
        targetLang: this.currentLang,
        context: params
      });

      return response.data.translated;
    } catch (error) {
      console.error('Translation failed:', error);
      return key; // Return original key as fallback
    }
  }

  private getCacheKey(key: string, params?: Record<string, any>): string {
    return `${key}:${this.currentLang}:${JSON.stringify(params || {})}`;
  }

  private reloadTranslations(): void {
    // This would trigger re-translation of all visible content
    // Implementation depends on your framework
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }
}

// Singleton instance
export const i18n = new I18nClient();

// React Hook
export function useTranslation() {
  const [language, setLanguage] = useState(i18n.getCurrentLanguage());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Listen for language changes
    const handleLanguageChange = (event: CustomEvent) => {
      setLanguage(event.detail.language);
    };

    window.addEventListener('languageChanged', handleLanguageChange as EventListener);
    
    return () => {
      window.removeEventListener('languageChanged', handleLanguageChange as EventListener);
    };
  }, []);

  const t = useCallback(async (key: string, params?: Record<string, any>) => {
    return i18n.translate(key, params);
  }, []);

  const changeLanguage = useCallback(async (lang: string) => {
    setIsLoading(true);
    try {
      await i18n.changeLanguage(lang);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { t, language, isLoading, changeLanguage, i18n };
}