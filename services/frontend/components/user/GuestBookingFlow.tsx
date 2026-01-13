'use client';
import { useState } from 'react';
import { Calendar, User, Mail, Lock, ArrowRight } from 'lucide-react';
import { useGuestSession } from './GuestSessionProvider';

interface GuestBookingFlowProps {
  classId: string;
  className: string;
  onSuccess: (booking: any) => void;
}

export default function GuestBookingFlow({ classId, className, onSuccess }: GuestBookingFlowProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    createAccount: false,
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const { session, createGuestSession, convertToAccount } = useGuestSession();

  const handleGuestBooking = async () => {
    setLoading(true);
    try {
      // Create or get guest session
      let guestSession = session;
      if (!guestSession) {
        guestSession = await createGuestSession(formData.email);
      }

      // Make booking as guest
      const bookingResponse = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId,
          guestSessionId: guestSession?.sessionId,
          guestUserId: guestSession?.guestUserId,
          participantInfo: {
            email: formData.email,
            firstName: formData.firstName,
            lastName: formData.lastName,
            phone: formData.phone
          }
        })
      });

      if (!bookingResponse.ok) throw new Error('Booking failed');

      const booking = await bookingResponse.json();
      
      if (formData.createAccount && formData.password) {
        // Convert to account
        await convertToAccount({
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName,
          lastName: formData.lastName,
          keepCart: true
        });
      }

      onSuccess(booking);
    } catch (error) {
      console.error('Booking error:', error);
      alert('Booking failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-xl shadow-lg">
      <h2 className="text-2xl font-bold text-gray-800 mb-2">Book as Guest</h2>
      <p className="text-gray-600 mb-6">Quick booking without account creation</p>
      
      <div className="mb-6 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-semibold text-blue-800 mb-2">{className}</h3>
        <p className="text-sm text-blue-600">Booking as guest user</p>
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Mail size={16} className="inline mr-2" />
              Email Address *
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="w-full p-3 border border-gray-300 rounded-lg"
              placeholder="your@email.com"
              required
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <User size={16} className="inline mr-2" />
                First Name
              </label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                className="w-full p-3 border border-gray-300 rounded-lg"
                placeholder="John"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <User size={16} className="inline mr-2" />
                Last Name
              </label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                className="w-full p-3 border border-gray-300 rounded-lg"
                placeholder="Doe"
              />
            </div>
          </div>
          
          <div className="flex items-center">
            <input
              type="checkbox"
              id="createAccount"
              checked={formData.createAccount}
              onChange={(e) => setFormData({...formData, createAccount: e.target.checked})}
              className="mr-2"
            />
            <label htmlFor="createAccount" className="text-sm text-gray-700">
              Create account after booking
            </label>
          </div>
          
          <button
            onClick={() => setStep(2)}
            className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Continue <ArrowRight size={20} className="inline ml-2" />
          </button>
          
          <p className="text-xs text-gray-500 text-center">
            By continuing, you agree to our Terms and Privacy Policy
          </p>
        </div>
      )}
      
      {step === 2 && formData.createAccount && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Lock size={16} className="inline mr-2" />
              Create Password *
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              className="w-full p-3 border border-gray-300 rounded-lg"
              placeholder="••••••••"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Lock size={16} className="inline mr-2" />
              Confirm Password *
            </label>
            <input
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
              className="w-full p-3 border border-gray-300 rounded-lg"
              placeholder="••••••••"
              required
            />
          </div>
          
          <div className="flex gap-4">
            <button
              onClick={() => setStep(1)}
              className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Back
            </button>
            <button
              onClick={handleGuestBooking}
              disabled={loading || formData.password !== formData.confirmPassword}
              className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Complete Booking'}
            </button>
          </div>
        </div>
      )}
      
      {step === 2 && !formData.createAccount && (
        <div className="space-y-4">
          <p className="text-gray-600">
            You'll receive booking confirmation at <strong>{formData.email}</strong>
          </p>
          
          <div className="flex gap-4">
            <button
              onClick={() => setStep(1)}
              className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Back
            </button>
            <button
              onClick={handleGuestBooking}
              disabled={loading}
              className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Confirm Booking'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}