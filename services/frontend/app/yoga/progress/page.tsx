'use client';

import { useState, useEffect } from 'react';
import { Calendar, TrendingUp, Target, Award, BarChart, Activity, Clock, Flame } from 'lucide-react';

export default function ProgressPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState('month');

  useEffect(() => {
    fetchProgressStats();
  }, [timeframe]);

  const fetchProgressStats = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/yoga/progress/stats?timeframe=${timeframe}`);
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching progress stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const timeframes = [
    { id: 'week', name: 'Week' },
    { id: 'month', name: 'Month' },
    { id: 'quarter', name: 'Quarter' },
    { id: 'year', name: 'Year' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Your Yoga Progress</h1>
              <p className="text-gray-600">Track your journey and celebrate your achievements</p>
            </div>
            <div className="flex gap-2">
              {timeframes.map(tf => (
                <button
                  key={tf.id}
                  onClick={() => setTimeframe(tf.id)}
                  className={`px-4 py-2 rounded-lg ${timeframe === tf.id ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border hover:bg-gray-50'}`}
                >
                  {tf.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        {stats && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white p-6 rounded-xl shadow">
                <div className="flex items-center">
                  <div className="p-3 bg-blue-100 rounded-full mr-4">
                    <Activity size={24} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-800">{stats.summary.totalSessions}</p>
                    <p className="text-gray-600">Sessions</p>
                  </div>
                </div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow">
                <div className="flex items-center">
                  <div className="p-3 bg-green-100 rounded-full mr-4">
                    <Clock size={24} className="text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-800">
                      {Math.round(stats.summary.totalPracticeTime / 60)}
                    </p>
                    <p className="text-gray-600">Hours Practiced</p>
                  </div>
                </div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow">
                <div className="flex items-center">
                  <div className="p-3 bg-purple-100 rounded-full mr-4">
                    <Target size={24} className="text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-800">{stats.summary.masteredPoses}</p>
                    <p className="text-gray-600">Poses Mastered</p>
                  </div>
                </div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow">
                <div className="flex items-center">
                  <div className="p-3 bg-red-100 rounded-full mr-4">
                    <Flame size={24} className="text-red-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-800">{stats.summary.currentStreak}</p>
                    <p className="text-gray-600">Day Streak</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Practice Calendar */}
            <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800">Practice Calendar</h2>
                <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
                  <Calendar size={20} />
                  View Full Calendar
                </button>
              </div>
              <div className="text-center py-8">
                <Calendar size={48} className="mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600">Practice calendar visualization coming soon</p>
              </div>
            </div>

            {/* Recent Sessions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-6">Recent Sessions</h2>
                <div className="space-y-4">
                  {stats.recentSessions?.slice(0, 5).map((session: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">
                          {new Date(session.practiceDate).toLocaleDateString()}
                        </p>
                        <p className="text-sm text-gray-600 capitalize">{session.practiceType}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">{session.duration} min</p>
                        <p className="text-sm text-gray-600">{session.posesPracticed?.length || 0} poses</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pose Progress */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-6">Pose Progress</h2>
                <div className="space-y-4">
                  {stats.poseProgress?.inProgress?.slice(0, 5).map((pose: any, index: number) => (
                    <div key={index} className="p-3 border border-gray-200 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <p className="font-medium text-gray-900">{pose.pose?.name}</p>
                        <div className="flex items-center">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <div
                              key={i}
                              className={`w-2 h-2 rounded-full mx-1 ${i < pose.comfortLevel ? 'bg-green-500' : 'bg-gray-200'}`}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>{pose.practiceCount} practices</span>
                        <span>{pose.totalDuration}s total</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}