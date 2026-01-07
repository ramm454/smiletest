'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import BookingForm from '@/components/booking/BookingForm';
import BookingList from '@/components/booking/BookingList';
import VoiceBooking from '@/components/booking/VoiceBooking';
import { Calendar, Mic, Headphones, CheckCircle } from 'lucide-react';

// Define the booking type with all properties
interface Booking {
  id: string;
  serviceType: string;
  className: string;
  dateTime: string;
  status: string;
  userId?: string;
  participants?: number;
  notes?: string;
  createdAt?: string;
}

export default function BookingPage() {
  const [activeTab, setActiveTab] = useState('book');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/booking');
      if (response.ok) {
        const data = await response.json();
        setBookings(data.bookings || []);
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBookingCreated = (newBooking: Booking) => {
    // Ensure the booking has all required properties
    const bookingWithDefaults: Booking = {
      id: newBooking.id || `booking-${Date.now()}`,
      serviceType: newBooking.serviceType || 'yoga',
      className: newBooking.className || 'Vinyasa Flow',
      dateTime: newBooking.dateTime || new Date().toISOString(),
      status: newBooking.status || 'confirmed',
      userId: newBooking.userId,
      participants: newBooking.participants,
      notes: newBooking.notes,
      createdAt: newBooking.createdAt || new Date().toISOString(),
    };
    
    setBookings([bookingWithDefaults, ...bookings]);
    setActiveTab('my-bookings');
  };

  const tabs = [
    { id: 'book', label: 'Book Now', icon: Calendar },
    { id: 'voice', label: 'Voice Book', icon: Mic },
    { id: 'my-bookings', label: 'My Bookings', icon: CheckCircle },
    { id: 'voice-history', label: 'Voice History', icon: Headphones },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            Book Your Yoga & Spa Sessions
          </h1>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            Choose your preferred way to book: traditional form or voice command with AI
          </p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap justify-center gap-4 mb-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-white text-gray-700 hover:bg-gray-100 shadow'
                }`}
              >
                <Icon size={20} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="max-w-6xl mx-auto">
          {activeTab === 'book' && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">
                Book a Session
              </h2>
              <BookingForm onBookingCreated={handleBookingCreated} />
            </div>
          )}

          {activeTab === 'voice' && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">
                Book with Voice AI
              </h2>
              <VoiceBooking onBookingCreated={handleBookingCreated} />
            </div>
          )}

          {activeTab === 'my-bookings' && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">
                Your Bookings
              </h2>
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-4 text-gray-600">Loading your bookings...</p>
                </div>
              ) : (
                <BookingList bookings={bookings} />
              )}
            </div>
          )}

          {activeTab === 'voice-history' && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">
                Voice Booking History
              </h2>
              <div className="text-center py-12">
                <Headphones size={64} className="mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600">
                  Your voice booking history will appear here
                </p>
                <button
                  onClick={() => setActiveTab('voice')}
                  className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Try Voice Booking
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Service Status */}
        <div className="mt-12 p-6 bg-gray-50 rounded-xl">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Service Status
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ServiceStatusCard 
              title="Booking Service" 
              endpoint="http://localhost:3002/health" 
            />
            <ServiceStatusCard 
              title="Voice Service" 
              endpoint="http://localhost:8005/health" 
            />
            <ServiceStatusCard 
              title="AI Agent Service" 
              endpoint="http://localhost:8002/health" 
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ServiceStatusCard({ title, endpoint }: { title: string, endpoint: string }) {
  const [status, setStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const response = await fetch(endpoint, { mode: 'no-cors' });
      setStatus('online');
    } catch (error) {
      setStatus('offline');
    }
  };

  const statusColor = {
    checking: 'text-yellow-600',
    online: 'text-green-600',
    offline: 'text-red-600'
  }[status];

  const statusText = {
    checking: 'Checking...',
    online: 'Online',
    offline: 'Offline'
  }[status];

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <div className="flex items-center justify-between">
        <span className="font-medium text-gray-700">{title}</span>
        <span className={`font-semibold ${statusColor}`}>{statusText}</span>
      </div>
      <div className="mt-2 text-sm text-gray-500 truncate">{endpoint}</div>
    </div>
  );
}