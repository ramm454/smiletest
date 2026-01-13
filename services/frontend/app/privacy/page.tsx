'use client';
import { useState } from 'react';
import { 
  Shield, 
  FileText, 
  Cookie, 
  Download, 
  Eye, 
  Settings, 
  Users, 
  Globe,
  Lock,
  Bell,
  HelpCircle
} from 'lucide-react';
import Link from 'next/link';

export default function PrivacyPage() {
  const [activeSection, setActiveSection] = useState('overview');

  const sections = [
    {
      id: 'overview',
      title: 'Privacy Overview',
      icon: Shield,
      description: 'Understand how we protect your data',
      color: 'bg-blue-500'
    },
    {
      id: 'rights',
      title: 'Your Rights',
      icon: FileText,
      description: 'Exercise your GDPR & CCPA rights',
      color: 'bg-green-500'
    },
    {
      id: 'cookies',
      title: 'Cookie Settings',
      icon: Cookie,
      description: 'Manage your cookie preferences',
      color: 'bg-purple-500'
    },
    {
      id: 'data',
      title: 'Your Data',
      icon: Download,
      description: 'Access and export your information',
      color: 'bg-yellow-500'
    },
    {
      id: 'consent',
      title: 'Consent Manager',
      icon: Settings,
      description: 'Update your privacy preferences',
      color: 'bg-pink-500'
    },
    {
      id: 'sharing',
      title: 'Data Sharing',
      icon: Users,
      description: 'See who we share data with',
      color: 'bg-indigo-500'
    }
  ];

  const policies = [
    {
      title: 'Privacy Policy',
      description: 'Comprehensive overview of our data practices',
      version: '3.2',
      updated: '2024-01-15',
      icon: Shield
    },
    {
      title: 'Cookie Policy',
      description: 'Detailed information about our use of cookies',
      version: '2.1',
      updated: '2024-01-10',
      icon: Cookie
    },
    {
      title: 'Data Processing Agreement',
      description: 'Legal agreement for data processing',
      version: '1.0',
      updated: '2024-01-05',
      icon: FileText
    },
    {
      title: 'International Transfers',
      description: 'How we handle cross-border data transfers',
      version: '1.2',
      updated: '2024-01-01',
      icon: Globe
    }
  ];

  const quickActions = [
    { label: 'Download Your Data', icon: Download, href: '/privacy/export' },
    { label: 'View Privacy Settings', icon: Settings, href: '/privacy/settings' },
    { label: 'Contact DPO', icon: Users, href: 'mailto:dpo@yogaspa.com' },
    { label: 'Report Concern', icon: Bell, href: '/privacy/report' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold">Your Privacy Center</h1>
            <p className="text-xl text-blue-100 mt-4 max-w-3xl mx-auto">
              Take control of your personal data. We're committed to transparency and 
              putting you in charge of your information.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <span className="px-4 py-2 bg-white/20 rounded-full text-sm">GDPR Compliant</span>
              <span className="px-4 py-2 bg-white/20 rounded-full text-sm">CCPA Ready</span>
              <span className="px-4 py-2 bg-white/20 rounded-full text-sm">ISO 27001 Certified</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          <div className="bg-white p-6 rounded-xl shadow border text-center">
            <div className="text-3xl font-bold text-blue-600">30</div>
            <div className="text-sm text-gray-600 mt-2">Day Response Time</div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow border text-center">
            <div className="text-3xl font-bold text-green-600">6</div>
            <div className="text-sm text-gray-600 mt-2">Privacy Rights</div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow border text-center">
            <div className="text-3xl font-bold text-purple-600">24/7</div>
            <div className="text-sm text-gray-600 mt-2">Security Monitoring</div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow border text-center">
            <div className="text-3xl font-bold text-yellow-600">100%</div>
            <div className="text-sm text-gray-600 mt-2">Data Encryption</div>
          </div>
        </div>

        {/* Main Navigation */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Take Control of Your Data</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <Link
                  key={section.id}
                  href={`/privacy/${section.id}`}
                  className="bg-white p-6 rounded-xl shadow border hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-start">
                    <div className={`${section.color} p-3 rounded-lg mr-4`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{section.title}</h3>
                      <p className="text-sm text-gray-600 mt-1">{section.description}</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <Link
                  key={index}
                  href={action.href}
                  className="bg-white p-4 rounded-lg border hover:border-blue-300 hover:bg-blue-50 transition-colors text-center"
                >
                  <Icon className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                  <span className="text-sm font-medium text-gray-900">{action.label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Policies */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Privacy Policies & Agreements</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {policies.map((policy, index) => {
              const Icon = policy.icon;
              return (
                <div key={index} className="bg-white p-6 rounded-xl shadow border">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center">
                      <div className="p-2 bg-gray-100 rounded-lg mr-3">
                        <Icon className="h-5 w-5 text-gray-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{policy.title}</h3>
                        <p className="text-sm text-gray-600">{policy.description}</p>
                      </div>
                    </div>
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                      v{policy.version}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm text-gray-500">
                    <span>Updated {policy.updated}</span>
                    <div className="flex gap-2">
                      <button className="text-blue-600 hover:text-blue-800">
                        View
                      </button>
                      <button className="text-blue-600 hover:text-blue-800">
                        Download
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-12 p-8 bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl border border-blue-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
            <HelpCircle className="h-6 w-6 text-blue-600 mr-3" />
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">
                How long do you keep my data?
              </h3>
              <p className="text-gray-700">
                We retain your personal data only for as long as necessary to fulfill the purposes 
                for which it was collected, including legal, accounting, or reporting requirements.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Can I delete all my data?
              </h3>
              <p className="text-gray-700">
                Yes, you have the right to request deletion of your personal data. However, 
                we may need to retain certain information for legal or legitimate business purposes.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">
                How do I contact the Data Protection Officer?
              </h3>
              <p className="text-gray-700">
                Email our DPO at{' '}
                <a href="mailto:dpo@yogaspa.com" className="text-blue-600 hover:underline">
                  dpo@yogaspa.com
                </a>
                {' '}or call +1 (555) 123-4567 during business hours.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}