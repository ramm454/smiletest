'use client';

import { useState } from 'react';
import { Repeat, Calendar, Users, DollarSign, MoreVertical, Edit, Pause, Trash2 } from 'lucide-react';
import Link from 'next/link';

interface RecurringBookingListProps {
  bookings: any[];
  onUpdate: () => void;
}

export default function RecurringBookingList({ bookings, onUpdate }: RecurringBookingListProps) {
  const [showActions, setShowActions] = useState<string | null>(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-100 text-green-800';
      case 'PAUSED': return 'bg-yellow-100 text-yellow-800';
      case 'CANCELLED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRecurrenceText = (booking: any) => {
    if (booking.recurrenceType === 'WEEKLY') {
      const days = booking.daysOfWeek?.map((d: number) => 
        ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]
      ).join(', ');
      return `Every ${booking.repeatEvery || 1} week(s) on ${days}`;
    }
    return booking.recurrenceType;
  };

  const handlePause = async (id: string) => {
    try {
      await fetch(`/api/recurring-bookings/${id}/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      });
      onUpdate();
    } catch (error) {
      console.error('Error pausing booking:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this recurring booking?')) return;
    
    try {
      await fetch(`/api/recurring-bookings/${id}`, {
        method: 'DELETE',
      });
      onUpdate();
    } catch (error) {
      console.error('Error deleting booking:', error);
    }
  };

  return (
    <div className="divide-y">
      {bookings.map((booking) => (
        <div key={booking.id} className="p-6 hover:bg-gray-50">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Repeat className="text-blue-600" size={24} />
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <Link
                      href={`/booking/recurring/${booking.id}`}
                      className="text-lg font-medium hover:text-blue-600"
                    >
                      {booking.groupName || `Recurring Booking #${booking.id.slice(0, 8)}`}
                    </Link>
                    <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(booking.status)}`}>
                      {booking.status}
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-600">
                    <div className="flex items-center">
                      <Calendar className="mr-1" size={14} />
                      {new Date(booking.firstOccurrence).toLocaleDateString()}
                    </div>
                    <div className="flex items-center">
                      <Repeat className="mr-1" size={14} />
                      {getRecurrenceText(booking)}
                    </div>
                    <div className="flex items-center">
                      <Users className="mr-1" size={14} />
                      {booking.participants} participant(s)
                    </div>
                    <div className="flex items-center">
                      <DollarSign className="mr-1" size={14} />
                      ${booking.totalAmount?.toFixed(2)} per session
                    </div>
                  </div>
                  
                  <div className="mt-2">
                    <span className="text-sm text-gray-500">
                      {booking.generatedCount} bookings generated • Next: {booking.nextOccurrence 
                        ? new Date(booking.nextOccurrence).toLocaleDateString()
                        : 'None scheduled'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="relative">
              <button
                onClick={() => setShowActions(showActions === booking.id ? null : booking.id)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <MoreVertical size={20} />
              </button>
              
              {showActions === booking.id && (
                <div className="absolute right-0 mt-2 w-48 bg-white border rounded-lg shadow-lg z-10">
                  <Link
                    href={`/booking/recurring/${booking.id}`}
                    className="flex items-center space-x-2 px-4 py-3 hover:bg-gray-50"
                  >
                    <Edit size={16} />
                    <span>View Details</span>
                  </Link>
                  
                  {booking.status === 'ACTIVE' && (
                    <button
                      onClick={() => handlePause(booking.id)}
                      className="w-full flex items-center space-x-2 px-4 py-3 hover:bg-gray-50 text-left"
                    >
                      <Pause size={16} />
                      <span>Pause Series</span>
                    </button>
                  )}
                  
                  <button
                    onClick={() => handleDelete(booking.id)}
                    className="w-full flex items-center space-x-2 px-4 py-3 hover:bg-red-50 text-red-600 text-left"
                  >
                    <Trash2 size={16} />
                    <span>Cancel Series</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}