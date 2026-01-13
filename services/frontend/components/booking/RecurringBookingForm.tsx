'use client';

import { useState } from 'react';
import { Calendar, Repeat, Users, CalendarDays, X, Check } from 'lucide-react';

interface RecurringBookingFormProps {
  initialData?: any;
  onSuccess?: (data: any) => void;
  onCancel?: () => void;
}

export default function RecurringBookingForm({ initialData, onSuccess, onCancel }: RecurringBookingFormProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    // Step 1: Basic Info
    classId: initialData?.classId || '',
    firstOccurrence: '',
    duration: 60,
    
    // Step 2: Recurrence Pattern
    recurrenceType: 'WEEKLY',
    repeatEvery: 1,
    daysOfWeek: [] as number[],
    customRule: '',
    
    // Step 3: End Conditions
    endCondition: 'date',
    endDate: '',
    occurrenceCount: 4,
    
    // Step 4: Participants & Details
    participants: 1,
    participantNames: [] as string[],
    guestEmails: [] as string[],
    notes: '',
    specialRequests: '',
    
    // Step 5: Payment
    skipFirstPayment: false,
    paymentPlan: 'monthly',
  });

  const recurrenceTypes = [
    { value: 'DAILY', label: 'Daily', description: 'Every day' },
    { value: 'WEEKLY', label: 'Weekly', description: 'Every week on selected days' },
    { value: 'BIWEEKLY', label: 'Bi-weekly', description: 'Every two weeks' },
    { value: 'MONTHLY', label: 'Monthly', description: 'Every month on same date' },
    { value: 'CUSTOM', label: 'Custom', description: 'Advanced recurrence pattern' },
  ];

  const daysOfWeek = [
    { value: 0, label: 'Sunday', short: 'Sun' },
    { value: 1, label: 'Monday', short: 'Mon' },
    { value: 2, label: 'Tuesday', short: 'Tue' },
    { value: 3, label: 'Wednesday', short: 'Wed' },
    { value: 4, label: 'Thursday', short: 'Thu' },
    { value: 5, label: 'Friday', short: 'Fri' },
    { value: 6, label: 'Saturday', short: 'Sat' },
  ];

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/recurring-bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const data = await response.json();
        onSuccess?.(data);
      } else {
        throw new Error('Failed to create recurring booking');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to create recurring booking');
    } finally {
      setLoading(false);
    }
  };

  const toggleDay = (day: number) => {
    setFormData(prev => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter(d => d !== day)
        : [...prev.daysOfWeek, day],
    }));
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Select Start Date & Duration</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  <Calendar className="inline mr-2" size={16} />
                  First Occurrence
                </label>
                <input
                  type="date"
                  value={formData.firstOccurrence}
                  onChange={(e) => setFormData({...formData, firstOccurrence: e.target.value})}
                  className="w-full p-2 border rounded"
                  min={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">
                  Duration (minutes)
                </label>
                <select
                  value={formData.duration}
                  onChange={(e) => setFormData({...formData, duration: parseInt(e.target.value)})}
                  className="w-full p-2 border rounded"
                >
                  <option value={30}>30 minutes</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>60 minutes</option>
                  <option value={75}>75 minutes</option>
                  <option value={90}>90 minutes</option>
                </select>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Recurrence Pattern</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Recurrence Type</label>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {recurrenceTypes.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setFormData({...formData, recurrenceType: type.value})}
                      className={`p-3 border rounded-lg text-center ${
                        formData.recurrenceType === type.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="font-medium">{type.label}</div>
                      <div className="text-xs text-gray-500">{type.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {formData.recurrenceType === 'WEEKLY' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2">Repeat Every</label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        min="1"
                        max="52"
                        value={formData.repeatEvery}
                        onChange={(e) => setFormData({...formData, repeatEvery: parseInt(e.target.value)})}
                        className="w-20 p-2 border rounded"
                      />
                      <span>week(s)</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Days of Week</label>
                    <div className="flex flex-wrap gap-2">
                      {daysOfWeek.map((day) => (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => toggleDay(day.value)}
                          className={`px-4 py-2 border rounded-lg ${
                            formData.daysOfWeek.includes(day.value)
                              ? 'bg-blue-100 border-blue-500 text-blue-700'
                              : 'border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {day.short}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {formData.recurrenceType === 'CUSTOM' && (
                <div>
                  <label className="block text-sm font-medium mb-2">Custom RRULE</label>
                  <input
                    type="text"
                    value={formData.customRule}
                    onChange={(e) => setFormData({...formData, customRule: e.target.value})}
                    placeholder="FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR"
                    className="w-full p-2 border rounded"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Enter recurrence rule in RRULE format
                  </p>
                </div>
              )}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">End Conditions</h3>
            
            <div className="space-y-4">
              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => setFormData({...formData, endCondition: 'date'})}
                  className={`px-4 py-2 border rounded-lg ${
                    formData.endCondition === 'date'
                      ? 'bg-blue-100 border-blue-500 text-blue-700'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  End Date
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({...formData, endCondition: 'count'})}
                  className={`px-4 py-2 border rounded-lg ${
                    formData.endCondition === 'count'
                      ? 'bg-blue-100 border-blue-500 text-blue-700'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  After X Occurrences
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({...formData, endCondition: 'never'})}
                  className={`px-4 py-2 border rounded-lg ${
                    formData.endCondition === 'never'
                      ? 'bg-blue-100 border-blue-500 text-blue-700'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Never End
                </button>
              </div>

              {formData.endCondition === 'date' && (
                <div>
                  <label className="block text-sm font-medium mb-2">End Date</label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                    className="w-full p-2 border rounded"
                    min={formData.firstOccurrence}
                  />
                </div>
              )}

              {formData.endCondition === 'count' && (
                <div>
                  <label className="block text-sm font-medium mb-2">Number of Occurrences</label>
                  <input
                    type="number"
                    min="2"
                    max="100"
                    value={formData.occurrenceCount}
                    onChange={(e) => setFormData({...formData, occurrenceCount: parseInt(e.target.value)})}
                    className="w-full p-2 border rounded"
                  />
                </div>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">Create Recurring Booking</h2>
        {onCancel && (
          <button
            onClick={onCancel}
            className="p-2 text-gray-500 hover:text-gray-700"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Step Progress */}
      <div className="mb-8">
        <div className="flex justify-between mb-2">
          {[1, 2, 3, 4, 5].map((stepNum) => (
            <div
              key={stepNum}
              className={`flex-1 h-2 mx-1 rounded-full ${
                stepNum < step ? 'bg-green-500' :
                stepNum === step ? 'bg-blue-500' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
        <div className="flex justify-between text-xs text-gray-500">
          <span>Start Date</span>
          <span>Recurrence</span>
          <span>End Date</span>
          <span>Details</span>
          <span>Payment</span>
        </div>
      </div>

      {/* Form Content */}
      {renderStep()}

      {/* Navigation */}
      <div className="flex justify-between mt-8 pt-6 border-t">
        <button
          type="button"
          onClick={() => setStep(Math.max(1, step - 1))}
          disabled={step === 1}
          className="px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        
        <div className="flex items-center space-x-2">
          {step < 5 ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Recurring Booking'}
            </button>
          )}
        </div>
      </div>

      {/* Preview */}
      {step > 1 && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium mb-2">Preview</h4>
          <p className="text-sm text-gray-600">
            {getPreviewText(formData)}
          </p>
        </div>
      )}
    </div>
  );
}

function getPreviewText(data: any): string {
  const startDate = new Date(data.firstOccurrence).toLocaleDateString();
  
  if (data.recurrenceType === 'WEEKLY') {
    const days = data.daysOfWeek.map((d: number) => 
      ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]
    ).join(', ');
    
    let endText = '';
    if (data.endCondition === 'date') {
      endText = ` until ${new Date(data.endDate).toLocaleDateString()}`;
    } else if (data.endCondition === 'count') {
      endText = ` for ${data.occurrenceCount} occurrences`;
    }
    
    return `Every ${data.repeatEvery} week(s) on ${days} starting ${startDate}${endText}`;
  }
  
  return `Starting ${startDate}`;
}