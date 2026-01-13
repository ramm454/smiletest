'use client';
import { useState, useEffect } from 'react';
import { Cookie, Settings, Check, X, ChevronDown, Shield, Info } from 'lucide-react';

interface CookieBannerProps {
  onAccept?: (preferences: CookiePreferences) => void;
  onReject?: () => void;
  onCustomize?: () => void;
}

interface CookiePreferences {
  necessary: boolean;
  preferences: boolean;
  analytics: boolean;
  marketing: boolean;
  consentString?: string;
}

export default function CookieBanner({ onAccept, onReject, onCustomize }: CookieBannerProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    necessary: true,
    preferences: false,
    analytics: false,
    marketing: false
  });

  useEffect(() => {
    // Check if consent already given
    const hasConsent = localStorage.getItem('gdpr_cookie_consent');
    if (!hasConsent) {
      setIsVisible(true);
    }
  }, []);

  const handleAcceptAll = async () => {
    const allAccepted: CookiePreferences = {
      necessary: true,
      preferences: true,
      analytics: true,
      marketing: true,
      consentString: generateConsentString(true, true, true, true)
    };
    
    await saveCookiePreferences(allAccepted);
    setIsVisible(false);
    onAccept?.(allAccepted);
  };

  const handleAcceptNecessary = async () => {
    await saveCookiePreferences({
      ...preferences,
      necessary: true,
      consentString: generateConsentString(true, false, false, false)
    });
    setIsVisible(false);
    onAccept?.(preferences);
  };

  const handleCustomize = () => {
    setShowDetails(!showDetails);
    onCustomize?.();
  };

  const saveCookiePreferences = async (cookiePrefs: CookiePreferences) => {
    try {
      const response = await fetch('/api/user?endpoint=cookies-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...cookiePrefs,
          userAgent: navigator.userAgent,
          country: await detectCountry()
        })
      });

      if (response.ok) {
        localStorage.setItem('gdpr_cookie_consent', JSON.stringify(cookiePrefs));
        localStorage.setItem('gdpr_consent_date', new Date().toISOString());
        
        // Set actual cookies
        setCookie('gdpr_consent', JSON.stringify(cookiePrefs), 365);
        
        // Set category-specific cookies
        if (cookiePrefs.analytics) {
          setCookie('ga_consent', 'granted', 365);
        }
        if (cookiePrefs.marketing) {
          setCookie('fb_consent', 'granted', 365);
        }
      }
    } catch (error) {
      console.error('Error saving cookie preferences:', error);
    }
  };

  const generateConsentString = (necessary: boolean, pref: boolean, analytics: boolean, marketing: boolean): string => {
    // IAB TCF 2.0 compliant consent string generation
    const consentData = {
      v: '2.0',
      t: new Date().toISOString(),
      cmp: 'yogaspa',
      purposes: {
        1: necessary, // Storage and access
        2: pref,      // Personalization
        3: analytics, // Analytics
        4: marketing  // Marketing
      },
      vendors: {
        google: analytics,
        facebook: marketing,
        stripe: necessary
      }
    };
    
    return btoa(JSON.stringify(consentData));
  };

  const setCookie = (name: string, value: string, days: number) => {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = `expires=${date.toUTCString()}`;
    document.cookie = `${name}=${value}; ${expires}; path=/; SameSite=Lax; Secure`;
  };

  const detectCountry = async (): Promise<string> => {
    try {
      const response = await fetch('https://ipapi.co/country/');
      return await response.text();
    } catch {
      return 'US';
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      <div className="bg-white border-t border-gray-200 shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            {/* Banner Content */}
            <div className="flex-1">
              <div className="flex items-start">
                <div className="flex-shrink-0 pt-1">
                  <Cookie className="h-8 w-8 text-blue-600" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Your Privacy Choices
                  </h3>
                  <div className="mt-2 text-sm text-gray-600">
                    <p>
                      We use cookies and similar technologies to provide and improve our services, 
                      personalize content, and analyze traffic. By clicking "Accept All", you agree 
                      to our use of all cookies. You can manage your preferences at any time.
                    </p>
                    <div className="mt-3 flex items-center text-sm">
                      <Shield className="h-4 w-4 text-green-600 mr-1" />
                      <span className="text-green-700 font-medium">GDPR & CCPA Compliant</span>
                      <button
                        onClick={handleCustomize}
                        className="ml-4 text-blue-600 hover:text-blue-800 flex items-center"
                      >
                        <Info className="h-4 w-4 mr-1" />
                        Learn more
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Detailed Preferences - Collapsible */}
              {showDetails && (
                <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h4 className="font-medium text-gray-900 mb-4">Cookie Preferences</h4>
                  
                  <div className="space-y-4">
                    {/* Necessary Cookies - Always enabled */}
                    <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div>
                        <div className="flex items-center">
                          <Shield className="h-5 w-5 text-blue-600 mr-2" />
                          <span className="font-medium text-gray-900">Necessary Cookies</span>
                          <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                            Always Active
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          Essential for website functionality. Cannot be disabled.
                        </p>
                      </div>
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={true}
                          disabled
                          className="h-5 w-5 text-blue-600 rounded border-gray-300"
                        />
                      </div>
                    </div>

                    {/* Preference Cookies */}
                    <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                      <div>
                        <div className="flex items-center">
                          <Settings className="h-5 w-5 text-purple-600 mr-2" />
                          <span className="font-medium text-gray-900">Preference Cookies</span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          Remember your settings and preferences
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={preferences.preferences}
                          onChange={(e) => setPreferences({...preferences, preferences: e.target.checked})}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                      </label>
                    </div>

                    {/* Analytics Cookies */}
                    <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                      <div>
                        <div className="flex items-center">
                          <div className="h-5 w-5 bg-green-100 rounded-full flex items-center justify-center mr-2">
                            <span className="text-green-800 text-xs font-bold">A</span>
                          </div>
                          <span className="font-medium text-gray-900">Analytics Cookies</span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          Help us understand how visitors interact with our website
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={preferences.analytics}
                          onChange={(e) => setPreferences({...preferences, analytics: e.target.checked})}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                      </label>
                    </div>

                    {/* Marketing Cookies */}
                    <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                      <div>
                        <div className="flex items-center">
                          <div className="h-5 w-5 bg-red-100 rounded-full flex items-center justify-center mr-2">
                            <span className="text-red-800 text-xs font-bold">M</span>
                          </div>
                          <span className="font-medium text-gray-900">Marketing Cookies</span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          Used to deliver relevant advertisements
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={preferences.marketing}
                          onChange={(e) => setPreferences({...preferences, marketing: e.target.checked})}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleCustomize}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center justify-center"
              >
                <Settings className="h-4 w-4 mr-2" />
                Customize
              </button>
              
              <button
                onClick={handleAcceptNecessary}
                className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 flex items-center justify-center"
              >
                <X className="h-4 w-4 mr-2" />
                Reject All
              </button>
              
              <button
                onClick={handleAcceptAll}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center"
              >
                <Check className="h-4 w-4 mr-2" />
                Accept All
              </button>
            </div>
          </div>

          {/* Privacy Links */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="flex flex-wrap gap-4 text-sm">
              <a 
                href="/privacy/policy" 
                className="text-blue-600 hover:text-blue-800 hover:underline"
              >
                Privacy Policy
              </a>
              <a 
                href="/privacy/cookies" 
                className="text-blue-600 hover:text-blue-800 hover:underline"
              >
                Cookie Policy
              </a>
              <a 
                href="/privacy/rights" 
                className="text-blue-600 hover:text-blue-800 hover:underline"
              >
                Your Rights
              </a>
              <a 
                href="/privacy/dpa" 
                className="text-blue-600 hover:text-blue-800 hover:underline"
              >
                Data Processing Agreement
              </a>
              <a 
                href="mailto:dpo@yogaspa.com" 
                className="text-blue-600 hover:text-blue-800 hover:underline"
              >
                Contact DPO
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}