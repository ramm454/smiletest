'use client';

import { useState, useEffect } from 'react';
import { Users, UserPlus, Filter, Search, TrendingUp } from 'lucide-react';
import GroupBookingForm from '@/components/booking/GroupBookingForm';
import GroupBookingList from '@/components/booking/GroupBookingList';

export default function GroupBookingPage() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [groupBookings, setGroupBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: 'all',
    search: '',
  });

  useEffect(() => {
    fetchGroupBookings();
  }, [filters]);

  const fetchGroupBookings = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams(filters);
      const response = await fetch(`/api/group-bookings?${params}`);
      const data = await response.json();
      setGroupBookings(data.bookings || []);
    } catch (error) {
      console.error('Error fetching group bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSuccess = (data: any) => {
    setShowCreateForm(false);
    fetchGroupBookings();
  };

  const stats = {
    pending: groupBookings.filter((b: any) => b.status === 'PENDING').length,
    confirmed: groupBookings.filter((b: any) => b.status === 'CONFIRMED').length,
    total: groupBookings.length,
    totalMembers: groupBookings.reduce((sum: number, b: any) => sum + (b.members?.length || 0), 0),
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Group Bookings</h1>
              <p className="text-gray-600">Book together with friends, family, or colleagues</p>
            </div>
            
            <button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <UserPlus size={20} />
              <span>Create Group Booking</span>
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-sm text-gray-600">Total Groups</div>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <Users className="text-blue-600" size={24} />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{stats.totalMembers}</div>
                <div className="text-sm text-gray-600">Total Members</div>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <UserPlus className="text-green-600" size={24} />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{stats.pending}</div>
                <div className="text-sm text-gray-600">Pending</div>
              </div>
              <div className="p-3 bg-yellow-100 rounded-full">
                <TrendingUp className="text-yellow-600" size={24} />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{stats.confirmed}</div>
                <div className="text-sm text-gray-600">Confirmed</div>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <Users className="text-green-600" size={24} />
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
                <option value="PENDING">Pending</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="PARTIAL">Partial</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
              
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search groups..."
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
            <GroupBookingForm
              onSuccess={handleCreateSuccess}
            />
          </div>
        ) : null}

        {/* Group Bookings List */}
        <div className="bg-white rounded-xl shadow">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold">Your Group Bookings</h2>
          </div>
          
          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading group bookings...</p>
            </div>
          ) : groupBookings.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="mx-auto text-gray-400" size={48} />
              <h3 className="mt-4 text-lg font-medium">No group bookings</h3>
              <p className="text-gray-600 mt-2">
                Create your first group booking to enjoy discounts and book together
              </p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Create Group Booking
              </button>
            </div>
          ) : (
            <GroupBookingList
              bookings={groupBookings}
              onUpdate={fetchGroupBookings}
            />
          )}
        </div>

        {/* Benefits Section */}
        <div className="mt-8 p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl">
          <h3 className="font-semibold text-lg mb-4">Benefits of Group Bookings</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-white rounded-lg">
              <div className="font-medium mb-2">💰 Group Discounts</div>
              <p className="text-sm text-gray-600">Save up to 30% when booking as a group</p>
            </div>
            <div className="p-4 bg-white rounded-lg">
              <div className="font-medium mb-2">👥 Easy Coordination</div>
              <p className="text-sm text-gray-600">Invite members and track their responses in one place</p>
            </div>
            <div className="p-4 bg-white rounded-lg">
              <div className="font-medium mb-2">🎯 Flexible Payment</div>
              <p className="text-sm text-gray-600">Members can pay individually or together</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}