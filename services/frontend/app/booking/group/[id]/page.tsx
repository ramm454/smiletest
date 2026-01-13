'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Users,
  Mail,
  Phone,
  DollarSign,
  CheckCircle,
  XCircle,
  Clock,
  Edit,
  Trash2,
  Send,
  Copy,
  ChevronLeft,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';

export default function GroupBookingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [paymentLink, setPaymentLink] = useState('');

  useEffect(() => {
    if (params.id) {
      fetchBookingDetails();
      fetchPaymentLink();
    }
  }, [params.id]);

  const fetchBookingDetails = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/group-bookings/${params.id}`);
      const data = await response.json();
      setBooking(data);
    } catch (error) {
      console.error('Error fetching booking:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentLink = async () => {
    try {
      const response = await fetch(`/api/group-bookings/${params.id}/payment-link`);
      const data = await response.json();
      setPaymentLink(data.paymentLink);
    } catch (error) {
      console.error('Error fetching payment link:', error);
    }
  };

  const handleAddMember = async () => {
    if (!newMemberEmail) return;

    try {
      const response = await fetch(`/api/group-bookings/${params.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newMemberEmail }),
      });

      if (response.ok) {
        setNewMemberEmail('');
        setShowInviteModal(false);
        fetchBookingDetails();
      }
    } catch (error) {
      console.error('Error adding member:', error);
    }
  };

  const handleSendReminders = async () => {
    try {
      const response = await fetch(`/api/group-bookings/${params.id}/send-reminders`, {
        method: 'POST',
      });

      if (response.ok) {
        alert('Reminders sent successfully!');
      }
    } catch (error) {
      console.error('Error sending reminders:', error);
    }
  };

  const handleCancelBooking = async () => {
    if (!confirm('Are you sure you want to cancel this group booking?')) return;

    try {
      const response = await fetch(`/api/group-bookings/${params.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        router.push('/booking/group');
      }
    } catch (error) {
      console.error('Error cancelling booking:', error);
    }
  };

  const copyInvitationLink = () => {
    if (booking?.invitationToken) {
      const link = `${window.location.origin}/booking/group/invitation/${booking.invitationToken}`;
      navigator.clipboard.writeText(link);
      alert('Invitation link copied to clipboard!');
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
          <h2 className="text-2xl font-bold mb-2">Group booking not found</h2>
          <Link href="/booking/group" className="text-blue-600 hover:underline">
            Return to group bookings
          </Link>
        </div>
      </div>
    );
  }

  const confirmedMembers = booking.members?.filter((m: any) => m.status === 'CONFIRMED') || [];
  const pendingMembers = booking.members?.filter((m: any) => m.status === 'INVITED') || [];
  const paymentProgress = booking.totalAmount > 0 ? (booking.amountPaid / booking.totalAmount) * 100 : 0;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/booking/group" className="p-2 hover:bg-gray-100 rounded-lg">
                <ChevronLeft size={20} />
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{booking.groupName}</h1>
                <div className="flex items-center space-x-2 mt-1">
                  <span className={`px-3 py-1 text-sm rounded-full ${
                    booking.status === 'CONFIRMED' ? 'bg-green-100 text-green-800' :
                    booking.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                    booking.status === 'PARTIAL' ? 'bg-blue-100 text-blue-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {booking.status}
                  </span>
                  <span className="text-gray-600">•</span>
                  <span className="text-gray-600">{booking.members?.length || 0} members</span>
                  <span className="text-gray-600">•</span>
                  <span className="text-gray-600">
                    {new Date(booking.startTime).toLocaleDateString()} at{' '}
                    {new Date(booking.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Members & Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Members List */}
            <div className="bg-white rounded-xl shadow p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-semibold">Group Members</h2>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setShowInviteModal(true)}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Mail size={16} />
                    <span>Invite Member</span>
                  </button>
                  <button
                    onClick={handleSendReminders}
                    className="flex items-center space-x-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
                  >
                    <Send size={16} />
                    <span>Send Reminders</span>
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {booking.members?.map((member: any) => (
                  <div key={member.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          member.status === 'CONFIRMED' ? 'bg-green-100 text-green-600' :
                          member.status === 'INVITED' ? 'bg-yellow-100 text-yellow-600' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {member.status === 'CONFIRMED' ? <CheckCircle size={20} /> : <Clock size={20} />}
                        </div>
                        <div>
                          <div className="font-medium">
                            {member.firstName && member.lastName 
                              ? `${member.firstName} ${member.lastName}`
                              : member.email}
                          </div>
                          <div className="text-sm text-gray-600">
                            {member.email}
                            {member.phone && ` • ${member.phone}`}
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className={`px-3 py-1 text-sm rounded-full ${
                          member.status === 'CONFIRMED' ? 'bg-green-100 text-green-800' :
                          member.status === 'INVITED' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {member.status}
                        </div>
                        <div className="text-sm font-medium mt-1">${member.price?.toFixed(2)}</div>
                      </div>
                    </div>
                    
                    {member.status === 'INVITED' && (
                      <div className="mt-3 pt-3 border-t">
                        <div className="text-sm text-gray-600">
                          Invited: {new Date(member.invitedAt).toLocaleDateString()}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Booking Details */}
            <div className="bg-white rounded-xl shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Booking Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="text-sm text-gray-600 mb-1">Class/Session</div>
                  <div className="font-medium">
                    {booking.classId ? 'Yoga Class' : booking.sessionId ? 'Live Session' : 'Product'}
                  </div>
                </div>
                
                <div>
                  <div className="text-sm text-gray-600 mb-1">Date & Time</div>
                  <div className="font-medium">
                    {new Date(booking.startTime).toLocaleDateString()} at{' '}
                    {new Date(booking.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                
                <div>
                  <div className="text-sm text-gray-600 mb-1">Duration</div>
                  <div className="font-medium">
                    {Math.round((new Date(booking.endTime).getTime() - new Date(booking.startTime).getTime()) / 60000)} minutes
                  </div>
                </div>
                
                <div>
                  <div className="text-sm text-gray-600 mb-1">Pricing Type</div>
                  <div className="font-medium">{booking.pricingType}</div>
                </div>
                
                {booking.notes && (
                  <div className="col-span-2">
                    <div className="text-sm text-gray-600 mb-1">Notes</div>
                    <div className="p-3 bg-gray-50 rounded-lg">{booking.notes}</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Actions & Summary */}
          <div className="space-y-6">
            {/* Payment Summary */}
            <div className="bg-white rounded-xl shadow p-6">
              <h3 className="font-semibold mb-4">Payment Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Amount</span>
                  <span className="font-bold text-lg">${booking.totalAmount?.toFixed(2)}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600">Amount Paid</span>
                  <span className="font-medium text-green-600">
                    ${booking.amountPaid?.toFixed(2)}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600">Amount Due</span>
                  <span className="font-medium">
                    ${booking.amountDue?.toFixed(2)}
                  </span>
                </div>
                
                <div className="pt-3 border-t">
                  <div className="text-sm text-gray-600 mb-2">Payment Progress</div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500"
                      style={{ width: `${paymentProgress}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-500 mt-1 text-right">
                    {paymentProgress.toFixed(1)}%
                  </div>
                </div>
                
                {paymentLink && (
                  <Link
                    href={paymentLink}
                    className="block w-full mt-4 py-3 bg-green-600 text-white text-center rounded-lg hover:bg-green-700"
                  >
                    Make Payment
                  </Link>
                )}
              </div>
            </div>

            {/* Group Actions */}
            <div className="bg-white rounded-xl shadow p-6">
              <h3 className="font-semibold mb-4">Group Actions</h3>
              <div className="space-y-3">
                <button
                  onClick={copyInvitationLink}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-3 border rounded-lg hover:bg-gray-50"
                >
                  <Copy size={16} />
                  <span>Copy Invitation Link</span>
                </button>
                
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-3 border rounded-lg hover:bg-gray-50"
                >
                  <Mail size={16} />
                  <span>Invite More Members</span>
                </button>
                
                <button
                  onClick={handleSendReminders}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-3 border rounded-lg hover:bg-gray-50"
                >
                  <Send size={16} />
                  <span>Send Reminders</span>
                </button>
                
                <button
                  onClick={() => {}}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-3 border rounded-lg hover:bg-gray-50"
                >
                  <Edit size={16} />
                  <span>Edit Group</span>
                </button>
                
                <button
                  onClick={handleCancelBooking}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-3 border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
                >
                  <Trash2 size={16} />
                  <span>Cancel Booking</span>
                </button>
              </div>
            </div>

            {/* Group Statistics */}
            <div className="bg-white rounded-xl shadow p-6">
              <h3 className="font-semibold mb-4">Group Statistics</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Members</span>
                  <span className="font-medium">{booking.members?.length || 0}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600">Confirmed</span>
                  <span className="font-medium text-green-600">
                    {confirmedMembers.length} ({confirmedMembers.length > 0 ? Math.round((confirmedMembers.length / booking.members.length) * 100) : 0}%)
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600">Pending</span>
                  <span className="font-medium text-yellow-600">
                    {pendingMembers.length} ({pendingMembers.length > 0 ? Math.round((pendingMembers.length / booking.members.length) * 100) : 0}%)
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600">Average per Member</span>
                  <span className="font-medium">
                    ${booking.totalAmount > 0 && booking.members?.length > 0 
                      ? (booking.totalAmount / booking.members.length).toFixed(2) 
                      : '0.00'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Invite Member Modal */}
        {showInviteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold mb-2">Invite Member</h3>
              <p className="text-gray-600 mb-4">
                Enter the email address of the person you want to invite to this group.
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Email Address</label>
                  <input
                    type="email"
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                    placeholder="member@example.com"
                    className="w-full p-3 border rounded-lg"
                  />
                </div>
                
                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowInviteModal(false)}
                    className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddMember}
                    disabled={!newMemberEmail}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    Send Invitation
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}