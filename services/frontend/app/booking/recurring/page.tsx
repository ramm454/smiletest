'use client';

import { useState, useEffect } from 'react';
import { Plus, Calendar, Repeat, Clock, Filter, Search } from 'lucide-react';
import RecurringBookingForm from '@/components/booking/RecurringBookingForm';
import RecurringBookingList from '@/components/booking/RecurringBookingList';
import Link from 'next/link';

export default function RecurringBookingPage() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [recurringBookings, setRecurringBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: 'all',
    type: 'all',
    search: '',
  });

  useEffect(() => {
    fetchRecurringBookings();
  }, [filters]);

  const fetchRecurringBookings = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams(filters);
      const response = await fetch(`/api/recurring-bookings?${params}`);
      const data = await response.json();
      setRecurringBookings(data.bookings || []);
    } catch (error) {
      console.error('Error fetching recurring bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSuccess = (data: any) => {
    setShowCreateForm(false);
    fetchRecurringBookings();
  };

  const stats = {
    active: recurringBookings.filter((b: any) => b.status === 'ACTIVE').length,
    paused: recurringBookings.filter((b: any) => b.status === 'PAUSED').length,
    total: recurringBookings.length,
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Recurring Bookings</h1>
              <p className="text-gray-600">Manage your scheduled repeating bookings</p>
            </div>
            
            <button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus size={20} />
              <span>Create Recurring Booking</span>
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{stats.active}</div>
                <div className="text-sm text-gray-600">Active</div>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <Repeat className="text-green-600" size={24} />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{stats.paused}</div>
                <div className="text-sm text-gray-600">Paused</div>
              </div>
              <div className="p-3 bg-yellow-100 rounded-full">
                <Clock className="text-yellow-600" size={24} />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-sm text-gray-600">Total</div>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <Calendar className="text-blue-600" size={24} />
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow p-6 mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-2">
              <Filter size={20} />
              <span className="font-medium">Filters</span>
            </div>
            
            <div className="flex flex-wrap gap-4">
              <select
                value={filters.status}
                onChange={(e) => setFilters({...filters, status: e.target.value})}
                className="px-4 py-2 border rounded-lg"
              >
                <option value="all">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="PAUSED">Paused</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
              
              <select
                value={filters.type}
                onChange={(e) => setFilters({...filters, type: e.target.value})}
                className="px-4 py-2 border rounded-lg"
              >
                <option value="all">All Types</option>
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
              </select>
              
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search bookings..."
                  value={filters.search}
                  onChange={(e) => setFilters({...filters, search: e.target.value})}
                  className="pl-10 pr-4 py-2 border rounded-lg w-full md:w-64"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        {showCreateForm ? (
          <div className="mb-8">
            <RecurringBookingForm
              onSuccess={handleCreateSuccess}
              onCancel={() => setShowCreateForm(false)}
            />
          </div>
        ) : null}

        {/* Recurring Bookings List */}
        <div className="bg-white rounded-xl shadow">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold">Your Recurring Bookings</h2>
          </div>
          
          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading recurring bookings...</p>
            </div>
          ) : recurringBookings.length === 0 ? (
            <div className="p-12 text-center">
              <Calendar className="mx-auto text-gray-400" size={48} />
              <h3 className="mt-4 text-lg font-medium">No recurring bookings</h3>
              <p className="text-gray-600 mt-2">
                Create your first recurring booking to save time on scheduling
              </p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Create Recurring Booking
              </button>
            </div>
          ) : (
            <RecurringBookingList
              bookings={recurringBookings}
              onUpdate={fetchRecurringBookings}
            />
          )}
        </div>

        {/* Help Section */}
        <div className="mt-8 p-6 bg-blue-50 rounded-xl">
          <h3 className="font-semibold text-lg mb-2">How Recurring Bookings Work</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-white rounded-lg">
              <div className="font-medium mb-1">1. Set Pattern</div>
              <p className="text-sm text-gray-600">Choose daily, weekly, or monthly recurrence</p>
            </div>
            <div className="p-4 bg-white rounded-lg">
              <div className="font-medium mb-1">2. Automatic Creation</div>
              <p className="text-sm text-gray-600">Bookings are created automatically based on your pattern</p>
            </div>
            <div className="p-4 bg-white rounded-lg">
              <div className="font-medium mb-1">3. Easy Management</div>
              <p className="text-sm text-gray-600">Pause, cancel, or modify your entire series</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}