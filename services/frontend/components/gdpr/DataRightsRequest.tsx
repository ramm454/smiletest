'use client';
import { useState } from 'react';
import { 
  Download, 
  Edit, 
  Trash2, 
  Lock, 
  FileText, 
  User, 
  Shield, 
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Mail,
  Phone,
  IdCard
} from 'lucide-react';

interface DataRightsRequestProps {
  userId?: string;
  userEmail?: string;
}

type RequestType = 'ACCESS' | 'RECTIFICATION' | 'ERASURE' | 'PORTABILITY' | 'RESTRICTION' | 'OBJECTION';
type VerificationMethod = 'EMAIL' | 'SMS' | 'ID_DOCUMENT' | 'IN_PERSON';

export default function DataRightsRequest({ userId, userEmail }: DataRightsRequestProps) {
  const [step, setStep] = useState<'type' | 'details' | 'verification' | 'confirmation'>('type');
  const [requestType, setRequestType] = useState<RequestType>('ACCESS');
  const [verificationMethod, setVerificationMethod] = useState<VerificationMethod>('EMAIL');
  const [formData, setFormData] = useState({
    description: '',
    requestedData: [] as string[],
    justification: '',
    idDocument: '',
    phoneNumber: ''
  });
  const [loading, setLoading] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [requestId, setRequestId] = useState<string>('');

  const requestTypes = [
    {
      id: 'ACCESS',
      title: 'Right to Access',
      icon: FileText,
      description: 'Get a copy of all your personal data',
      color: 'bg-blue-100 text-blue-800',
      iconColor: 'text-blue-600',
      time: '30 days',
      legalRef: 'GDPR Article 15'
    },
    {
      id: 'RECTIFICATION',
      title: 'Right to Rectification',
      icon: Edit,
      description: 'Correct inaccurate or incomplete data',
      color: 'bg-green-100 text-green-800',
      iconColor: 'text-green-600',
      time: '30 days',
      legalRef: 'GDPR Article 16'
    },
    {
      id: 'ERASURE',
      title: 'Right to Erasure',
      icon: Trash2,
      description: 'Delete your personal data ("right to be forgotten")',
      color: 'bg-red-100 text-red-800',
      iconColor: 'text-red-600',
      time: '30 days',
      legalRef: 'GDPR Article 17'
    },
    {
      id: 'PORTABILITY',
      title: 'Right to Portability',
      icon: Download,
      description: 'Receive your data in machine-readable format',
      color: 'bg-purple-100 text-purple-800',
      iconColor: 'text-purple-600',
      time: '30 days',
      legalRef: 'GDPR Article 20'
    },
    {
      id: 'RESTRICTION',
      title: 'Restriction of Processing',
      icon: Lock,
      description: 'Temporarily restrict processing of your data',
      color: 'bg-yellow-100 text-yellow-800',
      iconColor: 'text-yellow-600',
      time: '30 days',
      legalRef: 'GDPR Article 18'
    },
    {
      id: 'OBJECTION',
      title: 'Right to Object',
      icon: Shield,
      description: 'Object to processing based on legitimate interests',
      color: 'bg-orange-100 text-orange-800',
      iconColor: 'text-orange-600',
      time: '30 days',
      legalRef: 'GDPR Article 21'
    }
  ];

  const dataFields = [
    { id: 'profile', label: 'Profile Information', category: 'Personal Data' },
    { id: 'contact', label: 'Contact Details', category: 'Personal Data' },
    { id: 'preferences', label: 'Preferences & Settings', category: 'Usage Data' },
    { id: 'bookings', label: 'Booking History', category: 'Transactional Data' },
    { id: 'payments', label: 'Payment Information', category: 'Financial Data' },
    { id: 'communications', label: 'Communications', category: 'Communication Data' },
    { id: 'locations', label: 'Location Data', category: 'Geolocation Data' },
    { id: 'device', label: 'Device Information', category: 'Technical Data' },
    { id: 'consents', label: 'Consent Records', category: 'Legal Data' },
    { id: 'activities', label: 'Activity Logs', category: 'Behavioral Data' }
  ];

  const handleSubmitRequest = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/user?endpoint=gdpr-request', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(userId ? { 'Authorization': `Bearer ${localStorage.getItem('token')}` } : {})
        },
        body: JSON.stringify({
          requestType,
          description: formData.description,
          requestedData: formData.requestedData,
          justification: formData.justification,
          verificationMethod,
          ...(verificationMethod === 'SMS' && { phoneNumber: formData.phoneNumber }),
          ...(verificationMethod === 'ID_DOCUMENT' && { idDocument: formData.idDocument })
        })
      });

      if (response.ok) {
        const data = await response.json();
        setRequestId(data.requestId);
        
        if (data.verificationRequired) {
          setStep('verification');
        } else {
          setStep('confirmation');
        }
      } else {
        throw new Error('Request failed');
      }
    } catch (error) {
      console.error('Error submitting request:', error);
      alert('Failed to submit request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyRequest = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/user?endpoint=gdpr-request/${requestId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verificationCode })
      });

      if (response.ok) {
        setStep('confirmation');
      } else {
        throw new Error('Verification failed');
      }
    } catch (error) {
      console.error('Error verifying request:', error);
      alert('Invalid verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFieldToggle = (fieldId: string) => {
    setFormData(prev => ({
      ...prev,
      requestedData: prev.requestedData.includes(fieldId)
        ? prev.requestedData.filter(id => id !== fieldId)
        : [...prev.requestedData, fieldId]
    }));
  };

  const renderStep = () => {
    switch (step) {
      case 'type':
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900">Exercise Your Data Rights</h2>
              <p className="text-gray-600 mt-2">
                Under GDPR, you have several rights regarding your personal data
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {requestTypes.map((type) => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.id}
                    onClick={() => {
                      setRequestType(type.id as RequestType);
                      setStep('details');
                    }}
                    className={`p-4 border rounded-xl text-left transition-all hover:shadow-md ${
                      requestType === type.id 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start">
                      <div className={`p-3 rounded-lg ${type.color} mr-4`}>
                        <Icon className={`h-6 w-6 ${type.iconColor}`} />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{type.title}</h3>
                        <p className="text-sm text-gray-600 mt-1">{type.description}</p>
                        <div className="flex items-center justify-between mt-3">
                          <span className="text-xs font-medium px-2 py-1 bg-gray-100 rounded">
                            {type.time}
                          </span>
                          <span className="text-xs text-gray-500">{type.legalRef}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-yellow-600 mr-3" />
                <div>
                  <h4 className="font-medium text-gray-900">Need Help?</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Contact our Data Protection Officer at{' '}
                    <a href="mailto:dpo@yogaspa.com" className="text-blue-600 hover:underline">
                      dpo@yogaspa.com
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      case 'details':
        const selectedType = requestTypes.find(t => t.id === requestType);
        const Icon = selectedType?.icon || FileText;

        return (
          <div className="space-y-6">
            <button
              onClick={() => setStep('type')}
              className="flex items-center text-blue-600 hover:text-blue-800 mb-4"
            >
              ← Back to rights selection
            </button>

            <div className="flex items-center mb-6">
              <div className={`p-3 rounded-lg ${selectedType?.color} mr-4`}>
                <Icon className={`h-6 w-6 ${selectedType?.iconColor}`} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{selectedType?.title}</h2>
                <p className="text-gray-600">{selectedType?.description}</p>
              </div>
            </div>

            {/* Request-specific fields */}
            {requestType === 'ACCESS' && (
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900">Select Data to Access</h3>
                <p className="text-sm text-gray-600">
                  Choose which categories of your data you want to receive
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {dataFields.map((field) => (
                    <label
                      key={field.id}
                      className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                        formData.requestedData.includes(field.id)
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={formData.requestedData.includes(field.id)}
                        onChange={() => handleFieldToggle(field.id)}
                        className="h-4 w-4 text-blue-600 rounded border-gray-300"
                      />
                      <div className="ml-3">
                        <span className="font-medium text-gray-900">{field.label}</span>
                        <span className="block text-xs text-gray-500">{field.category}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {requestType === 'RECTIFICATION' && (
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900">What needs correction?</h3>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Describe what information is incorrect and what the correct information should be..."
                  className="w-full p-3 border border-gray-300 rounded-lg h-32"
                  required
                />
              </div>
            )}

            {requestType === 'ERASURE' && (
              <div className="space-y-4">
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center">
                    <AlertCircle className="h-5 w-5 text-red-600 mr-3" />
                    <div>
                      <h4 className="font-medium text-red-900">Important Notice</h4>
                      <p className="text-sm text-red-700 mt-1">
                        This action cannot be undone. Some data may be retained for legal obligations.
                        Account deletion may affect your access to purchased content.
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reason for Erasure (Optional)
                  </label>
                  <textarea
                    value={formData.justification}
                    onChange={(e) => setFormData({...formData, justification: e.target.value})}
                    placeholder="Help us understand your request better..."
                    className="w-full p-3 border border-gray-300 rounded-lg h-32"
                  />
                </div>
              </div>
            )}

            {requestType === 'PORTABILITY' && (
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900">Data Format</h3>
                <div className="grid grid-cols-2 gap-4">
                  <label className="flex items-center p-4 border border-gray-200 rounded-lg cursor-pointer">
                    <input
                      type="radio"
                      name="format"
                      value="json"
                      defaultChecked
                      className="h-4 w-4 text-blue-600"
                    />
                    <div className="ml-3">
                      <span className="font-medium text-gray-900">JSON</span>
                      <p className="text-sm text-gray-600">Machine-readable, structured data</p>
                    </div>
                  </label>
                  
                  <label className="flex items-center p-4 border border-gray-200 rounded-lg cursor-pointer">
                    <input
                      type="radio"
                      name="format"
                      value="csv"
                      className="h-4 w-4 text-blue-600"
                    />
                    <div className="ml-3">
                      <span className="font-medium text-gray-900">CSV</span>
                      <p className="text-sm text-gray-600">Spreadsheet compatible format</p>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {['OBJECTION', 'RESTRICTION'].includes(requestType) && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Justification (Required)
                </label>
                <textarea
                  value={formData.justification}
                  onChange={(e) => setFormData({...formData, justification: e.target.value})}
                  placeholder="Explain why you're objecting to or restricting data processing..."
                  className="w-full p-3 border border-gray-300 rounded-lg h-32"
                  required
                />
                <p className="text-xs text-gray-500 mt-2">
                  For objections based on legitimate interests, please explain your particular situation
                </p>
              </div>
            )}

            {/* Verification Method Selection */}
            <div className="pt-6 border-t border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-4">Verification Method</h3>
              <p className="text-sm text-gray-600 mb-4">
                For security, we need to verify your identity before processing this request
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <label className={`flex items-center p-4 border rounded-lg cursor-pointer ${
                  verificationMethod === 'EMAIL' 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:bg-gray-50'
                }`}>
                  <input
                    type="radio"
                    name="verification"
                    value="EMAIL"
                    checked={verificationMethod === 'EMAIL'}
                    onChange={() => setVerificationMethod('EMAIL')}
                    className="h-4 w-4 text-blue-600"
                  />
                  <div className="ml-3">
                    <div className="flex items-center">
                      <Mail className="h-5 w-5 text-gray-600 mr-2" />
                      <span className="font-medium text-gray-900">Email Verification</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      Verification code sent to {userEmail || 'your email'}
                    </p>
                  </div>
                </label>
                
                <label className={`flex items-center p-4 border rounded-lg cursor-pointer ${
                  verificationMethod === 'SMS' 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:bg-gray-50'
                }`}>
                  <input
                    type="radio"
                    name="verification"
                    value="SMS"
                    checked={verificationMethod === 'SMS'}
                    onChange={() => setVerificationMethod('SMS')}
                    className="h-4 w-4 text-blue-600"
                  />
                  <div className="ml-3">
                    <div className="flex items-center">
                      <Phone className="h-5 w-5 text-gray-600 mr-2" />
                      <span className="font-medium text-gray-900">SMS Verification</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      Code sent to your mobile phone
                    </p>
                    {verificationMethod === 'SMS' && (
                      <input
                        type="tel"
                        value={formData.phoneNumber}
                        onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})}
                        placeholder="Enter phone number"
                        className="mt-2 p-2 border border-gray-300 rounded w-full"
                      />
                    )}
                  </div>
                </label>
                
                <label className={`flex items-center p-4 border rounded-lg cursor-pointer ${
                  verificationMethod === 'ID_DOCUMENT' 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:bg-gray-50'
                }`}>
                  <input
                    type="radio"
                    name="verification"
                    value="ID_DOCUMENT"
                    checked={verificationMethod === 'ID_DOCUMENT'}
                    onChange={() => setVerificationMethod('ID_DOCUMENT')}
                    className="h-4 w-4 text-blue-600"
                  />
                  <div className="ml-3">
                    <div className="flex items-center">
                      <IdCard className="h-5 w-5 text-gray-600 mr-2" />
                      <span className="font-medium text-gray-900">ID Document</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      Upload a government-issued ID
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex justify-end pt-6">
              <button
                onClick={handleSubmitRequest}
                disabled={loading || (requestType === 'OBJECTION' && !formData.justification)}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
              >
                {loading ? 'Submitting...' : 'Submit Request'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </button>
            </div>
          </div>
        );

      case 'verification':
        return (
          <div className="max-w-md mx-auto text-center">
            <div className="mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                <Mail className="h-8 w-8 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Verify Your Identity</h2>
              <p className="text-gray-600 mt-2">
                We've sent a verification code to your{' '}
                {verificationMethod === 'EMAIL' ? 'email' : 'phone'}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enter 6-digit verification code
                </label>
                <input
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full p-4 border border-gray-300 rounded-lg text-center text-2xl font-mono tracking-widest"
                  placeholder="000000"
                  maxLength={6}
                />
              </div>

              <div className="text-sm text-gray-600">
                <p>Request ID: <span className="font-mono">{requestId}</span></p>
                <p className="mt-2">
                  Didn't receive the code?{' '}
                  <button className="text-blue-600 hover:text-blue-800">
                    Resend code
                  </button>
                </p>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => setStep('details')}
                  className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  onClick={handleVerifyRequest}
                  disabled={loading || verificationCode.length !== 6}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Verifying...' : 'Verify & Submit'}
                </button>
              </div>
            </div>
          </div>
        );

      case 'confirmation':
        return (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Request Submitted Successfully!</h2>
            <p className="text-gray-600 mt-2 max-w-md mx-auto">
              Your {requestTypes.find(t => t.id === requestType)?.title?.toLowerCase()} request has been received.
            </p>

            <div className="mt-8 p-6 bg-gray-50 rounded-xl border border-gray-200 max-w-md mx-auto">
              <h3 className="font-semibold text-gray-900 mb-4">Request Details</h3>
              <div className="space-y-3 text-left">
                <div className="flex justify-between">
                  <span className="text-gray-600">Request ID:</span>
                  <span className="font-mono">{requestId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Type:</span>
                  <span>{requestTypes.find(t => t.id === requestType)?.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Submitted:</span>
                  <span>{new Date().toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Deadline:</span>
                  <span className="font-medium text-blue-600">
                    {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-8 space-y-4">
              <p className="text-gray-600">
                You'll receive updates on your request via email. You can track the status in your privacy dashboard.
              </p>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => {
                    setStep('type');
                    setRequestId('');
                    setVerificationCode('');
                  }}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Submit Another Request
                </button>
                <button
                  onClick={() => window.location.href = '/privacy/dashboard'}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Go to Privacy Dashboard
                </button>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-xl shadow-lg p-6 md:p-8">
        {renderStep()}
      </div>
    </div>
  );
}