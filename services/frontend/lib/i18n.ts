// frontend/lib/i18n.ts
class I18nClient {
  private currentLang: string = 'en';
  private cache: Map<string, string> = new Map();
  
  constructor(private baseUrl: string = '/api/i18n') {}
  
  async detectLanguage(): Promise<string> {
    const response = await fetch(`${this.baseUrl}/detect`, {
      headers: this.getHeaders()
    });
    
    const data = await response.json();
    this.currentLang = data.detectedLanguage;
    return this.currentLang;
  }
  
  async translate(key: string, params?: any): Promise<string> {
    // Check cache first
    const cacheKey = `${key}:${this.currentLang}:${JSON.stringify(params)}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }
    
    // Fetch translation
    const response = await fetch(`${this.baseUrl}/translate`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        text: key,
        targetLang: this.currentLang,
        context: params
      })
    });
    
    const data = await response.json();
    const translated = data.translated;
    
    // Cache result
    this.cache.set(cacheKey, translated);
    return translated;
  }
  
  async setLanguage(lang: string): Promise<void> {
    this.currentLang = lang;
    this.cache.clear(); // Clear cache on language change
    
    // Store preference
    localStorage.setItem('preferredLanguage', lang);
  }
  
  getCurrentLanguage(): string {
    return this.currentLang;
  }
  
  private getHeaders(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang
    };
  }
}

// Singleton instance
export const i18n = new I18nClient();