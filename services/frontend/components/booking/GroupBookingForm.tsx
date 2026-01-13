'use client';

import { useState } from 'react';
import { Users, Mail, UserPlus, Trash2, Copy, Send, CreditCard } from 'lucide-react';

interface GroupBookingFormProps {
  classData?: any;
  onSuccess?: (data: any) => void;
}

export default function GroupBookingForm({ classData, onSuccess }: GroupBookingFormProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    // Step 1: Group Info
    groupName: '',
    classId: classData?.id || '',
    startTime: '',
    endTime: '',
    minParticipants: 2,
    maxParticipants: classData?.capacity || 10,
    
    // Step 2: Members
    members: [
      {
        email: '',
        firstName: '',
        lastName: '',
        phone: '',
        isPrimary: true,
        price: classData?.price || 0,
      },
    ] as Array<{
      email: string;
      firstName: string;
      lastName: string;
      phone: string;
      isPrimary: boolean;
      price: number;
    }>,
    
    // Step 3: Pricing
    pricingType: 'PER_PERSON',
    groupPrice: classData?.price ? classData.price * 2 : 0,
    discountPercentage: 0,
    
    // Step 4: Settings
    requireAllPayment: false,
    notes: '',
    specialRequests: '',
  });

  const [invitationLink, setInvitationLink] = useState<string>('');
  const [showPayment, setShowPayment] = useState(false);

  const addMember = () => {
    setFormData(prev => ({
      ...prev,
      members: [
        ...prev.members,
        {
          email: '',
          firstName: '',
          lastName: '',
          phone: '',
          isPrimary: false,
          price: calculateMemberPrice(prev.members.length + 1),
        },
      ],
    }));
  };

  const removeMember = (index: number) => {
    if (formData.members.length <= 1) return;
    
    setFormData(prev => ({
      ...prev,
      members: prev.members.filter((_, i) => i !== index),
    }));
  };

  const updateMember = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      members: prev.members.map((member, i) =>
        i === index ? { ...member, [field]: value } : member
      ),
    }));
  };

  const setPrimaryMember = (index: number) => {
    setFormData(prev => ({
      ...prev,
      members: prev.members.map((member, i) => ({
        ...member,
        isPrimary: i === index,
      })),
    }));
  };

  const calculateMemberPrice = (memberCount: number): number => {
    const basePrice = classData?.price || 50;
    
    switch (formData.pricingType) {
      case 'FIXED':
        return formData.groupPrice / memberCount;
      
      case 'TIERED':
        if (memberCount <= 5) return basePrice;
        return basePrice * 0.8; // 20% discount after 5 members
      
      case 'PER_PERSON':
      default:
        return basePrice;
    }
  };

  const calculateTotalPrice = (): number => {
    const memberCount = formData.members.length;
    
    switch (formData.pricingType) {
      case 'FIXED':
        return formData.groupPrice;
      
      case 'TIERED':
        const tier1 = Math.min(5, memberCount);
        const tier2 = Math.max(0, memberCount - 5);
        const basePrice = classData?.price || 50;
        return (tier1 * basePrice) + (tier2 * basePrice * 0.8);
      
      default:
        return formData.members.reduce((sum, member) => sum + member.price, 0);
    }
  };

  const handleCreateGroup = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/group-bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          totalAmount: calculateTotalPrice(),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setInvitationLink(`${window.location.origin}/group-invitation/${data.invitationToken}`);
        setStep(4);
        onSuccess?.(data);
      } else {
        throw new Error('Failed to create group booking');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to create group booking');
    } finally {
      setLoading(false);
    }
  };

  const sendInvitations = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/group-bookings/send-invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupBookingId: formData.members[0]?.email, // This would be actual group ID
          members: formData.members,
        }),
      });

      if (response.ok) {
        alert('Invitations sent successfully!');
      }
    } catch (error) {
      console.error('Error sending invitations:', error);
      alert('Failed to send invitations');
    } finally {
      setLoading(false);
    }
  };

  const copyInvitationLink = () => {
    navigator.clipboard.writeText(invitationLink);
    alert('Link copied to clipboard!');
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold">Create Group Booking</h2>
        <p className="text-gray-600">
          Book together with friends, family, or colleagues
        </p>
      </div>

      {/* Step Indicator */}
      <div className="mb-8">
        <div className="flex space-x-2 mb-4">
          {['Group Info', 'Add Members', 'Pricing', 'Invite'].map((label, index) => (
            <div
              key={label}
              className={`flex-1 text-center py-2 rounded-lg ${
                step > index + 1 ? 'bg-green-100 text-green-700' :
                step === index + 1 ? 'bg-blue-100 text-blue-700' :
                'bg-gray-100 text-gray-500'
              }`}
            >
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Step 1: Group Info */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Group Name</label>
              <input
                type="text"
                value={formData.groupName}
                onChange={(e) => setFormData({...formData, groupName: e.target.value})}
                placeholder="e.g., Team Yoga, Family Session"
                className="w-full p-3 border rounded-lg"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Class</label>
              <div className="p-3 border rounded-lg bg-gray-50">
                <div className="font-medium">{classData?.title || 'Select a class'}</div>
                {classData && (
                  <div className="text-sm text-gray-600">
                    {classData.instructor} • {classData.duration}min • ${classData.price}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Start Time</label>
              <input
                type="datetime-local"
                value={formData.startTime}
                onChange={(e) => setFormData({...formData, startTime: e.target.value})}
                className="w-full p-3 border rounded-lg"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">End Time</label>
              <input
                type="datetime-local"
                value={formData.endTime}
                onChange={(e) => setFormData({...formData, endTime: e.target.value})}
                className="w-full p-3 border rounded-lg"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Minimum Participants</label>
              <input
                type="number"
                min="2"
                max={formData.maxParticipants}
                value={formData.minParticipants}
                onChange={(e) => setFormData({...formData, minParticipants: parseInt(e.target.value)})}
                className="w-full p-3 border rounded-lg"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Maximum Participants</label>
              <input
                type="number"
                min={formData.minParticipants}
                max={classData?.capacity || 50}
                value={formData.maxParticipants}
                onChange={(e) => setFormData({...formData, maxParticipants: parseInt(e.target.value)})}
                className="w-full p-3 border rounded-lg"
              />
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Add Members */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="font-medium">Group Members ({formData.members.length})</h3>
            <button
              type="button"
              onClick={addMember}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <UserPlus size={16} />
              <span>Add Member</span>
            </button>
          </div>

          <div className="space-y-4 max-h-96 overflow-y-auto">
            {formData.members.map((member, index) => (
              <div key={index} className="p-4 border rounded-lg">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center space-x-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      member.isPrimary ? 'bg-blue-100 text-blue-600' : 'bg-gray-100'
                    }`}>
                      <Users size={16} />
                    </div>
                    <div>
                      <div className="font-medium">
                        {member.firstName && member.lastName 
                          ? `${member.firstName} ${member.lastName}`
                          : `Member ${index + 1}`}
                        {member.isPrimary && (
                          <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                            Primary
                          </span>
                        )}
                      </div>
                      {member.email && (
                        <div className="text-sm text-gray-600">{member.email}</div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    {!member.isPrimary && (
                      <button
                        type="button"
                        onClick={() => setPrimaryMember(index)}
                        className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
                      >
                        Make Primary
                      </button>
                    )}
                    {formData.members.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeMember(index)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Email *</label>
                    <input
                      type="email"
                      value={member.email}
                      onChange={(e) => updateMember(index, 'email', e.target.value)}
                      className="w-full p-2 border rounded"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Price</label>
                    <div className="flex items-center">
                      <span className="mr-2">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={member.price}
                        onChange={(e) => updateMember(index, 'price', parseFloat(e.target.value))}
                        className="w-full p-2 border rounded"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">First Name</label>
                    <input
                      type="text"
                      value={member.firstName}
                      onChange={(e) => updateMember(index, 'firstName', e.target.value)}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Last Name</label>
                    <input
                      type="text"
                      value={member.lastName}
                      onChange={(e) => updateMember(index, 'lastName', e.target.value)}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="flex justify-between items-center">
              <div>
                <div className="font-medium">Total Price</div>
                <div className="text-2xl font-bold">${calculateTotalPrice().toFixed(2)}</div>
                <div className="text-sm text-gray-600">
                  ${(calculateTotalPrice() / formData.members.length).toFixed(2)} per person
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-600">Participants</div>
                <div className="text-xl font-bold">{formData.members.length}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Pricing & Payment */}
      {step === 3 && (
        <div className="space-y-6">
          <div>
            <h3 className="font-medium mb-4">Pricing Type</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { value: 'PER_PERSON', label: 'Per Person', description: 'Each member pays individually' },
                { value: 'FIXED', label: 'Fixed Price', description: 'Total price split evenly' },
                { value: 'TIERED', label: 'Tiered', description: 'Discounts for larger groups' },
              ].map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setFormData({...formData, pricingType: type.value})}
                  className={`p-4 border rounded-lg text-left ${
                    formData.pricingType === type.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="font-medium">{type.label}</div>
                  <div className="text-sm text-gray-600 mt-1">{type.description}</div>
                </button>
              ))}
            </div>
          </div>

          {formData.pricingType === 'FIXED' && (
            <div>
              <label className="block text-sm font-medium mb-2">Group Price</label>
              <div className="flex items-center">
                <span className="mr-2 text-xl">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.groupPrice}
                  onChange={(e) => setFormData({...formData, groupPrice: parseFloat(e.target.value)})}
                  className="w-full p-3 text-xl border rounded-lg"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">Group Discount</label>
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="5"
                  value={formData.discountPercentage}
                  onChange={(e) => setFormData({...formData, discountPercentage: parseInt(e.target.value)})}
                  className="w-full"
                />
                <div className="flex justify-between text-sm text-gray-600">
                  <span>0%</span>
                  <span>25%</span>
                  <span>50%</span>
                </div>
              </div>
              <div className="text-2xl font-bold w-20 text-right">
                {formData.discountPercentage}%
              </div>
            </div>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-600">Subtotal</div>
                <div className="text-xl">${calculateTotalPrice().toFixed(2)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Discount</div>
                <div className="text-xl text-green-600">
                  -${(calculateTotalPrice() * formData.discountPercentage / 100).toFixed(2)}
                </div>
              </div>
              <div className="col-span-2 pt-4 border-t">
                <div className="flex justify-between items-center">
                  <div className="text-lg font-bold">Total</div>
                  <div className="text-2xl font-bold">
                    ${(calculateTotalPrice() * (1 - formData.discountPercentage / 100)).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Invitation & Payment */}
      {step === 4 && (
        <div className="space-y-6">
          {invitationLink ? (
            <>
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center space-x-2 text-green-700 mb-2">
                  <Send size={20} />
                  <span className="font-medium">Group Booking Created!</span>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  Share this link with your group members. They'll be able to confirm their participation and make payments.
                </p>
                
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={invitationLink}
                    readOnly
                    className="flex-1 p-2 border rounded"
                  />
                  <button
                    onClick={copyInvitationLink}
                    className="px-4 py-2 border rounded hover:bg-gray-50"
                  >
                    <Copy size={16} />
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <button
                  onClick={sendInvitations}
                  disabled={loading}
                  className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Send Email Invitations
                </button>
                
                <button
                  onClick={() => setShowPayment(true)}
                  className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <CreditCard className="inline mr-2" size={16} />
                  Proceed to Payment
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-500">Creating your group booking...</div>
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-8 pt-6 border-t">
        <button
          type="button"
          onClick={() => setStep(Math.max(1, step - 1))}
          disabled={step === 1}
          className="px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Back
        </button>
        
        {step < 4 ? (
          <button
            type="button"
            onClick={() => {
              if (step === 3) {
                handleCreateGroup();
              } else {
                setStep(step + 1);
              }
            }}
            disabled={loading || (step === 2 && formData.members.some(m => !m.email))}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Processing...' : step === 3 ? 'Create Group' : 'Continue'}
          </button>
        ) : null}
      </div>
    </div>
  );
}