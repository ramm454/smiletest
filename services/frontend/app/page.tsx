'use client';

import { useState, useEffect } from 'react';
import { Calendar, Users, Video, Headphones, Repeat, Users as GroupIcon } from 'lucide-react';
import BookingForm from '@/components/booking/BookingForm';
import BookingList from '@/components/booking/BookingList';
import VoiceBooking from '@/components/booking/VoiceBooking';
import Link from 'next/link';

export default function BookingPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showVoiceBooking, setShowVoiceBooking] = useState(false);
  const [activeTab, setActiveTab] = useState('book');

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/bookings');
      const data = await response.json();
      setBookings(data.bookings || []);
    } catch (error) {
      console.error('Error fetching bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBookingCreated = (newBooking: any) => {
    setBookings([newBooking, ...bookings]);
  };

  const tabs = [
    { id: 'book', label: 'Book Now', icon: Calendar },
    { id: 'recurring', label: 'Recurring', icon: Repeat },
    { id: 'group', label: 'Group Booking', icon: GroupIcon },
    { id: 'voice', label: 'Voice Booking', icon: Headphones },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        {/* Header */}
        <header className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Book Your Sessions</h1>
              <p className="text-gray-600">Find and book yoga classes, live sessions, and workshops</p>
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowVoiceBooking(!showVoiceBooking)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:opacity-90"
              >
                <Headphones size={20} />
                <span>{showVoiceBooking ? 'Hide' : 'Show'} Voice Booking</span>
              </button>
            </div>
          </div>
        </header>

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Link
            href="/booking/recurring"
            className="p-6 bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-white rounded-lg">
                <Repeat className="text-blue-600" size={24} />
              </div>
              <div>
                <div className="font-semibold text-lg">Recurring Bookings</div>
                <p className="text-sm text-gray-600">Set up repeating sessions</p>
              </div>
            </div>
          </Link>
          
          <Link
            href="/booking/group"
            className="p-6 bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-white rounded-lg">
                <GroupIcon className="text-purple-600" size={24} />
              </div>
              <div>
                <div className="font-semibold text-lg">Group Bookings</div>
                <p className="text-sm text-gray-600">Book with friends & save</p>
              </div>
            </div>
          </Link>
          
          <Link
            href="/analytics"
            className="p-6 bg-gradient-to-r from-green-50 to-green-100 rounded-xl hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-white rounded-lg">
                <Video className="text-green-600" size={24} />
              </div>
              <div>
                <div className="font-semibold text-lg">Analytics</div>
                <p className="text-sm text-gray-600">Track your bookings</p>
              </div>
            </div>
          </Link>
        </div>

        {/* Tabs */}
        <div className="mb-8">
          <div className="flex space-x-2 border-b">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-6 py-3 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <tab.icon size={20} />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Voice Booking Section */}
        {showVoiceBooking && (
          <div className="mb-8">
            <VoiceBooking onBookingCreated={handleBookingCreated} />
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Booking Form */}
          <div className="lg:col-span-2">
            {activeTab === 'book' && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-xl font-bold mb-6">Book a Session</h2>
                <BookingForm onBookingCreated={handleBookingCreated} />
              </div>
            )}
            
            {activeTab === 'recurring' && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-xl font-bold mb-6">Create Recurring Booking</h2>
                <p className="text-gray-600 mb-6">
                  Set up a recurring booking for regular sessions. You can manage the entire series from one place.
                </p>
                <Link
                  href="/booking/recurring"
                  className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Go to Recurring Bookings
                </Link>
              </div>
            )}
            
            {activeTab === 'group' && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-xl font-bold mb-6">Create Group Booking</h2>
                <p className="text-gray-600 mb-6">
                  Book together with friends, family, or colleagues. Enjoy group discounts and easy coordination.
                </p>
                <Link
                  href="/booking/group"
                  className="inline-block px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Go to Group Bookings
                </Link>
              </div>
            )}
            
            {activeTab === 'voice' && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-xl font-bold mb-6">Voice Booking</h2>
                <p className="text-gray-600 mb-6">
                  Use your voice to book sessions. Click the microphone button above to get started.
                </p>
                <VoiceBooking onBookingCreated={handleBookingCreated} />
              </div>
            )}
          </div>

          {/* Right Column - Recent Bookings */}
          <div>
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-lg font-semibold mb-4">Recent Bookings</h2>
              
              {loading ? (
                <div className="py-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                </div>
              ) : bookings.length === 0 ? (
                <div className="py-8 text-center text-gray-500">
                  No bookings yet. Book your first session!
                </div>
              ) : (
                <div className="space-y-4">
                  <BookingList bookings={bookings.slice(0, 5)} />
                  {bookings.length > 5 && (
                    <Link
                      href="/bookings"
                      className="block text-center text-blue-600 hover:text-blue-700 mt-4"
                    >
                      View all {bookings.length} bookings →
                    </Link>
                  )}
                </div>
              )}
            </div>

            {/* Quick Stats */}
            <div className="mt-6 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl shadow-lg p-6 text-white">
              <h3 className="font-semibold mb-4">Your Booking Stats</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>Total Bookings</span>
                  <span className="font-bold">{bookings.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Upcoming</span>
                  <span className="font-bold">
                    {bookings.filter(b => new Date(b.dateTime) > new Date()).length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Completed</span>
                  <span className="font-bold">
                    {bookings.filter(b => new Date(b.dateTime) <= new Date()).length}
                  </span>
                </div>
              </div>
              
              <Link
                href="/analytics"
                className="block mt-6 text-center py-2 bg-white text-blue-600 rounded-lg hover:bg-gray-100"
              >
                View Detailed Analytics
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}