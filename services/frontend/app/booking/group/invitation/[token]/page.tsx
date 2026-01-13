'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CheckCircle, XCircle, Users, Calendar, DollarSign, Mail } from 'lucide-react';

export default function GroupInvitationPage() {
  const params = useParams();
  const router = useRouter();
  const [invitation, setInvitation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    if (params.token) {
      fetchInvitation();
    }
  }, [params.token]);

  const fetchInvitation = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/group-invitation/${params.token}`);
      const data = await response.json();
      setInvitation(data);
      
      // Try to get user email from localStorage or cookies
      const storedEmail = localStorage.getItem('userEmail') || '';
      setUserEmail(storedEmail);
    } catch (error) {
      console.error('Error fetching invitation:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!userEmail) {
      alert('Please enter your email address');
      return;
    }

    setAccepting(true);
    try {
      const response = await fetch(`/api/group-invitation/${params.token}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail }),
      });

      if (response.ok) {
        const data = await response.json();
        router.push(`/booking/group/${data.groupBookingId}`);
      } else {
        throw new Error('Failed to accept invitation');
      }
    } catch (error) {
      console.error('Error accepting invitation:', error);
      alert('Failed to accept invitation. Please try again.');
    } finally {
      setAccepting(false);
    }
  };

  const handleDecline = async () => {
    setDeclining(true);
    try {
      const response = await fetch(`/api/group-invitation/${params.token}/decline`, {
        method: 'POST',
      });

      if (response.ok) {
        alert('You have declined the invitation.');
        router.push('/');
      }
    } catch (error) {
      console.error('Error declining invitation:', error);
      alert('Failed to decline invitation. Please try again.');
    } finally {
      setDeclining(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading invitation...</p>
        </div>
      </div>
    );
  }

  if (!invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="text-center">
          <XCircle className="mx-auto text-red-500" size={64} />
          <h2 className="text-2xl font-bold mt-4">Invitation Not Found</h2>
          <p className="text-gray-600 mt-2">This invitation may have expired or been cancelled.</p>
        </div>
      </div>
    );
  }

  if (invitation.status !== 'INVITED') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="text-center">
          {invitation.status === 'CONFIRMED' ? (
            <CheckCircle className="mx-auto text-green-500" size={64} />
          ) : (
            <XCircle className="mx-auto text-red-500" size={64} />
          )}
          <h2 className="text-2xl font-bold mt-4">
            Invitation {invitation.status === 'CONFIRMED' ? 'Accepted' : 'Declined'}
          </h2>
          <p className="text-gray-600 mt-2">
            {invitation.status === 'CONFIRMED' 
              ? 'You have already accepted this invitation.'
              : 'You have declined this invitation.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-8 text-white text-center">
            <Users className="mx-auto" size={64} />
            <h1 className="text-3xl font-bold mt-4">Group Booking Invitation</h1>
            <p className="text-blue-100 mt-2">You've been invited to join a group booking!</p>
          </div>

          {/* Content */}
          <div className="p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900">{invitation.groupName}</h2>
              <p className="text-gray-600 mt-2">
                Invited by: {invitation.invitedBy || 'A friend'}
              </p>
            </div>

            {/* Booking Details */}
            <div className="space-y-6 mb-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 bg-blue-50 rounded-xl">
                  <div className="flex items-center space-x-3">
                    <Calendar className="text-blue-600" size={24} />
                    <div>
                      <div className="font-medium">Date & Time</div>
                      <div className="text-sm text-gray-600">
                        {new Date(invitation.startTime).toLocaleDateString()} at{' '}
                        {new Date(invitation.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-green-50 rounded-xl">
                  <div className="flex items-center space-x-3">
                    <DollarSign className="text-green-600" size={24} />
                    <div>
                      <div className="font-medium">Your Price</div>
                      <div className="text-2xl font-bold text-green-700">
                        ${invitation.price?.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-xl">
                <div className="text-center">
                  <div className="text-sm text-gray-600">Group Size</div>
                  <div className="text-xl font-bold">
                    {invitation.confirmedMembers || 0} of {invitation.totalMembers || 0} confirmed
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden mt-2">
                    <div
                      className="h-full bg-green-500"
                      style={{ width: `${((invitation.confirmedMembers || 0) / (invitation.totalMembers || 1)) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Email Input */}
            <div className="mb-8">
              <label className="block text-sm font-medium mb-2">
                <Mail className="inline mr-2" size={16} />
                Your Email Address
              </label>
              <input
                type="email"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full p-3 border rounded-lg"
                required
              />
              <p className="text-sm text-gray-500 mt-1">
                We'll send booking confirmation to this email
              </p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-4">
              <button
                onClick={handleAccept}
                disabled={accepting || !userEmail}
                className="w-full py-4 bg-green-600 text-white text-lg font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {accepting ? 'Accepting...' : `Accept Invitation & Pay $${invitation.price?.toFixed(2)}`}
              </button>

              <button
                onClick={handleDecline}
                disabled={declining}
                className="w-full py-3 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50"
              >
                {declining ? 'Declining...' : 'Decline Invitation'}
              </button>
            </div>

            {/* Additional Info */}
            <div className="mt-8 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <div className="text-sm text-yellow-800">
                <strong>Note:</strong> By accepting, you'll be added to the group booking and can
                view details on your bookings page. Payment will be processed immediately.
              </div>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-8 bg-white rounded-xl shadow p-6">
          <h3 className="font-semibold text-lg mb-4">Frequently Asked Questions</h3>
          <div className="space-y-4">
            <div>
              <div className="font-medium">What happens after I accept?</div>
              <p className="text-sm text-gray-600">
                You'll be added to the group booking and your spot will be reserved. You'll receive
                confirmation email with all details.
              </p>
            </div>
            <div>
              <div className="font-medium">Can I cancel later?</div>
              <p className="text-sm text-gray-600">
                Yes, you can cancel up to 24 hours before the booking for a full refund. Check the
                cancellation policy for details.
              </p>
            </div>
            <div>
              <div className="font-medium">Who do I contact for questions?</div>
              <p className="text-sm text-gray-600">
                Contact the group organizer or email support@yogaspa.com for assistance.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}