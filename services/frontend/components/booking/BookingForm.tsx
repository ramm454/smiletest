'use client';

import { useState } from 'react';
import { Calendar, Users, Clock, Activity } from 'lucide-react';

interface BookingFormProps {
  onBookingCreated: (booking: any) => void;
}

export default function BookingForm({ onBookingCreated }: BookingFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    serviceType: 'yoga',
    className: 'Vinyasa Flow',
    date: '',
    time: '10:00',
    participants: 1,
    notes: ''
  });

  const serviceOptions = [
    { value: 'yoga', label: 'Yoga Class', icon: Activity },
    { value: 'spa', label: 'Spa Treatment', icon: Activity },
    { value: 'meditation', label: 'Meditation', icon: Activity },
  ];

  const classOptions = {
    yoga: [
      'Vinyasa Flow',
      'Hot Yoga',
      'Hatha Yoga',
      'Yin Yoga',
      'Restorative Yoga',
      'Power Yoga'
    ],
    spa: [
      'Swedish Massage',
      'Deep Tissue Massage',
      'Aromatherapy',
      'Signature Facial',
      'Body Scrub'
    ],
    meditation: [
      'Guided Meditation',
      'Mindfulness Session',
      'Breathwork Class'
    ]
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const dateTime = new Date(`${formData.date}T${formData.time}`).toISOString();
      
      const response = await fetch('/api/booking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          dateTime,
          userId: 'demo-user-' + Date.now()
        }),
      });

      if (response.ok) {
        const booking = await response.json();
        onBookingCreated(booking);
        
        // Reset form
        setFormData({
          serviceType: 'yoga',
          className: 'Vinyasa Flow',
          date: '',
          time: '10:00',
          participants: 1,
          notes: ''
        });
        
        alert('Booking created successfully!');
      } else {
        throw new Error('Failed to create booking');
      }
    } catch (error) {
      console.error('Booking error:', error);
      alert('Error creating booking. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'participants' ? parseInt(value) : value
    }));
    
    // Reset class name when service type changes
    if (name === 'serviceType') {
      setFormData(prev => ({
        ...prev,
        serviceType: value,
        className: classOptions[value as keyof typeof classOptions][0]
      }));
    }
  };

  // Set default date to tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDate = tomorrow.toISOString().split('T')[0];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Service Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Service Type
          </label>
          <div className="grid grid-cols-3 gap-2">
            {serviceOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setFormData(prev => ({
                  ...prev,
                  serviceType: option.value,
                  className: classOptions[option.value as keyof typeof classOptions][0]
                }))}
                className={`p-3 rounded-lg border ${
                  formData.serviceType === option.value
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <div className="text-center">
                  <Activity size={20} className="mx-auto mb-1" />
                  <span className="text-sm">{option.label}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Class Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Class/Treatment
          </label>
          <select
            name="className"
            value={formData.className}
            onChange={handleChange}
            className="w-full p-3 border border-gray-300 rounded-lg"
          >
            {classOptions[formData.serviceType as keyof typeof classOptions].map((className) => (
              <option key={className} value={className}>
                {className}
              </option>
            ))}
          </select>
        </div>

        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Calendar size={16} className="inline mr-2" />
            Date
          </label>
          <input
            type="date"
            name="date"
            value={formData.date || defaultDate}
            onChange={handleChange}
            min={defaultDate}
            className="w-full p-3 border border-gray-300 rounded-lg"
            required
          />
        </div>

        {/* Time */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Clock size={16} className="inline mr-2" />
            Time
          </label>
          <select
            name="time"
            value={formData.time}
            onChange={handleChange}
            className="w-full p-3 border border-gray-300 rounded-lg"
          >
            <option value="08:00">8:00 AM</option>
            <option value="09:00">9:00 AM</option>
            <option value="10:00">10:00 AM</option>
            <option value="11:00">11:00 AM</option>
            <option value="14:00">2:00 PM</option>
            <option value="15:00">3:00 PM</option>
            <option value="16:00">4:00 PM</option>
            <option value="17:00">5:00 PM</option>
            <option value="18:00">6:00 PM</option>
          </select>
        </div>

        {/* Participants */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Users size={16} className="inline mr-2" />
            Participants
          </label>
          <input
            type="range"
            name="participants"
            min="1"
            max="10"
            value={formData.participants}
            onChange={handleChange}
            className="w-full"
          />
          <div className="text-center text-lg font-semibold text-blue-600 mt-2">
            {formData.participants} {formData.participants === 1 ? 'Person' : 'People'}
          </div>
        </div>

        {/* Notes */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Special Requests
          </label>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            placeholder="Any special requirements or notes..."
            className="w-full p-3 border border-gray-300 rounded-lg h-32"
            rows={3}
          />
        </div>
      </div>

      <div className="flex justify-end space-x-4">
        <button
          type="button"
          onClick={() => setFormData({
            serviceType: 'yoga',
            className: 'Vinyasa Flow',
            date: defaultDate,
            time: '10:00',
            participants: 1,
            notes: ''
          })}
          className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
        >
          Reset
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Booking...' : 'Book Now'}
        </button>
      </div>
    </form>
  );
}