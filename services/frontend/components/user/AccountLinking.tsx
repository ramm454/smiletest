'use client';
import { useState, useEffect } from 'react';
import { 
  Mail, 
  Github, 
  Facebook, 
  Apple, 
  Link as LinkIcon, 
  Unlink, 
  CheckCircle,
  ExternalLink,
  Shield
} from 'lucide-react';

interface LinkedAccount {
  id: string;
  provider: string;
  providerId: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
  verified: boolean;
  isPrimary: boolean;
  createdAt: string;
}

export default function AccountLinking() {
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([]);
  const [linking, setLinking] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLinkedAccounts();
  }, []);

  const loadLinkedAccounts = async () => {
    try {
      const response = await fetch('/api/user?endpoint=accounts-linked');
      if (response.ok) {
        const data = await response.json();
        setLinkedAccounts(data);
      }
    } catch (error) {
      console.error('Error loading linked accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const linkAccount = async (provider: string) => {
    setLinking(provider);
    
    // This would typically open OAuth popup
    // For demo, we'll simulate the process
    try {
      const response = await fetch('/api/user?endpoint=accounts-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          accessToken: 'demo-token',
          idToken: 'demo-id-token'
        })
      });
      
      if (response.ok) {
        const newAccount = await response.json();
        setLinkedAccounts([...linkedAccounts, newAccount]);
        alert(`${provider.charAt(0).toUpperCase() + provider.slice(1)} account linked successfully!`);
      }
    } catch (error) {
      console.error('Error linking account:', error);
      alert('Failed to link account');
    } finally {
      setLinking(null);
    }
  };

  const unlinkAccount = async (provider: string) => {
    if (!confirm(`Unlink ${provider} account? You won't be able to login with it.`)) return;
    
    try {
      const response = await fetch(`/api/user?endpoint=accounts-unlink&provider=${provider}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setLinkedAccounts(linkedAccounts.filter(acc => acc.provider !== provider));
        alert('Account unlinked successfully');
      }
    } catch (error) {
      console.error('Error unlinking account:', error);
      alert('Failed to unlink account');
    }
  };

  const setPrimaryAccount = async (accountId: string) => {
    try {
      const response = await fetch('/api/user?endpoint=accounts-primary', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId })
      });
      
      if (response.ok) {
        setLinkedAccounts(accounts => 
          accounts.map(acc => ({
            ...acc,
            isPrimary: acc.id === accountId
          }))
        );
      }
    } catch (error) {
      console.error('Error setting primary account:', error);
    }
  };

  const providers = [
    {
      id: 'google',
      name: 'Google',
      icon: Mail,
      color: 'bg-red-500',
      description: 'Link your Google account for quick login',
      connected: linkedAccounts.some(acc => acc.provider === 'google')
    },
    {
      id: 'facebook',
      name: 'Facebook',
      icon: Facebook,
      color: 'bg-blue-600',
      description: 'Connect with Facebook',
      connected: linkedAccounts.some(acc => acc.provider === 'facebook')
    },
    {
      id: 'github',
      name: 'GitHub',
      icon: Github,
      color: 'bg-gray-800',
      description: 'For developers - link GitHub account',
      connected: linkedAccounts.some(acc => acc.provider === 'github')
    },
    {
      id: 'apple',
      name: 'Apple',
      icon: Apple,
      color: 'bg-black',
      description: 'Sign in with Apple',
      connected: linkedAccounts.some(acc => acc.provider === 'apple')
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800">Linked Accounts</h2>
        <p className="text-gray-600 mt-2">
          Connect your social accounts for easier login and enhanced security
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {providers.map((provider) => {
          const Icon = provider.icon;
          const account = linkedAccounts.find(acc => acc.provider === provider.id);
          const isConnected = !!account;
          
          return (
            <div
              key={provider.id}
              className={`p-6 border rounded-xl ${
                isConnected 
                  ? 'border-green-200 bg-green-50' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center">
                  <div className={`w-12 h-12 rounded-full ${provider.color} flex items-center justify-center mr-4`}>
                    <Icon size={24} className="text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">{provider.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">{provider.description}</p>
                  </div>
                </div>
                
                {isConnected ? (
                  <div className="flex items-center">
                    <CheckCircle size={20} className="text-green-600 mr-2" />
                    <span className="text-sm text-green-700 font-medium">Connected</span>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">Not connected</div>
                )}
              </div>
              
              {isConnected && account && (
                <div className="mb-4 p-3 bg-white rounded-lg border">
                  <div className="flex items-center">
                    {account.avatarUrl && (
                      <img
                        src={account.avatarUrl}
                        alt={account.displayName || provider.name}
                        className="w-8 h-8 rounded-full mr-3"
                      />
                    )}
                    <div>
                      <p className="font-medium text-gray-800">
                        {account.displayName || account.email}
                      </p>
                      <p className="text-xs text-gray-500">
                        Connected {new Date(account.createdAt).toLocaleDateString()}
                        {account.verified && (
                          <span className="ml-2 text-green-600">✓ Verified</span>
                        )}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex justify-between mt-3">
                    {account.isPrimary ? (
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                        Primary Account
                      </span>
                    ) : (
                      <button
                        onClick={() => setPrimaryAccount(account.id)}
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        Set as primary
                      </button>
                    )}
                    
                    <button
                      onClick={() => unlinkAccount(provider.id)}
                      className="text-sm text-red-600 hover:text-red-800 flex items-center"
                    >
                      <Unlink size={14} className="mr-1" />
                      Unlink
                    </button>
                  </div>
                </div>
              )}
              
              <button
                onClick={() => isConnected ? unlinkAccount(provider.id) : linkAccount(provider.id)}
                disabled={linking === provider.id}
                className={`w-full py-2 rounded-lg flex items-center justify-center ${
                  isConnected
                    ? 'border border-red-300 text-red-700 hover:bg-red-50'
                    : 'bg-gray-800 text-white hover:bg-gray-900'
                }`}
              >
                {linking === provider.id ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Connecting...
                  </>
                ) : isConnected ? (
                  <>
                    <Unlink size={16} className="mr-2" />
                    Unlink Account
                  </>
                ) : (
                  <>
                    <LinkIcon size={16} className="mr-2" />
                    Connect {provider.name}
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      <div className="space-y-6">
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-semibold text-blue-800 mb-2 flex items-center">
            <Shield size={18} className="mr-2" />
            Account Security
          </h4>
          <ul className="text-sm text-blue-700 space-y-2">
            <li>✓ Linked accounts add extra security layers</li>
            <li>✓ Use social login as 2FA method</li>
            <li>✓ Primary account receives security notifications</li>
            <li>✓ Unused linked accounts are automatically removed after 90 days</li>
          </ul>
        </div>
        
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <h4 className="font-semibold text-gray-800 mb-3">Linked Account Benefits</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-3">
              <div className="text-2xl font-bold text-gray-800">1-Click Login</div>
              <p className="text-sm text-gray-600 mt-1">Fast access without passwords</p>
            </div>
            
            <div className="text-center p-3">
              <div className="text-2xl font-bold text-gray-800">Enhanced Security</div>
              <p className="text-sm text-gray-600 mt-1">Social providers add extra verification</p>
            </div>
            
            <div className="text-center p-3">
              <div className="text-2xl font-bold text-gray-800">Data Sync</div>
              <p className="text-sm text-gray-600 mt-1">Sync profile info automatically</p>
            </div>
          </div>
        </div>
        
        {linkedAccounts.length > 0 && (
          <div className="p-4 bg-white border border-gray-200 rounded-lg">
            <h4 className="font-semibold text-gray-800 mb-3">Account Activity</h4>
            <div className="space-y-2">
              {linkedAccounts.map(account => (
                <div key={account.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                  <div className="flex items-center">
                    <div className={`w-8 h-8 rounded-full mr-3 ${
                      account.provider === 'google' ? 'bg-red-100' :
                      account.provider === 'facebook' ? 'bg-blue-100' :
                      account.provider === 'github' ? 'bg-gray-100' : 'bg-gray-200'
                    } flex items-center justify-center`}>
                      {account.provider === 'google' && <Mail size={16} className="text-red-600" />}
                      {account.provider === 'facebook' && <Facebook size={16} className="text-blue-600" />}
                      {account.provider === 'github' && <Github size={16} className="text-gray-800" />}
                      {account.provider === 'apple' && <Apple size={16} className="text-black" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        {account.displayName || account.email || account.provider}
                      </p>
                      <p className="text-xs text-gray-500">
                        Last used: Recently • {account.isPrimary ? 'Primary' : 'Secondary'}
                      </p>
                    </div>
                  </div>
                  <button className="text-sm text-blue-600 hover:text-blue-800 flex items-center">
                    View activity
                    <ExternalLink size={14} className="ml-1" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}