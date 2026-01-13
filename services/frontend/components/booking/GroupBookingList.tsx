'use client';

import { useState } from 'react';
import { Users, Mail, DollarSign, Calendar, MoreVertical, Edit, Trash2, Send } from 'lucide-react';
import Link from 'next/link';

interface GroupBookingListProps {
  bookings: any[];
  onUpdate: () => void;
}

export default function GroupBookingList({ bookings, onUpdate }: GroupBookingListProps) {
  const [showActions, setShowActions] = useState<string | null>(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CONFIRMED': return 'bg-green-100 text-green-800';
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'PARTIAL': return 'bg-blue-100 text-blue-800';
      case 'CANCELLED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleSendReminders = async (id: string) => {
    try {
      await fetch(`/api/group-bookings/${id}/send-reminders`, {
        method: 'POST',
      });
      onUpdate();
    } catch (error) {
      console.error('Error sending reminders:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this group booking?')) return;
    
    try {
      await fetch(`/api/group-bookings/${id}`, {
        method: 'DELETE',
      });
      onUpdate();
    } catch (error) {
      console.error('Error deleting booking:', error);
    }
  };

  return (
    <div className="divide-y">
      {bookings.map((booking) => {
        const confirmedCount = booking.members?.filter((m: any) => m.status === 'CONFIRMED').length || 0;
        const totalCount = booking.members?.length || 0;
        const progress = totalCount > 0 ? (confirmedCount / totalCount) * 100 : 0;

        return (
          <div key={booking.id} className="p-6 hover:bg-gray-50">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-purple-100 rounded-lg">
                    <Users className="text-purple-600" size={24} />
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <Link
                        href={`/booking/group/${booking.id}`}
                        className="text-lg font-medium hover:text-purple-600"
                      >
                        {booking.groupName}
                      </Link>
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(booking.status)}`}>
                        {booking.status}
                      </span>
                    </div>
                    
                    <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-600">
                      <div className="flex items-center">
                        <Calendar className="mr-1" size={14} />
                        {new Date(booking.startTime).toLocaleDateString()}
                      </div>
                      <div className="flex items-center">
                        <Users className="mr-1" size={14} />
                        {totalCount} members ({confirmedCount} confirmed)
                      </div>
                      <div className="flex items-center">
                        <DollarSign className="mr-1" size={14} />
                        ${booking.totalAmount?.toFixed(2)} total
                      </div>
                    </div>
                    
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span>Confirmation Progress</span>
                        <span>{Math.round(progress)}%</span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
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
                      href={`/booking/group/${booking.id}`}
                      className="flex items-center space-x-2 px-4 py-3 hover:bg-gray-50"
                    >
                      <Edit size={16} />
                      <span>View Details</span>
                    </Link>
                    
                    <button
                      onClick={() => handleSendReminders(booking.id)}
                      className="w-full flex items-center space-x-2 px-4 py-3 hover:bg-gray-50 text-left"
                    >
                      <Send size={16} />
                      <span>Send Reminders</span>
                    </button>
                    
                    <button
                      onClick={() => handleDelete(booking.id)}
                      className="w-full flex items-center space-x-2 px-4 py-3 hover:bg-red-50 text-red-600 text-left"
                    >
                      <Trash2 size={16} />
                      <span>Delete Group</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}