'use client';
import { useState, useEffect } from 'react';
import { 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Download, 
  Clock, 
  Users, 
  Shield,
  Globe,
  Lock,
  Mail
} from 'lucide-react';

interface DataProcessingAgreementProps {
  userId?: string;
  onAccept?: (agreementId: string) => void;
  onDecline?: () => void;
}

export default function DataProcessingAgreement({ userId, onAccept, onDecline }: DataProcessingAgreementProps) {
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentAgreement, setCurrentAgreement] = useState<any>(null);
  const [signature, setSignature] = useState('');

  useEffect(() => {
    loadCurrentAgreement();
  }, []);

  const loadCurrentAgreement = async () => {
    try {
      const response = await fetch('/api/user?endpoint=dpa-latest');
      if (response.ok) {
        const data = await response.json();
        setCurrentAgreement(data);
      }
    } catch (error) {
      console.error('Error loading DPA:', error);
    }
  };

  const handleAcceptAgreement = async () => {
    if (!agreed) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/user?endpoint=dpa-accept', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(userId ? { 'Authorization': `Bearer ${localStorage.getItem('token')}` } : {})
        },
        body: JSON.stringify({
          version: currentAgreement.version,
          signature,
          ipAddress: await getClientIP()
        })
      });

      if (response.ok) {
        const data = await response.json();
        onAccept?.(data.agreementId);
      }
    } catch (error) {
      console.error('Error accepting DPA:', error);
    } finally {
      setLoading(false);
    }
  };

  const getClientIP = async (): Promise<string> => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch {
      return 'unknown';
    }
  };

  if (!currentAgreement) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Data Processing Agreement</h1>
              <p className="text-blue-100 mt-2">Version {currentAgreement.version} • Effective {new Date(currentAgreement.effectiveDate).toLocaleDateString()}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-lg">
              <FileText className="h-10 w-10" />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-8">
          {/* Key Information */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center">
                <Users className="h-5 w-5 text-blue-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-blue-900">Parties</p>
                  <p className="text-lg font-bold text-blue-800">Controller & Processor</p>
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center">
                <Globe className="h-5 w-5 text-green-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-green-900">Jurisdiction</p>
                  <p className="text-lg font-bold text-green-800">European Union</p>
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="flex items-center">
                <Lock className="h-5 w-5 text-purple-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-purple-900">Security Standard</p>
                  <p className="text-lg font-bold text-purple-800">ISO 27001 Certified</p>
                </div>
              </div>
            </div>
          </div>

          {/* Agreement Sections */}
          <div className="space-y-8 max-h-[500px] overflow-y-auto pr-4">
            {currentAgreement.sections?.map((section: any, index: number) => (
              <div key={index} className="border-b border-gray-200 pb-8 last:border-0">
                <h3 className="text-xl font-bold text-gray-900 mb-4">
                  {section.title}
                </h3>
                <div className="prose prose-blue max-w-none">
                  {section.content}
                </div>
              </div>
            )) || (
              <div className="space-y-6">
                <Section title="1. Definitions">
                  <p>"Personal Data" means any information relating to an identified or identifiable natural person.</p>
                  <p>"Processing" means any operation performed on Personal Data.</p>
                  <p>"Data Subject" means the individual to whom Personal Data relates.</p>
                </Section>

                <Section title="2. Processing Details">
                  <ul className="list-disc pl-5 space-y-2">
                    <li><strong>Subject Matter:</strong> Provision of yoga and wellness services</li>
                    <li><strong>Duration:</strong> Duration of the service agreement</li>
                    <li><strong>Nature & Purpose:</strong> Service delivery, account management, communications</li>
                    <li><strong>Data Categories:</strong> Identity, contact, health preferences, payment information</li>
                    <li><strong>Data Subjects:</strong> Customers, prospective customers, website visitors</li>
                  </ul>
                </Section>

                <Section title="3. Security Measures">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-3 bg-gray-50 rounded border">
                      <p className="font-medium">Technical Measures</p>
                      <p className="text-sm text-gray-600">Encryption, access controls, regular security testing</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded border">
                      <p className="font-medium">Organizational Measures</p>
                      <p className="text-sm text-gray-600">Staff training, confidentiality agreements, incident response</p>
                    </div>
                  </div>
                </Section>

                <Section title="4. Sub-processors">
                  <p>We use the following sub-processors to provide our services:</p>
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between p-3 border rounded">
                      <span>AWS</span>
                      <span className="text-sm text-gray-600">Cloud Infrastructure</span>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded">
                      <span>Stripe</span>
                      <span className="text-sm text-gray-600">Payment Processing</span>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded">
                      <span>SendGrid</span>
                      <span className="text-sm text-gray-600">Email Services</span>
                    </div>
                  </div>
                </Section>

                <Section title="5. Data Subject Rights">
                  <p>We will assist you in fulfilling data subject requests in accordance with GDPR Articles 15-22.</p>
                </Section>

                <Section title="6. Data Breach Notification">
                  <p>We will notify you without undue delay after becoming aware of a Personal Data breach.</p>
                </Section>

                <Section title="7. International Transfers">
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
                    <div className="flex items-center">
                      <AlertCircle className="h-5 w-5 text-yellow-600 mr-3" />
                      <div>
                        <p className="font-medium text-yellow-900">Standard Contractual Clauses</p>
                        <p className="text-sm text-yellow-700">
                          All international data transfers are protected by EU Standard Contractual Clauses
                        </p>
                      </div>
                    </div>
                  </div>
                </Section>
              </div>
            )}
          </div>

          {/* Acceptance Section */}
          <div className="mt-12 p-6 bg-gray-50 border border-gray-200 rounded-xl">
            <div className="flex items-start mb-6">
              <CheckCircle className="h-6 w-6 text-green-600 mr-3 mt-1" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Accept Agreement</h3>
                <p className="text-gray-600 mt-1">
                  By accepting this agreement, you acknowledge that you have read and understood 
                  the terms of this Data Processing Agreement.
                </p>
              </div>
            </div>

            {/* Signature */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Electronic Signature
              </label>
              <input
                type="text"
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                placeholder="Type your full name to sign"
                className="w-full p-3 border border-gray-300 rounded-lg"
                required
              />
              <p className="text-xs text-gray-500 mt-2">
                By typing your name, you are signing this agreement electronically
              </p>
            </div>

            {/* Consent Checkbox */}
            <div className="mb-6">
              <label className="flex items-start">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="h-5 w-5 text-blue-600 rounded border-gray-300 mt-1 mr-3"
                  required
                />
                <div>
                  <p className="font-medium text-gray-900">
                    I accept the terms of this Data Processing Agreement
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    I acknowledge that I have read and understood this agreement and agree to be 
                    bound by its terms. I understand that this agreement is legally binding.
                  </p>
                </div>
              </label>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={onDecline}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Decline
              </button>
              
              <button
                onClick={handleAcceptAgreement}
                disabled={loading || !agreed || !signature.trim()}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex-1"
              >
                {loading ? 'Processing...' : 'Accept & Continue'}
              </button>
              
              <button
                onClick={() => window.open('/documents/dpa.pdf', '_blank')}
                className="px-6 py-3 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 flex items-center justify-center"
              >
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </button>
            </div>

            {/* Legal Notice */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex items-center text-sm text-gray-600">
                <Clock className="h-4 w-4 mr-2" />
                <p>
                  This agreement will be stored for a minimum of 10 years in accordance with legal requirements.
                  For questions, contact our Data Protection Officer at{' '}
                  <a href="mailto:dpo@yogaspa.com" className="text-blue-600 hover:underline">
                    dpo@yogaspa.com
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-3">{title}</h3>
      <div className="text-gray-700">{children}</div>
    </div>
  );
}