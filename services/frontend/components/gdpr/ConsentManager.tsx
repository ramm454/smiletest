'use client';

import { useState, useEffect } from 'react';
import { Shield, Download, Trash2, Check, X, AlertTriangle } from 'lucide-react';

interface ConsentSettings {
  marketing_email: boolean;
  marketing_sms: boolean;
  marketing_push: boolean;
  analytics: boolean;
  third_party_sharing: boolean;
}

interface GDPRRequest {
  id: string;
  type: 'access' | 'deletion' | 'correction';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  submittedAt: string;
  completedAt?: string;
}

export default function ConsentManager() {
  const [consent, setConsent] = useState<ConsentSettings>({
    marketing_email: false,
    marketing_sms: false,
    marketing_push: false,
    analytics: false,
    third_party_sharing: false,
  });
  const [requests, setRequests] = useState<GDPRRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');

  useEffect(() => {
    fetchConsent();
    fetchRequests();
  }, []);

  const fetchConsent = async () => {
    try {
      const response = await fetch('/api/gdpr/consent');
      const data = await response.json();
      setConsent(data);
    } catch (error) {
      console.error('Failed to fetch consent:', error);
    }
  };

  const fetchRequests = async () => {
    try {
      const response = await fetch('/api/gdpr/requests');
      const data = await response.json();
      setRequests(data.requests);
    } catch (error) {
      console.error('Failed to fetch requests:', error);
    }
  };

  const updateConsent = async (updates: Partial<ConsentSettings>) => {
    setLoading(true);
    try {
      const response = await fetch('/api/gdpr/consent', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setConsent(prev => ({ ...prev, ...updates }));
        alert('Consent preferences updated successfully');
      }
    } catch (error) {
      console.error('Failed to update consent:', error);
      alert('Failed to update consent preferences');
    } finally {
      setLoading(false);
    }
  };

  const requestDataExport = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/gdpr/export?format=json');
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `my-data-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        // Log the request
        await fetch('/api/gdpr/requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'access' }),
        });
        
        fetchRequests();
      }
    } catch (error) {
      console.error('Failed to export data:', error);
      alert('Failed to export data');
    } finally {
      setLoading(false);
    }
  };

  const requestDataDeletion = async () => {
    if (!deleteReason.trim()) {
      alert('Please provide a reason for deletion');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/gdpr/data', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: deleteReason,
          confirm: false, // First step - will require confirmation
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'pending_confirmation') {
          const code = prompt('Please enter the confirmation code sent to your email:');
          if (code) {
            await confirmDeletion(code);
          }
        }
        setShowDeleteConfirm(false);
        setDeleteReason('');
      }
    } catch (error) {
      console.error('Failed to request deletion:', error);
      alert('Failed to request data deletion');
    } finally {
      setLoading(false);
    }
  };

  const confirmDeletion = async (code: string) => {
    try {
      const response = await fetch('/api/gdpr/data/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      
      if (response.ok) {
        alert('Your data deletion request has been submitted. You will receive confirmation when completed.');
        fetchRequests();
      }
    } catch (error) {
      console.error('Failed to confirm deletion:', error);
      alert('Failed to confirm deletion');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2 flex items-center">
          <Shield className="mr-3 text-blue-600" />
          Data Privacy & Consent
        </h1>
        <p className="text-gray-600">
          Manage your data privacy settings according to GDPR regulations
        </p>
      </div>

      {/* Consent Categories */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Consent Preferences</h2>
        <div className="space-y-4">
          {[
            {
              key: 'marketing_email',
              label: 'Marketing Emails',
              description: 'Receive promotional emails, offers, and newsletters',
              required: false,
            },
            {
              key: 'marketing_sms',
              label: 'Marketing SMS',
              description: 'Receive promotional text messages',
              required: false,
            },
            {
              key: 'analytics',
              label: 'Analytics',
              description: 'Allow us to use your data for analytics and improvement',
              required: false,
            },
            {
              key: 'third_party_sharing',
              label: 'Third-Party Sharing',
              description: 'Allow sharing of your data with trusted partners',
              required: false,
            },
          ].map((category) => (
            <div key={category.key} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex-1">
                <div className="flex items-center">
                  <h3 className="font-medium">{category.label}</h3>
                  {category.required && (
                    <span className="ml-2 px-2 py-1 text-xs bg-red-100 text-red-800 rounded">Required</span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-1">{category.description}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={consent[category.key as keyof ConsentSettings]}
                  onChange={(e) => updateConsent({ [category.key]: e.target.checked })}
                  disabled={category.required || loading}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-disabled:opacity-50"></div>
              </label>
            </div>
          ))}
        </div>
        
        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-700">
            <strong>Note:</strong> Transactional emails (booking confirmations, password resets) are essential and cannot be disabled.
          </p>
        </div>
      </div>

      {/* GDPR Rights */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Your GDPR Rights</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Right to Access */}
          <div className="p-4 border border-gray-200 rounded-lg">
            <div className="flex items-center mb-3">
              <Download className="mr-3 text-green-600" />
              <h3 className="font-medium">Right to Access</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Download a copy of all personal data we hold about you
            </p>
            <button
              onClick={requestDataExport}
              disabled={loading}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center"
            >
              <Download size={16} className="mr-2" />
              Export My Data
            </button>
          </div>

          {/* Right to Erasure */}
          <div className="p-4 border border-gray-200 rounded-lg">
            <div className="flex items-center mb-3">
              <Trash2 className="mr-3 text-red-600" />
              <h3 className="font-medium">Right to Erasure</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Request deletion of all your personal data from our systems
            </p>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={loading}
              className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center"
            >
              <Trash2 size={16} className="mr-2" />
              Request Data Deletion
            </button>
          </div>
        </div>
      </div>

      {/* Active Requests */}
      {requests.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Active Requests</h2>
          <div className="space-y-3">
            {requests.map((request) => (
              <div key={request.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                <div>
                  <div className="flex items-center">
                    <span className="font-medium capitalize">{request.type} Request</span>
                    <span className={`ml-3 px-2 py-1 text-xs rounded-full ${
                      request.status === 'completed' ? 'bg-green-100 text-green-800' :
                      request.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {request.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">
                    Submitted: {new Date(request.submittedAt).toLocaleDateString()}
                    {request.completedAt && ` • Completed: ${new Date(request.completedAt).toLocaleDateString()}`}
                  </p>
                </div>
                {request.status === 'completed' && request.type === 'access' && (
                  <button
                    onClick={() => window.open(`/api/gdpr/download/${request.id}`, '_blank')}
                    className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                  >
                    Download
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Data Deletion Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <AlertTriangle className="mr-3 text-red-600" />
              <h3 className="text-lg font-semibold">Confirm Data Deletion</h3>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-700 mb-4">
                This action will permanently delete all your personal data from our systems. This includes:
              </p>
              <ul className="list-disc list-inside text-gray-600 text-sm mb-4 space-y-1">
                <li>Your profile information</li>
                <li>Booking history</li>
                <li>Payment history</li>
                <li>Notification preferences</li>
                <li>All other personal data</li>
              </ul>
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700 text-sm">
                  <strong>Warning:</strong> This action cannot be undone. You will lose access to all your booking history and account features.
                </p>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for deletion (optional):
              </label>
              <textarea
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg"
                rows={3}
                placeholder="Please let us know why you're deleting your data..."
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteReason('');
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={requestDataDeletion}
                disabled={loading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center"
              >
                {loading ? 'Processing...' : 'Confirm Deletion'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Privacy Policy Link */}
      <div className="mt-8 text-center">
        <p className="text-gray-600 text-sm">
          For more information, please read our{' '}
          <a href="/privacy-policy" className="text-blue-600 hover:underline">
            Privacy Policy
          </a>{' '}
          and{' '}
          <a href="/terms-of-service" className="text-blue-600 hover:underline">
            Terms of Service
          </a>
        </p>
      </div>
    </div>
  );
}