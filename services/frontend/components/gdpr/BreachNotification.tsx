'use client';
import { useState } from 'react';
import {
  AlertTriangle,
  Shield,
  Clock,
  Mail,
  Phone,
  FileText,
  Download,
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react';

interface BreachNotificationProps {
  breachId: string;
  userId?: string;
}

export default function BreachNotification({ breachId, userId }: BreachNotificationProps) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [loading, setLoading] = useState(false);

  // Mock breach data - in production, this would come from API
  const breachData = {
    id: breachId,
    type: 'UNAUTHORIZED_ACCESS',
    discovered: '2024-01-15T10:30:00Z',
    affectedData: ['email', 'name', 'phone_number'],
    riskLevel: 'MEDIUM',
    actionsTaken: [
      'Reset affected user passwords',
      'Enhanced monitoring systems',
      'Security audit completed'
    ],
    recommendations: [
      'Change your password if you haven\'t recently',
      'Enable two-factor authentication',
      'Monitor your account for suspicious activity'
    ],
    contact: {
      dpo: 'dpo@yogaspa.com',
      phone: '+1 (555) 123-4567',
      hours: 'Mon-Fri, 9am-5pm EST'
    }
  };

  const handleAcknowledge = async () => {
    setLoading(true);
    try {
      // Record acknowledgment
      const response = await fetch('/api/user?endpoint=breach-acknowledge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(userId ? { 'Authorization': `Bearer ${localStorage.getItem('token')}` } : {})
        },
        body: JSON.stringify({ breachId })
      });

      if (response.ok) {
        setAcknowledged(true);
      }
    } catch (error) {
      console.error('Error acknowledging breach:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'HIGH': return 'bg-red-100 text-red-800 border-red-300';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'LOW': return 'bg-green-100 text-green-800 border-green-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      {/* Critical Alert Banner */}
      <div className="bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-xl shadow-lg mb-8 overflow-hidden">
        <div className="p-6">
          <div className="flex items-center">
            <AlertTriangle className="h-10 w-10 mr-4 animate-pulse" />
            <div className="flex-1">
              <h1 className="text-2xl font-bold">Important Security Notice</h1>
              <p className="text-red-100 mt-1">
                Notification of Data Security Incident
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm">Reference ID</div>
              <div className="font-mono font-bold">{breachData.id}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="border-b border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Data Security Incident Notification</h2>
              <p className="text-gray-600 mt-1">
                In accordance with GDPR Article 34
              </p>
            </div>
            <div className={`px-4 py-2 rounded-full border font-medium ${getRiskColor(breachData.riskLevel)}`}>
              {breachData.riskLevel} RISK
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-8">
          {/* What Happened */}
          <Section title="What Happened">
            <div className="space-y-4">
              <div className="flex items-start">
                <Clock className="h-5 w-5 text-gray-400 mt-0.5 mr-3" />
                <div>
                  <p className="font-medium text-gray-900">Incident Discovered</p>
                  <p className="text-gray-600">
                    {new Date(breachData.discovered).toLocaleDateString()} at{' '}
                    {new Date(breachData.discovered).toLocaleTimeString()}
                  </p>
                </div>
              </div>
              
              <div className="flex items-start">
                <Shield className="h-5 w-5 text-gray-400 mt-0.5 mr-3" />
                <div>
                  <p className="font-medium text-gray-900">Incident Type</p>
                  <p className="text-gray-600">Unauthorized access to our systems</p>
                </div>
              </div>
            </div>
          </Section>

          {/* Affected Data */}
          <Section title="What Information Was Involved">
            <div className="space-y-3">
              <p className="text-gray-700">
                The following categories of personal information may have been accessed:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {breachData.affectedData.map((data, index) => (
                  <div key={index} className="flex items-center p-3 bg-gray-50 rounded border">
                    <div className="w-2 h-2 bg-red-500 rounded-full mr-3"></div>
                    <span className="font-medium text-gray-900 capitalize">{data.replace('_', ' ')}</span>
                  </div>
                ))}
              </div>
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start">
                  <AlertCircle className="h-5 w-5 text-blue-600 mr-3 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-900">Important Note</p>
                    <p className="text-blue-700 text-sm mt-1">
                      Based on our investigation, we have no evidence that your information has been misused.
                      We are providing this notice as a precautionary measure.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Section>

          {/* Actions Taken */}
          <Section title="What We're Doing">
            <div className="space-y-4">
              <p className="text-gray-700">
                We immediately took steps to contain the incident and protect your information:
              </p>
              <div className="space-y-3">
                {breachData.actionsTaken.map((action, index) => (
                  <div key={index} className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
                    <span className="text-gray-900">{action}</span>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          {/* Recommendations */}
          <Section title="What You Can Do">
            <div className="space-y-4">
              <p className="text-gray-700">
                We recommend you take the following steps to protect your information:
              </p>
              <div className="space-y-3">
                {breachData.recommendations.map((rec, index) => (
                  <div key={index} className="flex items-start p-3 bg-yellow-50 border border-yellow-200 rounded">
                    <Shield className="h-5 w-5 text-yellow-600 mr-3 mt-0.5" />
                    <span className="text-gray-900">{rec}</span>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          {/* Contact Information */}
          <Section title="For More Information">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 bg-gray-50 rounded-lg border">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                  <Mail className="h-5 w-5 text-gray-600 mr-2" />
                  Contact Our DPO
                </h4>
                <div className="space-y-2">
                  <p className="text-gray-700">{breachData.contact.dpo}</p>
                  <p className="text-sm text-gray-600">
                    Our Data Protection Officer is available to answer your questions
                  </p>
                </div>
              </div>
              
              <div className="p-4 bg-gray-50 rounded-lg border">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                  <Phone className="h-5 w-5 text-gray-600 mr-2" />
                  Support Hours
                </h4>
                <div className="space-y-2">
                  <p className="text-gray-700">{breachData.contact.phone}</p>
                  <p className="text-sm text-gray-600">{breachData.contact.hours}</p>
                </div>
              </div>
            </div>
          </Section>

          {/* Regulatory Information */}
          <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <h4 className="font-semibold text-purple-900 mb-2">Regulatory Compliance</h4>
            <p className="text-sm text-purple-700">
              This notification is issued in compliance with GDPR Article 34, which requires 
              notification of a personal data breach to data subjects without undue delay when 
              the breach is likely to result in a high risk to their rights and freedoms.
            </p>
          </div>

          {/* Acknowledgment */}
          <div className="pt-6 border-t border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Acknowledgment</h4>
                <p className="text-sm text-gray-600">
                  Please acknowledge receipt of this notification
                </p>
              </div>
              
              <div className="flex gap-4">
                <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center">
                  <Download className="h-4 w-4 mr-2" />
                  Download Notice
                </button>
                
                <button
                  onClick={handleAcknowledge}
                  disabled={loading || acknowledged}
                  className={`px-6 py-2 rounded-lg flex items-center ${
                    acknowledged
                      ? 'bg-green-100 text-green-800 border border-green-300'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Processing...
                    </>
                  ) : acknowledged ? (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Acknowledged
                    </>
                  ) : (
                    'I Acknowledge This Notice'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Notice */}
      <div className="mt-8 text-center">
        <p className="text-sm text-gray-600">
          This is an important security notification. Please do not ignore it.
        </p>
        <p className="text-xs text-gray-500 mt-2">
          Yoga Spa Platform • Data Protection Office • {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4 border-l-4 border-blue-500 pl-3">
        {title}
      </h3>
      <div>{children}</div>
    </div>
  );
}