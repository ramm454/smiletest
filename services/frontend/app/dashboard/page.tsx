'use client';

import { useState, useEffect } from 'react';
import { 
  Calendar, 
  Activity, 
  TrendingUp, 
  Users, 
  Video, 
  ShoppingBag,
  Bell,
  Clock,
  Award,
  Heart
} from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    upcomingClasses: 0,
    totalBookings: 0,
    minutesPracticed: 0,
    streakDays: 0,
    liveSessions: 0,
    cartItems: 0
  });

  const [upcomingClasses, setUpcomingClasses] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [recommendations, setRecommendations] = useState([]);

  useEffect(() => {
    // Fetch dashboard data
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Mock data - replace with actual API calls
      setStats({
        upcomingClasses: 3,
        totalBookings: 24,
        minutesPracticed: 1280,
        streakDays: 7,
        liveSessions: 2,
        cartItems: 3
      });

      setUpcomingClasses([
        {
          id: '1',
          title: 'Morning Vinyasa Flow',
          instructor: 'Sarah Johnson',
          time: 'Today, 9:00 AM',
          duration: '60 min',
          type: 'yoga',
          image: '/images/yoga1.jpg'
        },
        {
          id: '2',
          title: 'Evening Meditation',
          instructor: 'Michael Chen',
          time: 'Tomorrow, 7:00 PM',
          duration: '30 min',
          type: 'meditation',
          image: '/images/meditation.jpg'
        },
        {
          id: '3',
          title: 'Hot Yoga Session',
          instructor: 'Lisa Rodriguez',
          time: 'Friday, 6:00 PM',
          duration: '75 min',
          type: 'yoga',
          image: '/images/hot-yoga.jpg'
        }
      ]);

      setRecentActivity([
        {
          id: '1',
          type: 'booking',
          title: 'Booked Power Yoga Class',
          time: '2 hours ago',
          icon: Calendar
        },
        {
          id: '2',
          type: 'purchase',
          title: 'Purchased Yoga Mat',
          time: '1 day ago',
          icon: ShoppingBag
        },
        {
          id: '3',
          type: 'achievement',
          title: '7 Day Streak Unlocked!',
          time: '2 days ago',
          icon: Award
        },
        {
          id: '4',
          type: 'live',
          title: 'Joined Live Meditation',
          time: '3 days ago',
          icon: Video
        }
      ]);

      setRecommendations([
        {
          id: '1',
          title: 'Beginner Yoga Series',
          description: 'Perfect for starting your journey',
          type: 'course',
          progress: 65,
          image: '/images/beginner-yoga.jpg'
        },
        {
          id: '2',
          title: 'Stress Relief Package',
          description: 'Special spa treatments',
          type: 'package',
          discount: 20,
          image: '/images/spa-package.jpg'
        },
        {
          id: '3',
          title: 'Advanced Asanas Workshop',
          description: 'Take your practice to next level',
          type: 'workshop',
          instructor: 'Master Yogi',
          image: '/images/workshop.jpg'
        }
      ]);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  const statCards = [
    {
      title: 'Upcoming Classes',
      value: stats.upcomingClasses,
      icon: Calendar,
      color: 'bg-blue-500',
      link: '/booking'
    },
    {
      title: 'Total Bookings',
      value: stats.totalBookings,
      icon: TrendingUp,
      color: 'bg-green-500',
      link: '/booking'
    },
    {
      title: 'Minutes Practiced',
      value: stats.minutesPracticed,
      icon: Activity,
      color: 'bg-purple-500',
      link: '/classes'
    },
    {
      title: 'Current Streak',
      value: `${stats.streakDays} days`,
      icon: Heart,
      color: 'bg-red-500',
      link: '/profile'
    },
    {
      title: 'Live Sessions',
      value: stats.liveSessions,
      icon: Video,
      color: 'bg-orange-500',
      link: '/live'
    },
    {
      title: 'Cart Items',
      value: stats.cartItems,
      icon: ShoppingBag,
      color: 'bg-indigo-500',
      link: '/shop/cart'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">Welcome back, Alex!</h1>
              <p className="text-blue-100 mt-2">Track your wellness journey here</p>
            </div>
            <div className="flex items-center space-x-4">
              <button className="p-2 bg-white/20 rounded-full hover:bg-white/30">
                <Bell size={20} />
              </button>
              <div className="w-10 h-10 bg-white rounded-full overflow-hidden">
                <img 
                  src="/images/avatar.jpg" 
                  alt="Profile" 
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 -mt-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {statCards.map((stat, index) => (
            <Link 
              key={index} 
              href={stat.link}
              className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">{stat.title}</p>
                  <p className="text-3xl font-bold text-gray-800 mt-2">{stat.value}</p>
                </div>
                <div className={`${stat.color} p-3 rounded-full`}>
                  <stat.icon size={24} className="text-white" />
                </div>
              </div>
              <div className="mt-4">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full"
                    style={{ width: `${Math.min(100, (stat.value as number) * 10)}%` }}
                  ></div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Upcoming Classes */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800">Upcoming Classes</h2>
                <Link 
                  href="/booking" 
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  View All
                </Link>
              </div>
              
              <div className="space-y-4">
                {upcomingClasses.map((classItem) => (
                  <div 
                    key={classItem.id}
                    className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-16 h-16 rounded-lg overflow-hidden mr-4">
                      <img 
                        src={classItem.image}
                        alt={classItem.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-800">{classItem.title}</h3>
                      <p className="text-sm text-gray-600">{classItem.instructor}</p>
                      <div className="flex items-center mt-1 text-sm text-gray-500">
                        <Clock size={14} className="mr-1" />
                        <span>{classItem.time} • {classItem.duration}</span>
                      </div>
                    </div>
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                      Join
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
                <div className="flex items-center">
                  <div className="p-3 bg-blue-100 rounded-full mr-4">
                    <Video size={24} className="text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">Live Session Starting Soon</h3>
                    <p className="text-sm text-gray-600">Morning Flow with Master Yogi in 15 minutes</p>
                  </div>
                  <button className="ml-auto px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                    Join Now
                  </button>
                </div>
              </div>
            </div>

            {/* Recommendations */}
            <div className="mt-8 bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-6">Recommended For You</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {recommendations.map((rec) => (
                  <div 
                    key={rec.id}
                    className="border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition-shadow"
                  >
                    <div className="h-40 overflow-hidden">
                      <img 
                        src={rec.image}
                        alt={rec.title}
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                    <div className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-gray-800">{rec.title}</h3>
                          <p className="text-sm text-gray-600 mt-1">{rec.description}</p>
                        </div>
                        {rec.discount && (
                          <span className="px-2 py-1 bg-red-100 text-red-600 text-xs font-semibold rounded">
                            -{rec.discount}%
                          </span>
                        )}
                      </div>
                      
                      {rec.progress && (
                        <div className="mt-4">
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-600">Progress</span>
                            <span className="font-semibold">{rec.progress}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-green-500 h-2 rounded-full"
                              style={{ width: `${rec.progress}%` }}
                            ></div>
                          </div>
                        </div>
                      )}

                      <button className="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                        {rec.type === 'course' ? 'Continue' : 'View Details'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            {/* Recent Activity */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-6">Recent Activity</h2>
              
              <div className="space-y-4">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-center">
                    <div className="p-2 bg-gray-100 rounded-full mr-4">
                      <activity.icon size={18} className="text-gray-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-800">{activity.title}</p>
                      <p className="text-sm text-gray-500">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>

              <Link 
                href="/profile/activity"
                className="block text-center mt-6 text-blue-600 hover:text-blue-800 font-medium"
              >
                View All Activity
              </Link>
            </div>

            {/* Quick Actions */}
            <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl shadow-lg p-6 text-white">
              <h2 className="text-xl font-bold mb-6">Quick Actions</h2>
              
              <div className="grid grid-cols-2 gap-4">
                <Link 
                  href="/booking"
                  className="p-4 bg-white/20 rounded-lg hover:bg-white/30 transition-colors text-center"
                >
                  <Calendar size={24} className="mx-auto mb-2" />
                  <span className="text-sm font-medium">Book Class</span>
                </Link>
                
                <Link 
                  href="/live"
                  className="p-4 bg-white/20 rounded-lg hover:bg-white/30 transition-colors text-center"
                >
                  <Video size={24} className="mx-auto mb-2" />
                  <span className="text-sm font-medium">Go Live</span>
                </Link>
                
                <Link 
                  href="/shop"
                  className="p-4 bg-white/20 rounded-lg hover:bg-white/30 transition-colors text-center"
                >
                  <ShoppingBag size={24} className="mx-auto mb-2" />
                  <span className="text-sm font-medium">Shop</span>
                </Link>
                
                <Link 
                  href="/classes"
                  className="p-4 bg-white/20 rounded-lg hover:bg-white/30 transition-colors text-center"
                >
                  <Activity size={24} className="mx-auto mb-2" />
                  <span className="text-sm font-medium">Browse</span>
                </Link>
              </div>

              <div className="mt-6 p-4 bg-white/10 rounded-lg">
                <p className="text-sm mb-2">Your membership:</p>
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Premium Plan</span>
                  <span className="text-sm">Renews in 15 days</span>
                </div>
              </div>
            </div>

            {/* Achievement Badges */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-6">Achievements</h2>
              
              <div className="grid grid-cols-3 gap-4">
                {[
                  { icon: Award, label: 'Yogi Master', color: 'text-yellow-500' },
                  { icon: Heart, label: '7 Day Streak', color: 'text-red-500' },
                  { icon: Users, label: 'Community Star', color: 'text-blue-500' },
                  { icon: Clock, label: '100 Hours', color: 'text-green-500' },
                  { icon: TrendingUp, label: 'Consistent', color: 'text-purple-500' },
                  { icon: Activity, label: 'Flexibility', color: 'text-pink-500' },
                ].map((badge, index) => (
                  <div key={index} className="text-center">
                    <div className={`p-3 ${badge.color.replace('text', 'bg')} bg-opacity-10 rounded-full inline-block mb-2`}>
                      <badge.icon size={24} className={badge.color} />
                    </div>
                    <p className="text-xs font-medium text-gray-700">{badge.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Wellness Stats */}
        <div className="mt-8 bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-6">Weekly Wellness Stats</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { label: 'Yoga Sessions', value: 5, color: 'bg-blue-500', icon: Activity },
              { label: 'Meditation', value: 7, color: 'bg-purple-500', icon: Heart },
              { label: 'Calories Burned', value: '2,450', color: 'bg-red-500', icon: TrendingUp },
              { label: 'Sleep Hours', value: '42', color: 'bg-green-500', icon: Clock },
            ].map((stat, index) => (
              <div key={index} className="text-center p-4 border border-gray-200 rounded-lg">
                <div className={`${stat.color} w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3`}>
                  <stat.icon size={24} className="text-white" />
                </div>
                <p className="text-2xl font-bold text-gray-800">{stat.value}</p>
                <p className="text-gray-600 text-sm mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}