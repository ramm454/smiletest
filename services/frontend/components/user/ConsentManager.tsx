'use client';
import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, FileText, Shield, Cookie, Bell } from 'lucide-react';

interface Consent {
  id: string;
  consentType: string;
  version: string;
  granted: boolean;
  grantedAt?: string;
  required?: boolean;
  description: string;
}

export default function ConsentManager() {
  const [consents, setConsents] = useState<Consent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadConsents();
  }, []);

  const loadConsents = async () => {
    try {
      const response = await fetch('/api/user?endpoint=consent');
      if (response.ok) {
        const data = await response.json();
        setConsents(data);
      }
    } catch (error) {
      console.error('Error loading consents:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateConsent = async (consentType: string, granted: boolean) => {
    setSaving(true);
    try {
      const response = await fetch('/api/user?endpoint=consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consentType,
          version: consents.find(c => c.consentType === consentType)?.version || '1.0',
          granted,
          ipAddress: await getClientIP()
        })
      });
      
      if (response.ok) {
        setConsents(prev => 
          prev.map(c => c.consentType === consentType ? { ...c, granted } : c)
        );
      }
    } catch (error) {
      console.error('Error updating consent:', error);
    } finally {
      setSaving(false);
    }
  };

  const getClientIP = async () => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch {
      return 'unknown';
    }
  };

  const consentTypes = [
    {
      id: 'privacy_policy',
      name: 'Privacy Policy',
      icon: Shield,
      required: true,
      description: 'Agreement to our privacy practices and data handling',
      defaultGranted: true
    },
    {
      id: 'terms_of_service',
      name: 'Terms of Service',
      icon: FileText,
      required: true,
      description: 'Acceptance of our terms and conditions',
      defaultGranted: true
    },
    {
      id: 'marketing_emails',
      name: 'Marketing Emails',
      icon: Bell,
      required: false,
      description: 'Receive promotional emails and updates',
      defaultGranted: false
    },
    {
      id: 'cookies',
      name: 'Cookie Preferences',
      icon: Cookie,
      required: false,
      description: 'Accept non-essential cookies for analytics',
      defaultGranted: false
    },
    {
      id: 'data_processing',
      name: 'Data Processing',
      icon: Shield,
      required: false,
      description: 'Allow processing of personal data for service improvement',
      defaultGranted: false
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800">Consent Management</h2>
        <p className="text-gray-600 mt-2">
          Control your privacy preferences and data sharing settings
        </p>
      </div>

      <div className="space-y-4">
        {consentTypes.map((consentType) => {
          const consent = consents.find(c => c.consentType === consentType.id);
          const Icon = consentType.icon;
          const isGranted = consent?.granted ?? consentType.defaultGranted;
          
          return (
            <div key={consentType.id} className="p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center">
                  <div className={`p-2 rounded-full mr-3 ${isGranted ? 'bg-green-100' : 'bg-gray-100'}`}>
                    <Icon size={20} className={isGranted ? 'text-green-600' : 'text-gray-600'} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">{consentType.name}</h3>
                    <p className="text-sm text-gray-600">{consentType.description}</p>
                  </div>
                </div>
                
                <div className="flex items-center">
                  {consentType.required ? (
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                      Required
                    </span>
                  ) : (
                    <div className="flex items-center space-x-4">
                      <button
                        onClick={() => updateConsent(consentType.id, true)}
                        disabled={saving || isGranted}
                        className={`px-4 py-2 rounded-lg flex items-center ${
                          isGranted
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        <CheckCircle size={16} className="mr-2" />
                        Allow
                      </button>
                      
                      <button
                        onClick={() => updateConsent(consentType.id, false)}
                        disabled={saving || !isGranted}
                        className={`px-4 py-2 rounded-lg flex items-center ${
                          !isGranted
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        <XCircle size={16} className="mr-2" />
                        Deny
                      </button>
                    </div>
                  )}
                </div>
              </div>
              
              {consent && (
                <div className="text-xs text-gray-500 mt-2">
                  {consent.granted ? (
                    <span>✓ Granted on {new Date(consent.grantedAt).toLocaleDateString()}</span>
                  ) : (
                    <span>✗ Currently not granted</span>
                  )}
                  {consent.version && <span> • Version {consent.version}</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="font-semibold text-blue-800 mb-2">Your Data Rights</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>✓ Right to access your personal data</li>
          <li>✓ Right to correct inaccurate data</li>
          <li>✓ Right to delete your data (right to be forgotten)</li>
          <li>✓ Right to data portability</li>
          <li>✓ Right to withdraw consent at any time</li>
        </ul>
        <button className="mt-4 text-sm text-blue-600 hover:text-blue-800">
          Download your data →
        </button>
      </div>
    </div>
  );
}