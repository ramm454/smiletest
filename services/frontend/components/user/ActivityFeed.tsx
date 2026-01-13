'use client';
import { useState, useEffect } from 'react';
import { 
  Calendar, 
  CreditCard, 
  User, 
  Lock, 
  Shield, 
  Bell, 
  Tag, 
  FileText,
  ExternalLink,
  MoreVertical,
  Filter
} from 'lucide-react';

interface Activity {
  id: string;
  activityType: string;
  description?: string;
  metadata?: any;
  createdAt: string;
  user?: {
    firstName?: string;
    lastName?: string;
    avatar?: string;
  };
}

export default function ActivityFeed() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [groupedActivities, setGroupedActivities] = useState<Record<string, Activity[]>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    loadActivities();
  }, [page, filter]);

  const loadActivities = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/user?endpoint=activity-feed&limit=20&offset=${(page - 1) * 20}&filter=${filter}`);
      if (response.ok) {
        const data = await response.json();
        setActivities(prev => page === 1 ? data.activities : [...prev, ...data.activities]);
        setHasMore(data.pagination.hasMore);
        groupByDate(data.activities);
      }
    } catch (error) {
      console.error('Error loading activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const groupByDate = (activitiesList: Activity[]) => {
    const grouped = activitiesList.reduce((acc, activity) => {
      const date = new Date(activity.createdAt).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      
      if (!acc[date]) acc[date] = [];
      acc[date].push(activity);
      return acc;
    }, {} as Record<string, Activity[]>);
    
    setGroupedActivities(grouped);
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'login':
      case 'logout':
        return <Lock className="text-blue-600" size={18} />;
      case 'booking_created':
      case 'booking_cancelled':
        return <Calendar className="text-green-600" size={18} />;
      case 'payment':
      case 'subscription':
        return <CreditCard className="text-purple-600" size={18} />;
      case 'profile_update':
        return <User className="text-yellow-600" size={18} />;
      case 'mfa_verified':
      case 'password_change':
        return <Shield className="text-red-600" size={18} />;
      case 'consent_updated':
        return <FileText className="text-indigo-600" size={18} />;
      case 'tags_updated':
        return <Tag className="text-pink-600" size={18} />;
      case 'notification':
        return <Bell className="text-orange-600" size={18} />;
      default:
        return <User className="text-gray-600" size={18} />;
    }
  };

  const getActivityText = (activity: Activity) => {
    const userName = activity.user 
      ? `${activity.user.firstName} ${activity.user.lastName}`
      : 'You';
    
    switch (activity.activityType) {
      case 'login':
        return `${userName} logged in`;
      case 'logout':
        return `${userName} logged out`;
      case 'booking_created':
        return `${userName} booked a class`;
      case 'profile_update':
        return `${userName} updated profile`;
      case 'password_change':
        return `${userName} changed password`;
      case 'mfa_verified':
        return `${userName} setup MFA`;
      case 'consent_updated':
        return `${userName} updated consent preferences`;
      case 'tags_updated':
        return `${userName} updated tags`;
      default:
        return activity.description || activity.activityType;
    }
  };

  const activityFilters = [
    { id: 'all', label: 'All Activities' },
    { id: 'security', label: 'Security', types: ['login', 'logout', 'password_change', 'mfa_verified'] },
    { id: 'bookings', label: 'Bookings', types: ['booking_created', 'booking_cancelled'] },
    { id: 'profile', label: 'Profile', types: ['profile_update', 'tags_updated'] },
    { id: 'consent', label: 'Consent', types: ['consent_updated'] }
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Activity Timeline</h2>
          <p className="text-gray-600 mt-2">Track your account activities and security events</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Filter size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <select
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setPage(1);
              }}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg bg-white"
            >
              {activityFilters.map(f => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading && page === 1 ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedActivities).map(([date, dateActivities]) => (
            <div key={date}>
              <div className="sticky top-0 bg-white z-10 pb-4 mb-4 border-b">
                <h3 className="text-lg font-semibold text-gray-800">{date}</h3>
              </div>
              
              <div className="space-y-4">
                {dateActivities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
                  >
                    <div className="flex-shrink-0 mr-4">
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                        {getActivityIcon(activity.activityType)}
                      </div>
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <div>
                          <p className="font-medium text-gray-800">
                            {getActivityText(activity)}
                          </p>
                          {activity.metadata && (
                            <div className="text-sm text-gray-600 mt-1">
                              {activity.metadata.device && (
                                <span className="inline-block mr-3">
                                  📱 {activity.metadata.device}
                                </span>
                              )}
                              {activity.metadata.ip && (
                                <span className="inline-block mr-3">
                                  🌐 {activity.metadata.ip}
                                </span>
                              )}
                              {activity.metadata.location && (
                                <span className="inline-block">
                                  📍 {activity.metadata.location}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        
                        <div className="text-right">
                          <p className="text-sm text-gray-500">
                            {new Date(activity.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                          {activity.metadata?.action && (
                            <button className="mt-2 text-sm text-blue-600 hover:text-blue-800 flex items-center">
                              View details
                              <ExternalLink size={14} className="ml-1" />
                            </button>
                          )}
                        </div>
                      </div>
                      
                      {activity.metadata?.details && (
                        <div className="mt-3 p-3 bg-gray-50 rounded text-sm">
                          <pre className="text-gray-700 whitespace-pre-wrap">
                            {JSON.stringify(activity.metadata.details, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          
          {hasMore && (
            <div className="text-center py-4">
              <button
                onClick={() => setPage(prev => prev + 1)}
                disabled={loading}
                className="px-6 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Load More Activities'}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="mt-8 p-4 bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-lg">
        <h4 className="font-semibold text-gray-800 mb-3">Activity Summary</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-white border border-gray-200 rounded">
            <div className="text-2xl font-bold text-blue-600">
              {activities.filter(a => a.activityType === 'login').length}
            </div>
            <div className="text-sm text-gray-600">Logins</div>
          </div>
          
          <div className="text-center p-3 bg-white border border-gray-200 rounded">
            <div className="text-2xl font-bold text-green-600">
              {activities.filter(a => a.activityType.includes('booking')).length}
            </div>
            <div className="text-sm text-gray-600">Bookings</div>
          </div>
          
          <div className="text-center p-3 bg-white border border-gray-200 rounded">
            <div className="text-2xl font-bold text-purple-600">
              {activities.filter(a => a.activityType.includes('security')).length}
            </div>
            <div className="text-sm text-gray-600">Security Events</div>
          </div>
          
          <div className="text-center p-3 bg-white border border-gray-200 rounded">
            <div className="text-2xl font-bold text-yellow-600">
              {new Set(activities.map(a => 
                new Date(a.createdAt).toLocaleDateString()
              )).size}
            </div>
            <div className="text-sm text-gray-600">Active Days</div>
          </div>
        </div>
      </div>
    </div>
  );
}