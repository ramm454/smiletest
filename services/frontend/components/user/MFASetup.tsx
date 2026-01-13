'use client';
import { useState, useEffect } from 'react';
import { Shield, Smartphone, Mail, Key, Copy, RefreshCw } from 'lucide-react';

interface MFASetupProps {
  onComplete?: () => void;
}

export default function MFASetup({ onComplete }: MFASetupProps) {
  const [method, setMethod] = useState<'app' | 'sms' | 'email'>('app');
  const [step, setStep] = useState<'select' | 'setup' | 'verify'>('select');
  const [qrCode, setQrCode] = useState<string>('');
  const [secret, setSecret] = useState<string>('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verificationCode, setVerificationCode] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const methods = [
    { id: 'app', name: 'Authenticator App', icon: Smartphone, description: 'Use apps like Google Authenticator or Authy' },
    { id: 'sms', name: 'SMS Text Message', icon: Mail, description: 'Receive codes via text message' },
    { id: 'email', name: 'Email', icon: Mail, description: 'Receive codes via email' }
  ];

  const handleSetupMFA = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/user?endpoint=mfa-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method })
      });
      
      if (!response.ok) throw new Error('Setup failed');
      
      const data = await response.json();
      
      if (method === 'app') {
        setQrCode(data.qrCodeUrl);
        setSecret(data.secret);
      }
      
      setBackupCodes(data.backupCodes || []);
      setStep('verify');
    } catch (error) {
      console.error('MFA setup error:', error);
      alert('Failed to setup MFA');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyMFA = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/user?endpoint=mfa-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          method, 
          code: verificationCode 
        })
      });
      
      if (!response.ok) throw new Error('Verification failed');
      
      alert('MFA setup completed successfully!');
      onComplete?.();
    } catch (error) {
      console.error('MFA verification error:', error);
      alert('Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const regenerateBackupCodes = async () => {
    try {
      const response = await fetch('/api/user?endpoint=mfa-backup-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) throw new Error('Failed to generate codes');
      
      const data = await response.json();
      setBackupCodes(data.backupCodes);
    } catch (error) {
      console.error('Error generating backup codes:', error);
    }
  };

  return (
    <div className="max-w-lg mx-auto p-6 bg-white rounded-xl shadow-lg">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
          <Shield size={32} className="text-blue-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800">Setup Multi-Factor Authentication</h2>
        <p className="text-gray-600 mt-2">Add an extra layer of security to your account</p>
      </div>

      {step === 'select' && (
        <>
          <div className="grid grid-cols-1 gap-4 mb-8">
            {methods.map((m) => {
              const Icon = m.icon;
              return (
                <button
                  key={m.id}
                  onClick={() => setMethod(m.id as any)}
                  className={`p-4 border rounded-lg text-left transition-colors ${
                    method === m.id 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center">
                    <div className={`p-2 rounded-full mr-4 ${
                      method === m.id ? 'bg-blue-100' : 'bg-gray-100'
                    }`}>
                      <Icon size={20} className={method === m.id ? 'text-blue-600' : 'text-gray-600'} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-800">{m.name}</h3>
                      <p className="text-sm text-gray-600">{m.description}</p>
                    </div>
                    {method === m.id && (
                      <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-white"></div>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {method === 'sms' && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg"
                placeholder="+1 (555) 123-4567"
              />
            </div>
          )}

          <button
            onClick={handleSetupMFA}
            disabled={loading || (method === 'sms' && !phoneNumber)}
            className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Setting up...' : 'Continue with ' + methods.find(m => m.id === method)?.name}
          </button>
        </>
      )}

      {step === 'verify' && method === 'app' && (
        <div className="space-y-6">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Scan QR Code</h3>
            {qrCode && (
              <div className="inline-block p-4 bg-white border border-gray-200 rounded-lg">
                <img src={qrCode} alt="QR Code" className="w-64 h-64" />
              </div>
            )}
            <p className="text-sm text-gray-600 mt-4">
              Scan with your authenticator app or enter code manually:
            </p>
            <div className="mt-2 p-3 bg-gray-100 rounded-lg font-mono text-center">
              {secret || 'Loading...'}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Enter 6-digit code from app
            </label>
            <input
              type="text"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full p-3 border border-gray-300 rounded-lg text-center text-2xl font-mono tracking-widest"
              placeholder="000000"
              maxLength={6}
            />
          </div>

          <button
            onClick={handleVerifyMFA}
            disabled={loading || verificationCode.length !== 6}
            className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Verifying...' : 'Verify & Enable'}
          </button>
        </div>
      )}

      {step === 'verify' && backupCodes.length > 0 && (
        <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h4 className="font-semibold text-yellow-800 mb-2 flex items-center">
            <Key size={16} className="mr-2" />
            Backup Codes
          </h4>
          <p className="text-sm text-yellow-700 mb-3">
            Save these codes in a secure place. Each code can be used once.
          </p>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {backupCodes.map((code, index) => (
              <div key={index} className="p-2 bg-white border border-yellow-300 rounded text-center font-mono text-sm">
                {code}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={copyBackupCodes}
              className="flex-1 py-2 bg-yellow-100 text-yellow-800 rounded-lg hover:bg-yellow-200 flex items-center justify-center"
            >
              <Copy size={16} className="mr-2" />
              {copied ? 'Copied!' : 'Copy Codes'}
            </button>
            <button
              onClick={regenerateBackupCodes}
              className="flex-1 py-2 border border-yellow-300 text-yellow-800 rounded-lg hover:bg-yellow-100 flex items-center justify-center"
            >
              <RefreshCw size={16} className="mr-2" />
              Regenerate
            </button>
          </div>
        </div>
      )}
    </div>
  );
}