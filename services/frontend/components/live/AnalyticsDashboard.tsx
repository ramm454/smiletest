'use client';
import { useState, useEffect } from 'react';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import { Download, Users, MessageSquare, Clock, TrendingUp, DollarSign, Eye, Activity } from 'lucide-react';

interface AnalyticsDashboardProps {
  sessionId: string;
  isHost: boolean;
}

export default function AnalyticsDashboard({ sessionId, isHost }: AnalyticsDashboardProps) {
  const [analytics, setAnalytics] = useState<any>(null);
  const [timeRange, setTimeRange] = useState<'live' | 'hour' | 'day' | 'week'>('live');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
    const interval = setInterval(loadAnalytics, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [sessionId, timeRange]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/live/${sessionId}/analytics?range=${timeRange}`);
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportAnalytics = async (format: 'csv' | 'pdf') => {
    try {
      const response = await fetch(`/api/live/${sessionId}/export-analytics?format=${format}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-${sessionId}-${new Date().toISOString()}.${format}`;
        a.click();
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center p-8">
        <Activity className="mx-auto text-gray-400 mb-4" size={48} />
        <p className="text-gray-600">No analytics data available</p>
      </div>
    );
  }

  const { overview, engagement, participants, quality, revenue } = analytics;

  // Chart data preparation
  const engagementData = engagement?.timeline?.map((point: any) => ({
    time: new Date(point.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    messages: point.messages,
    participants: point.participants,
  })) || [];

  const participantRoles = participants?.byRole ? Object.entries(participants.byRole).map(([role, count]) => ({
    name: role,
    value: count,
  })) : [];

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Session Analytics</h2>
          <p className="text-gray-600">Real-time insights and metrics</p>
        </div>
        <div className="flex items-center space-x-4">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="live">Live</option>
            <option value="hour">Last Hour</option>
            <option value="day">Last 24 Hours</option>
            <option value="week">Last Week</option>
          </select>
          <button
            onClick={() => exportAnalytics('csv')}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Download className="mr-2" size={16} />
            Export
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center">
            <Users className="text-blue-600 mr-3" size={24} />
            <div>
              <p className="text-sm text-gray-600">Participants</p>
              <p className="text-2xl font-bold text-gray-800">{overview?.participants?.total || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="flex items-center">
            <MessageSquare className="text-green-600 mr-3" size={24} />
            <div>
              <p className="text-sm text-gray-600">Messages</p>
              <p className="text-2xl font-bold text-gray-800">{engagement?.totalMessages || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="flex items-center">
            <Clock className="text-purple-600 mr-3" size={24} />
            <div>
              <p className="text-sm text-gray-600">Avg Duration</p>
              <p className="text-2xl font-bold text-gray-800">
                {participants?.averageDuration ? `${Math.round(participants.averageDuration)}m` : '0m'}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg">
          <div className="flex items-center">
            <TrendingUp className="text-yellow-600 mr-3" size={24} />
            <div>
              <p className="text-sm text-gray-600">Engagement</p>
              <p className="text-2xl font-bold text-gray-800">
                {engagement?.participationRate ? `${Math.round(engagement.participationRate)}%` : '0%'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Engagement Timeline */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Engagement Timeline</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={engagementData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="time" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="participants" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                <Area type="monotone" dataKey="messages" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Participant Roles */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Participant Roles</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={participantRoles}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {participantRoles.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Quality Metrics */}
      {quality && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Quality Metrics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 border border-gray-200 rounded-lg">
              <p className="text-sm text-gray-600">Avg Bitrate</p>
              <p className="text-xl font-bold text-gray-800">
                {quality.averageBitrate ? `${Math.round(quality.averageBitrate / 1000)} kbps` : 'N/A'}
              </p>
            </div>
            <div className="p-4 border border-gray-200 rounded-lg">
              <p className="text-sm text-gray-600">Avg Latency</p>
              <p className="text-xl font-bold text-gray-800">
                {quality.averageLatency ? `${Math.round(quality.averageLatency)}ms` : 'N/A'}
              </p>
            </div>
            <div className="p-4 border border-gray-200 rounded-lg">
              <p className="text-sm text-gray-600">Retention Rate</p>
              <p className="text-xl font-bold text-gray-800">
                {quality.retentionRate ? `${Math.round(quality.retentionRate)}%` : 'N/A'}
              </p>
            </div>
            <div className="p-4 border border-gray-200 rounded-lg">
              <p className="text-sm text-gray-600">Peak Viewers</p>
              <p className="text-xl font-bold text-gray-800">{quality.peakParticipants || 0}</p>
            </div>
          </div>
        </div>
      )}

      {/* Revenue Section (if paid session) */}
      {revenue && isHost && (
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <DollarSign className="mr-2" size={20} />
            Revenue Analytics
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-800">${revenue.actualRevenue?.toFixed(2) || '0.00'}</p>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-600">Conversion Rate</p>
              <p className="text-2xl font-bold text-gray-800">{revenue.conversionRate?.toFixed(1) || '0'}%</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <p className="text-sm text-gray-600">Avg Revenue/User</p>
              <p className="text-2xl font-bold text-gray-800">${revenue.averageRevenuePerUser?.toFixed(2) || '0.00'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Statistics */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h4 className="font-medium text-gray-700 mb-2">Participant Status</h4>
          <div className="space-y-2">
            {participants?.byStatus && Object.entries(participants.byStatus).map(([status, count]) => (
              <div key={status} className="flex justify-between items-center">
                <span className="text-gray-600 capitalize">{status.toLowerCase()}</span>
                <span className="font-medium">{count as number}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h4 className="font-medium text-gray-700 mb-2">Engagement Metrics</h4>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Poll Participation</span>
              <span className="font-medium">{engagement?.averagePollParticipation?.toFixed(1) || '0'}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total Polls</span>
              <span className="font-medium">{engagement?.totalPolls || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total Votes</span>
              <span className="font-medium">{engagement?.totalPollVotes || 0}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}