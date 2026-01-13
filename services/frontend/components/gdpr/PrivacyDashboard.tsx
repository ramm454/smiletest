'use client';
import { useState, useEffect } from 'react';
import {
  Shield,
  Eye,
  Download,
  Edit,
  Trash2,
  Lock,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Settings,
  User,
  Database,
  Globe,
  Bell,
  Key
} from 'lucide-react';

interface PrivacyDashboardProps {
  userId?: string;
}

interface ConsentRecord {
  id: string;
  consentType: string;
  version: string;
  granted: boolean;
  grantedAt: string;
  revokedAt?: string;
}

interface DataRequest {
  id: string;
  requestType: string;
  status: string;
  createdAt: string;
  dueDate: string;
  completedAt?: string;
}

export default function PrivacyDashboard({ userId }: PrivacyDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'consents' | 'requests' | 'exports' | 'settings'>('overview');
  const [consents, setConsents] = useState<ConsentRecord[]>([]);
  const [requests, setRequests] = useState<DataRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<any>(null);

  useEffect(() => {
    if (userId) {
      loadPrivacyData();
    }
  }, [userId]);

  const loadPrivacyData = async () => {
    setLoading(true);
    try {
      // Load consents
      const consentsRes = await fetch('/api/user?endpoint=consents');
      if (consentsRes.ok) {
        const consentsData = await consentsRes.json();
        setConsents(consentsData);
      }

      // Load data requests
      const requestsRes = await fetch('/api/user?endpoint=data-requests');
      if (requestsRes.ok) {
        const requestsData = await requestsRes.json();
        setRequests(requestsData);
      }

      // Load user privacy settings
      const userRes = await fetch('/api/user?endpoint=privacy-settings');
      if (userRes.ok) {
        const userData = await userRes.json();
        setUserData(userData);
      }
    } catch (error) {
      console.error('Error loading privacy data:', error);
    } finally {
      setLoading(false);
    }
  };

  const privacyMetrics = [
    {
      title: 'Active Consents',
      value: consents.filter(c => c.granted).length,
      total: consents.length,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    },
    {
      title: 'Pending Requests',
      value: requests.filter(r => r.status === 'PENDING').length,
      icon: Clock,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100'
    },
    {
      title: 'Data Categories',
      value: 8,
      icon: Database,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100'
    },
    {
      title: 'Days to Review',
      value: 30,
      icon: Calendar,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100'
    }
  ];

  const quickActions = [
    {
      title: 'View Your Data',
      description: 'See what information we have about you',
      icon: Eye,
      color: 'bg-blue-500',
      action: () => window.location.href = '/privacy/data-access'
    },
    {
      title: 'Download Your Data',
      description: 'Get a copy of your data in portable format',
      icon: Download,
      color: 'bg-green-500',
      action: () => window.location.href = '/privacy/data-export'
    },
    {
      title: 'Update Consents',
      description: 'Manage your privacy preferences',
      icon: Settings,
      color: 'bg-purple-500',
      action: () => setActiveTab('consents')
    },
    {
      title: 'Request Deletion',
      description: 'Request to delete your personal data',
      icon: Trash2,
      color: 'bg-red-500',
      action: () => window.location.href = '/privacy/rights?type=erasure'
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Privacy Dashboard</h1>
              <p className="text-blue-100 mt-2">
                Take control of your personal data and privacy settings
              </p>
            </div>
            <div className="mt-4 md:mt-0">
              <div className="flex items-center">
                <Shield className="h-6 w-6 mr-2" />
                <span className="font-semibold">GDPR & CCPA Compliant</span>
              </div>
              <p className="text-sm text-blue-200 mt-1">
                Last reviewed: {new Date().toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Tabs */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'overview', label: 'Overview', icon: Shield },
              { id: 'consents', label: 'Consents', icon: CheckCircle },
              { id: 'requests', label: 'Requests', icon: FileText },
              { id: 'exports', label: 'Data Exports', icon: Download },
              { id: 'settings', label: 'Settings', icon: Settings }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-5 w-5 mr-2" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Overview */}
          <div className="lg:col-span-2">
            {activeTab === 'overview' && (
              <div className="space-y-8">
                {/* Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {privacyMetrics.map((metric, index) => {
                    const Icon = metric.icon;
                    return (
                      <div key={index} className="bg-white p-4 rounded-xl shadow border border-gray-200">
                        <div className="flex items-center">
                          <div className={`p-3 rounded-lg ${metric.bgColor} mr-4`}>
                            <Icon className={`h-6 w-6 ${metric.color}`} />
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">{metric.title}</p>
                            <p className="text-2xl font-bold text-gray-900 mt-1">
                              {metric.value}
                              {metric.total && (
                                <span className="text-sm text-gray-500"> / {metric.total}</span>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Quick Actions */}
                <div className="bg-white rounded-xl shadow border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-6">Quick Actions</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {quickActions.map((action, index) => {
                      const Icon = action.icon;
                      return (
                        <button
                          key={index}
                          onClick={action.action}
                          className="flex items-center p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
                        >
                          <div className={`${action.color} p-3 rounded-lg mr-4`}>
                            <Icon className="h-6 w-6 text-white" />
                          </div>
                          <div className="text-left">
                            <h4 className="font-semibold text-gray-900">{action.title}</h4>
                            <p className="text-sm text-gray-600 mt-1">{action.description}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-white rounded-xl shadow border border-gray-200 p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-semibold text-gray-900">Recent Privacy Activity</h3>
                    <button className="text-sm text-blue-600 hover:text-blue-800">
                      View All →
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    {requests.slice(0, 5).map((request) => (
                      <div key={request.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg hover:bg-gray-50">
                        <div className="flex items-center">
                          <div className={`p-2 rounded-full mr-3 ${
                            request.status === 'COMPLETED' ? 'bg-green-100' :
                            request.status === 'PENDING' ? 'bg-yellow-100' :
                            'bg-gray-100'
                          }`}>
                            <FileText className={`h-4 w-4 ${
                              request.status === 'COMPLETED' ? 'text-green-600' :
                              request.status === 'PENDING' ? 'text-yellow-600' :
                              'text-gray-600'
                            }`} />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{request.requestType.replace('_', ' ')}</p>
                            <p className="text-sm text-gray-600">
                              {new Date(request.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            request.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                            request.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {request.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'consents' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-900">Your Consent Preferences</h3>
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    Update All Consents
                  </button>
                </div>

                <div className="space-y-4">
                  {consents.map((consent) => (
                    <div key={consent.id} className="bg-white border border-gray-200 rounded-xl p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center">
                          <div className={`p-2 rounded-full mr-3 ${consent.granted ? 'bg-green-100' : 'bg-red-100'}`}>
                            {consent.granted ? (
                              <CheckCircle className="h-5 w-5 text-green-600" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-600" />
                            )}
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900 capitalize">
                              {consent.consentType.replace(/_/g, ' ')}
                            </h4>
                            <p className="text-sm text-gray-600">Version {consent.version}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                            consent.granted
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {consent.granted ? 'Granted' : 'Not Granted'}
                          </span>
                          <button className="text-blue-600 hover:text-blue-800">
                            Update
                          </button>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                        <div>
                          <span className="font-medium">Granted:</span>{' '}
                          {consent.grantedAt ? new Date(consent.grantedAt).toLocaleDateString() : 'Never'}
                        </div>
                        <div>
                          <span className="font-medium">Last Updated:</span>{' '}
                          {consent.revokedAt ? new Date(consent.revokedAt).toLocaleDateString() : 'N/A'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'requests' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-900">Data Subject Requests</h3>
                  <button 
                    onClick={() => window.location.href = '/privacy/rights'}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    + New Request
                  </button>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Request Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date Submitted
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Deadline
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {requests.map((request) => (
                        <tr key={request.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {request.requestType.replace(/_/g, ' ')}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {new Date(request.createdAt).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              request.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                              request.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                              request.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {request.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(request.dueDate).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button className="text-blue-600 hover:text-blue-900 mr-4">
                              View
                            </button>
                            {request.status === 'PENDING' && (
                              <button className="text-red-600 hover:text-red-900">
                                Cancel
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* Data Protection Officer */}
            <div className="bg-white rounded-xl shadow border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                <Shield className="h-5 w-5 text-blue-600 mr-2" />
                Data Protection Officer
              </h3>
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  For questions about your privacy rights or to file a complaint:
                </p>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="font-medium text-blue-900">Jane Smith</p>
                  <p className="text-sm text-blue-700">Data Protection Officer</p>
                  <div className="mt-2 space-y-1">
                    <a href="mailto:dpo@yogaspa.com" className="block text-sm text-blue-600 hover:text-blue-800">
                      dpo@yogaspa.com
                    </a>
                    <p className="text-sm text-blue-600">+1 (555) 123-4567</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Your Rights */}
            <div className="bg-white rounded-xl shadow border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Your Privacy Rights</h3>
              <div className="space-y-3">
                {[
                  { icon: Eye, title: 'Right to Access', desc: 'Access your personal data' },
                  { icon: Edit, title: 'Right to Rectification', desc: 'Correct inaccurate data' },
                  { icon: Trash2, title: 'Right to Erasure', desc: 'Delete your data' },
                  { icon: Download, title: 'Right to Portability', desc: 'Get your data in portable format' },
                  { icon: Lock, title: 'Right to Restriction', desc: 'Limit how we use your data' },
                  { icon: Bell, title: 'Right to Object', desc: 'Object to data processing' }
                ].map((right, index) => {
                  const Icon = right.icon;
                  return (
                    <div key={index} className="flex items-start p-2 hover:bg-gray-50 rounded">
                      <Icon className="h-5 w-5 text-gray-400 mt-0.5 mr-3" />
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{right.title}</p>
                        <p className="text-xs text-gray-600">{right.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Data Retention */}
            <div className="bg-white rounded-xl shadow border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Data Retention</h3>
              <div className="space-y-4">
                {[
                  { type: 'Account Data', period: '3 years after inactivity' },
                  { type: 'Booking Records', period: '7 years for tax purposes' },
                  { type: 'Payment Information', period: '7 years for legal compliance' },
                  { type: 'Communication Data', period: '2 years' },
                  { type: 'Analytics Data', period: '26 months' }
                ].map((item, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <span className="text-sm text-gray-700">{item.type}</span>
                    <span className="text-xs px-2 py-1 bg-gray-100 text-gray-800 rounded">
                      {item.period}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Emergency Actions */}
            <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-xl p-6">
              <h3 className="font-semibold text-red-900 mb-3">Emergency Actions</h3>
              <div className="space-y-3">
                <button className="w-full text-left p-3 bg-white border border-red-200 rounded-lg hover:bg-red-50">
                  <div className="flex items-center">
                    <AlertCircle className="h-5 w-5 text-red-600 mr-3" />
                    <div>
                      <p className="font-medium text-red-900">Report Data Breach</p>
                      <p className="text-sm text-red-700">Suspect unauthorized access?</p>
                    </div>
                  </div>
                </button>
                <button className="w-full text-left p-3 bg-white border border-red-200 rounded-lg hover:bg-red-50">
                  <div className="flex items-center">
                    <Lock className="h-5 w-5 text-red-600 mr-3" />
                    <div>
                      <p className="font-medium text-red-900">Freeze Account</p>
                      <p className="text-sm text-red-700">Temporarily restrict all access</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}