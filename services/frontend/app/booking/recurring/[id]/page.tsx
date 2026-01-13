'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Calendar,
  Repeat,
  Users,
  DollarSign,
  Edit,
  Trash2,
  Pause,
  Play,
  ChevronLeft,
  Download,
  Share2,
} from 'lucide-react';
import Link from 'next/link';

export default function RecurringBookingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [showCancel, setShowCancel] = useState(false);

  useEffect(() => {
    if (params.id) {
      fetchBookingDetails();
    }
  }, [params.id]);

  const fetchBookingDetails = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/recurring-bookings/${params.id}`);
      const data = await response.json();
      setBooking(data);
    } catch (error) {
      console.error('Error fetching booking:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePause = async () => {
    try {
      const response = await fetch(`/api/recurring-bookings/${params.id}/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      });

      if (response.ok) {
        fetchBookingDetails();
      }
    } catch (error) {
      console.error('Error pausing booking:', error);
    }
  };

  const handleResume = async () => {
    try {
      const response = await fetch(`/api/recurring-bookings/${params.id}/resume`, {
        method: 'POST',
      });

      if (response.ok) {
        fetchBookingDetails();
      }
    } catch (error) {
      console.error('Error resuming booking:', error);
    }
  };

  const handleCancel = async () => {
    try {
      const response = await fetch(`/api/recurring-bookings/${params.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        router.push('/booking/recurring');
      }
    } catch (error) {
      console.error('Error cancelling booking:', error);
    }
  };

  const exportICal = async () => {
    try {
      const response = await fetch(`/api/recurring-bookings/${params.id}/ical`);
      const ical = await response.text();
      
      const blob = new Blob([ical], { type: 'text/calendar' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `recurring-booking-${params.id}.ics`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting iCal:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Booking not found</h2>
          <Link href="/booking/recurring" className="text-blue-600 hover:underline">
            Return to recurring bookings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/booking/recurring" className="p-2 hover:bg-gray-100 rounded-lg">
                <ChevronLeft size={20} />
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{booking.groupName || 'Recurring Booking'}</h1>
                <div className="flex items-center space-x-2 mt-1">
                  <span className={`px-3 py-1 text-sm rounded-full ${
                    booking.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                    booking.status === 'PAUSED' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {booking.status}
                  </span>
                  <span className="text-gray-600">•</span>
                  <span className="text-gray-600">ID: {booking.id}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={exportICal}
                className="flex items-center space-x-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                <Download size={16} />
                <span>Export iCal</span>
              </button>
              
              <button className="flex items-center space-x-2 px-4 py-2 border rounded-lg hover:bg-gray-50">
                <Share2 size={16} />
                <span>Share</span>
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Booking Info */}
            <div className="bg-white rounded-xl shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Booking Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="text-sm text-gray-600 mb-1">First Occurrence</div>
                  <div className="font-medium">
                    {new Date(booking.firstOccurrence).toLocaleDateString()} at{' '}
                    {new Date(booking.firstOccurrence).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                
                <div>
                  <div className="text-sm text-gray-600 mb-1">Duration</div>
                  <div className="font-medium">{booking.duration} minutes</div>
                </div>
                
                <div>
                  <div className="text-sm text-gray-600 mb-1">Recurrence Pattern</div>
                  <div className="font-medium flex items-center">
                    <Repeat className="mr-2" size={16} />
                    {getRecurrenceText(booking)}
                  </div>
                </div>
                
                <div>
                  <div className="text-sm text-gray-600 mb-1">Participants</div>
                  <div className="font-medium flex items-center">
                    <Users className="mr-2" size={16} />
                    {booking.participants} person(s)
                  </div>
                </div>
                
                <div>
                  <div className="text-sm text-gray-600 mb-1">Total Generated</div>
                  <div className="font-medium">{booking.generatedCount} bookings</div>
                </div>
                
                <div>
                  <div className="text-sm text-gray-600 mb-1">Next Occurrence</div>
                  <div className="font-medium">
                    {booking.upcomingOccurrences?.[0]
                      ? new Date(booking.upcomingOccurrences[0]).toLocaleDateString()
                      : 'No upcoming'}
                  </div>
                </div>
              </div>
              
              {booking.notes && (
                <div className="mt-6">
                  <div className="text-sm text-gray-600 mb-1">Notes</div>
                  <div className="p-3 bg-gray-50 rounded-lg">{booking.notes}</div>
                </div>
              )}
            </div>

            {/* Generated Bookings */}
            <div className="bg-white rounded-xl shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Generated Bookings</h2>
                <button
                  onClick={fetchBookingDetails}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Refresh
                </button>
              </div>
              
              <div className="space-y-3">
                {booking.bookings?.slice(0, 10).map((item: any) => (
                  <div key={item.id} className="p-4 border rounded-lg hover:bg-gray-50">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-medium">
                          {new Date(item.startTime).toLocaleDateString()} at{' '}
                          {new Date(item.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          Status: <span className={`px-2 py-1 rounded text-xs ${
                            item.status === 'CONFIRMED' ? 'bg-green-100 text-green-800' :
                            item.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {item.status}
                          </span>
                        </div>
                      </div>
                      
                      <Link
                        href={`/booking/${item.id}`}
                        className="text-sm text-blue-600 hover:text-blue-700"
                      >
                        View Details →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
              
              {booking.bookings?.length > 10 && (
                <div className="mt-4 text-center">
                  <Link
                    href={`/booking?recurring=${params.id}`}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    View all {booking.bookings.length} bookings
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Actions & Summary */}
          <div className="space-y-6">
            {/* Actions */}
            <div className="bg-white rounded-xl shadow p-6">
              <h3 className="font-semibold mb-4">Actions</h3>
              <div className="space-y-3">
                <button
                  onClick={() => setShowEdit(true)}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-3 border rounded-lg hover:bg-gray-50"
                >
                  <Edit size={16} />
                  <span>Edit Booking</span>
                </button>
                
                {booking.status === 'ACTIVE' ? (
                  <button
                    onClick={handlePause}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-3 border rounded-lg hover:bg-yellow-50"
                  >
                    <Pause size={16} />
                    <span>Pause Booking</span>
                  </button>
                ) : (
                  <button
                    onClick={handleResume}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-3 border rounded-lg hover:bg-green-50"
                  >
                    <Play size={16} />
                    <span>Resume Booking</span>
                  </button>
                )}
                
                <button
                  onClick={() => setShowCancel(true)}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-3 border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
                >
                  <Trash2 size={16} />
                  <span>Cancel Series</span>
                </button>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="bg-white rounded-xl shadow p-6">
              <h3 className="font-semibold mb-4">Financial Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Base Price</span>
                  <span className="font-medium">${booking.basePrice?.toFixed(2)}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600">Discount</span>
                  <span className="font-medium text-green-600">
                    -${booking.discount?.toFixed(2)}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600">Total per Session</span>
                  <span className="font-medium">${booking.totalAmount?.toFixed(2)}</span>
                </div>
                
                <div className="pt-3 border-t">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Total Generated</span>
                    <span className="text-xl font-bold">
                      ${(booking.totalAmount * booking.generatedCount).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Calendar Integration */}
            <div className="bg-white rounded-xl shadow p-6">
              <h3 className="font-semibold mb-4">Calendar Integration</h3>
              <div className="space-y-3">
                <button
                  onClick={exportICal}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Download size={16} />
                  <span>Download iCal File</span>
                </button>
                
                <p className="text-sm text-gray-600 text-center">
                  Import this file into Google Calendar, Outlook, or Apple Calendar
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Modals */}
        {showCancel && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold mb-2">Cancel Recurring Booking</h3>
              <p className="text-gray-600 mb-6">
                This will cancel all future bookings in this series. This action cannot be undone.
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowCancel(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Keep Booking
                </button>
                <button
                  onClick={handleCancel}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Cancel Series
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function getRecurrenceText(booking: any): string {
  if (booking.recurrenceType === 'WEEKLY') {
    const days = booking.daysOfWeek?.map((d: number) => 
      ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]
    ).join(', ');
    
    return `Every ${booking.repeatEvery || 1} week(s) on ${days}`;
  }
  
  return booking.recurrenceType;
}