'use client';

import { useState, useEffect } from 'react';
import { Cookie, X, Settings, ChevronDown } from 'lucide-react';

interface CookiePreferences {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
  preferences: boolean;
}

export default function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    necessary: true,
    analytics: false,
    marketing: false,
    preferences: false,
  });

  useEffect(() => {
    const hasConsent = localStorage.getItem('cookie-consent');
    if (!hasConsent) {
      setShowBanner(true);
    } else {
      const savedPrefs = JSON.parse(hasConsent);
      setPreferences(savedPrefs);
    }
  }, []);

  const acceptAll = () => {
    const allAccepted = {
      necessary: true,
      analytics: true,
      marketing: true,
      preferences: true,
    };
    setPreferences(allAccepted);
    localStorage.setItem('cookie-consent', JSON.stringify(allAccepted));
    setShowBanner(false);
    setShowSettings(false);
  };

  const acceptNecessary = () => {
    const necessaryOnly = {
      necessary: true,
      analytics: false,
      marketing: false,
      preferences: false,
    };
    setPreferences(necessaryOnly);
    localStorage.setItem('cookie-consent', JSON.stringify(necessaryOnly));
    setShowBanner(false);
    setShowSettings(false);
  };

  const savePreferences = () => {
    localStorage.setItem('cookie-consent', JSON.stringify(preferences));
    setShowBanner(false);
    setShowSettings(false);
  };

  const updatePreference = (key: keyof CookiePreferences, value: boolean) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
  };

  if (!showBanner && !showSettings) {
    return (
      <button
        onClick={() => setShowSettings(true)}
        className="fixed bottom-4 right-4 p-3 bg-white border border-gray-300 rounded-lg shadow-lg hover:bg-gray-50 z-40"
        title="Cookie Settings"
      >
        <Cookie size={20} />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end justify-center p-4 md:items-center">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Cookie className="mr-3 text-blue-600" />
              <div>
                <h2 className="text-lg font-semibold">Cookie Consent</h2>
                <p className="text-sm text-gray-600">We use cookies to improve your experience</p>
              </div>
            </div>
            <button
              onClick={() => {
                setShowBanner(false);
                setShowSettings(false);
              }}
              className="p-2 hover:bg-gray-100 rounded-full"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="mb-6">
            <p className="text-gray-700">
              We use cookies and similar technologies to:
            </p>
            <ul className="list-disc list-inside text-gray-600 mt-2 space-y-1">
              <li>Enable essential website functions</li>
              <li>Remember your preferences</li>
              <li>Analyze website traffic</li>
              <li>Deliver personalized content</li>
            </ul>
          </div>

          {/* Cookie Categories */}
          <div className="space-y-4 mb-6">
            {/* Necessary Cookies */}
            <div className="p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="font-medium">Necessary Cookies</h3>
                  <p className="text-sm text-gray-600">Essential for website functionality</p>
                </div>
                <div className="flex items-center">
                  <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded mr-2">Always Active</span>
                  <input
                    type="checkbox"
                    checked={preferences.necessary}
                    disabled
                    className="h-5 w-5 text-blue-600 rounded"
                  />
                </div>
              </div>
              <p className="text-sm text-gray-500">
                These cookies are required for the website to function and cannot be switched off.
              </p>
            </div>

            {/* Analytics Cookies */}
            <div className="p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="font-medium">Analytics Cookies</h3>
                  <p className="text-sm text-gray-600">Help us improve our website</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences.analytics}
                    onChange={(e) => updatePreference('analytics', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              <p className="text-sm text-gray-500">
                These cookies allow us to analyze website usage to improve performance.
              </p>
            </div>

            {/* Marketing Cookies */}
            <div className="p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="font-medium">Marketing Cookies</h3>
                  <p className="text-sm text-gray-600">Used for personalized advertising</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences.marketing}
                    onChange={(e) => updatePreference('marketing', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              <p className="text-sm text-gray-500">
                These cookies are used to deliver relevant ads and measure ad performance.
              </p>
            </div>
          </div>

          {/* More Information */}
          <div className="mb-6">
            <details className="border border-gray-200 rounded-lg">
              <summary className="p-4 flex items-center justify-between cursor-pointer">
                <span className="font-medium">More Information</span>
                <ChevronDown className="transform transition-transform" />
              </summary>
              <div className="p-4 border-t border-gray-200 text-sm text-gray-600">
                <p className="mb-2">
                  You can learn more about how we use cookies by reading our{' '}
                  <a href="/cookie-policy" className="text-blue-600 hover:underline">Cookie Policy</a>.
                </p>
                <p>
                  For more details about your data rights, please see our{' '}
                  <a href="/privacy-policy" className="text-blue-600 hover:underline">Privacy Policy</a>.
                </p>
              </div>
            </details>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={acceptNecessary}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex-1"
            >
              Accept Necessary Only
            </button>
            <button
              onClick={acceptAll}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex-1"
            >
              Accept All Cookies
            </button>
            <button
              onClick={savePreferences}
              className="px-6 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-900 flex-1"
            >
              Save Preferences
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}