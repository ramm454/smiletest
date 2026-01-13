'use client';

import { useState, useEffect } from 'react';
import {
  Calendar,
  TrendingUp,
  Users,
  DollarSign,
  BarChart3,
  PieChart,
  Clock,
  Target,
  Download,
  RefreshCw,
  Filter,
} from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState('30days');
  const [startDate, setStartDate] = useState<Date>(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  const timeRanges = [
    { value: '7days', label: 'Last 7 days' },
    { value: '30days', label: 'Last 30 days' },
    { value: '90days', label: 'Last 90 days' },
    { value: 'year', label: 'Last year' },
    { value: 'custom', label: 'Custom range' },
  ];

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        groupBy: 'day',
      });

      const response = await fetch(`/api/analytics?${params}`);
      const analyticsData = await response.json();
      setData(analyticsData);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [startDate, endDate]);

  const handleTimeRangeChange = (value: string) => {
    setTimeRange(value);
    const now = new Date();
    
    switch (value) {
      case '7days':
        setStartDate(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
        break;
      case '30days':
        setStartDate(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));
        break;
      case '90days':
        setStartDate(new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000));
        break;
      case 'year':
        setStartDate(new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000));
        break;
    }
    setEndDate(now);
  };

  const exportData = () => {
    const exportPayload = {
      ...data,
      exportedAt: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
      type: 'application/json',
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Booking Analytics</h1>
              <p className="text-gray-600">Track performance and optimize your booking strategy</p>
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={exportData}
                className="flex items-center space-x-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                <Download size={16} />
                <span>Export</span>
              </button>
              
              <button
                onClick={fetchAnalytics}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <RefreshCw size={16} />
                <span>Refresh</span>
              </button>
            </div>
          </div>
        </div>

        {/* Time Range Selector */}
        <div className="mb-8 p-4 bg-white rounded-xl shadow">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-2">
              <Filter size={20} />
              <span className="font-medium">Time Range:</span>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {timeRanges.map((range) => (
                <button
                  key={range.value}
                  onClick={() => handleTimeRangeChange(range.value)}
                  className={`px-4 py-2 rounded-lg ${
                    timeRange === range.value
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>
            
            {timeRange === 'custom' && (
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Calendar size={16} />
                  <DatePicker
                    selected={startDate}
                    onChange={setStartDate}
                    selectsStart
                    startDate={startDate}
                    endDate={endDate}
                    className="p-2 border rounded"
                  />
                </div>
                <span>to</span>
                <div className="flex items-center space-x-2">
                  <Calendar size={16} />
                  <DatePicker
                    selected={endDate}
                    onChange={setEndDate}
                    selectsEnd
                    startDate={startDate}
                    endDate={endDate}
                    minDate={startDate}
                    className="p-2 border rounded"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <SummaryCard
            title="Total Bookings"
            value={data?.summary?.totalBookings || 0}
            icon={<Users className="text-blue-600" size={24} />}
            change={12}
            trend="up"
          />
          
          <SummaryCard
            title="Revenue"
            value={`$${(data?.summary?.revenue || 0).toLocaleString()}`}
            icon={<DollarSign className="text-green-600" size={24} />}
            change={8.5}
            trend="up"
          />
          
          <SummaryCard
            title="Cancellation Rate"
            value={`${(data?.summary?.cancellationRate || 0).toFixed(1)}%`}
            icon={<Target className="text-red-600" size={24} />}
            change={-2.3}
            trend="down"
          />
          
          <SummaryCard
            title="Avg Booking Value"
            value={`$${(data?.summary?.averageBookingValue || 0).toFixed(2)}`}
            icon={<BarChart3 className="text-purple-600" size={24} />}
            change={5.2}
            trend="up"
          />
        </div>

        {/* Charts & Graphs */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Revenue Trend */}
          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold">Revenue Trend</h3>
              <TrendingUp size={20} className="text-green-600" />
            </div>
            <div className="h-64">
              {/* Chart would be implemented with a charting library like Recharts */}
              <div className="flex items-end h-48 space-x-2">
                {data?.trends?.slice(-14).map((day: any, index: number) => (
                  <div key={index} className="flex-1 flex flex-col items-center">
                    <div
                      className="w-full bg-gradient-to-t from-green-500 to-green-300 rounded-t"
                      style={{ height: `${(day.revenue / 100) * 80}%` }}
                    />
                    <div className="text-xs text-gray-500 mt-2">
                      {new Date(day.date).getDate()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Booking Status Distribution */}
          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold">Booking Status</h3>
              <PieChart size={20} className="text-blue-600" />
            </div>
            <div className="h-64 flex items-center justify-center">
              {/* Pie chart would go here */}
              <div className="relative w-48 h-48">
                <div className="absolute inset-0 rounded-full border-8 border-green-500"></div>
                <div className="absolute inset-0 rounded-full border-8 border-yellow-500" style={{ clipPath: 'inset(0 50% 0 0)' }}></div>
                <div className="absolute inset-0 rounded-full border-8 border-red-500" style={{ clipPath: 'inset(0 0 50% 50%)' }}></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {data?.summary?.confirmedBookings || 0}
                    </div>
                    <div className="text-sm text-gray-600">Confirmed</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Popular Classes & Peak Hours */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Popular Classes */}
          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="text-lg font-semibold mb-6">Popular Classes</h3>
            <div className="space-y-4">
              {data?.popularClasses?.slice(0, 5).map((classItem: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded">
                  <div>
                    <div className="font-medium">{classItem.className}</div>
                    <div className="text-sm text-gray-600">
                      {classItem.instructor} • {classItem.bookingCount} bookings
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">${classItem.totalRevenue}</div>
                    <div className="text-sm text-gray-600">
                      ${classItem.averageRevenue.toFixed(2)} avg
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Peak Hours */}
          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold">Peak Booking Hours</h3>
              <Clock size={20} className="text-purple-600" />
            </div>
            <div className="space-y-3">
              {data?.peakHours?.map((hour: any, index: number) => (
                <div key={index} className="flex items-center">
                  <div className="w-16 text-sm">{hour.hourFormatted}</div>
                  <div className="flex-1 ml-4">
                    <div className="h-6 bg-gradient-to-r from-purple-500 to-purple-300 rounded"
                         style={{ width: `${(hour.bookingCount / 20) * 100}%` }}>
                      <div className="text-xs text-white pl-2 leading-6">
                        {hour.bookingCount} bookings
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Detailed Analytics */}
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-semibold mb-6">Detailed Analytics</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3">Date</th>
                  <th className="text-left py-3">Total Bookings</th>
                  <th className="text-left py-3">Confirmed</th>
                  <th className="text-left py-3">Cancelled</th>
                  <th className="text-left py-3">Revenue</th>
                  <th className="text-left py-3">Avg Value</th>
                </tr>
              </thead>
              <tbody>
                {data?.trends?.slice(-10).reverse().map((day: any, index: number) => (
                  <tr key={index} className="border-b hover:bg-gray-50">
                    <td className="py-3">{new Date(day.date).toLocaleDateString()}</td>
                    <td className="py-3">{day.total}</td>
                    <td className="py-3">
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">
                        {day.confirmed}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-sm">
                        {day.cancelled}
                      </span>
                    </td>
                    <td className="py-3 font-medium">${day.revenue.toFixed(2)}</td>
                    <td className="py-3">
                      ${day.confirmed > 0 ? (day.revenue / day.confirmed).toFixed(2) : '0.00'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ title, value, icon, change, trend }: any) {
  return (
    <div className="bg-white rounded-xl shadow p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="text-sm text-gray-600">{title}</div>
          <div className="text-2xl font-bold mt-1">{value}</div>
        </div>
        <div>{icon}</div>
      </div>
      <div className={`text-sm ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
        {trend === 'up' ? '↗' : '↘'} {Math.abs(change)}% from previous period
      </div>
    </div>
  );
}