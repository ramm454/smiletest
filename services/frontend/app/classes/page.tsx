'use client';

import { useState, useEffect } from 'react';
import { 
  Filter, 
  Search, 
  Calendar, 
  Clock, 
  Users, 
  Star, 
  PlayCircle,
  Bookmark,
  TrendingUp,
  MapPin,
  Download,
  Share2
} from 'lucide-react';
import Link from 'next/link';

export default function ClassesPage() {
  const [classes, setClasses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [selectedFilters, setSelectedFilters] = useState({
    category: 'all',
    difficulty: 'all',
    duration: 'all',
    instructor: 'all'
  });
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchClassesData();
  }, []);

  const fetchClassesData = async () => {
    // Mock data - replace with API calls
    setCategories([
      { id: 'all', name: 'All Classes', count: 48 },
      { id: 'vinyasa', name: 'Vinyasa', count: 12 },
      { id: 'hatha', name: 'Hatha', count: 8 },
      { id: 'yin', name: 'Yin', count: 6 },
      { id: 'hot', name: 'Hot Yoga', count: 5 },
      { id: 'meditation', name: 'Meditation', count: 10 },
      { id: 'prenatal', name: 'Prenatal', count: 4 },
      { id: 'kids', name: 'Kids Yoga', count: 3 }
    ]);

    setInstructors([
      { id: 'all', name: 'All Instructors', rating: 0 },
      { id: '1', name: 'Sarah Johnson', rating: 4.9 },
      { id: '2', name: 'Michael Chen', rating: 4.8 },
      { id: '3', name: 'Lisa Rodriguez', rating: 4.7 },
      { id: '4', name: 'David Park', rating: 4.6 },
      { id: '5', name: 'Emma Wilson', rating: 4.5 }
    ]);

    setClasses([
      {
        id: '1',
        title: 'Morning Vinyasa Flow',
        instructor: 'Sarah Johnson',
        category: 'vinyasa',
        difficulty: 'intermediate',
        duration: 60,
        capacity: 20,
        booked: 18,
        rating: 4.9,
        reviews: 124,
        price: 25,
        image: '/images/vinyasa.jpg',
        isLive: false,
        isRecorded: true,
        description: 'Start your day with energizing flow sequences to build strength and flexibility.',
        schedule: [
          { day: 'Mon', time: '7:00 AM' },
          { day: 'Wed', time: '7:00 AM' },
          { day: 'Fri', time: '7:00 AM' }
        ]
      },
      {
        id: '2',
        title: 'Deep Yin Yoga',
        instructor: 'Michael Chen',
        category: 'yin',
        difficulty: 'beginner',
        duration: 75,
        capacity: 15,
        booked: 12,
        rating: 4.8,
        reviews: 89,
        price: 30,
        image: '/images/yin-yoga.jpg',
        isLive: true,
        isRecorded: true,
        description: 'Slow-paced style of yoga with postures held for longer periods.',
        schedule: [
          { day: 'Tue', time: '6:00 PM' },
          { day: 'Thu', time: '6:00 PM' },
          { day: 'Sun', time: '4:00 PM' }
        ]
      },
      {
        id: '3',
        title: 'Power Hot Yoga',
        instructor: 'Lisa Rodriguez',
        category: 'hot',
        difficulty: 'advanced',
        duration: 90,
        capacity: 25,
        booked: 25,
        rating: 4.7,
        reviews: 156,
        price: 35,
        image: '/images/hot-power.jpg',
        isLive: false,
        isRecorded: false,
        description: 'Intense practice in heated room to detoxify and strengthen.',
        schedule: [
          { day: 'Mon', time: '6:00 PM' },
          { day: 'Wed', time: '6:00 PM' },
          { day: 'Sat', time: '10:00 AM' }
        ]
      },
      {
        id: '4',
        title: 'Guided Meditation',
        instructor: 'David Park',
        category: 'meditation',
        difficulty: 'beginner',
        duration: 30,
        capacity: 50,
        booked: 42,
        rating: 4.6,
        reviews: 67,
        price: 20,
        image: '/images/meditation-class.jpg',
        isLive: true,
        isRecorded: true,
        description: 'Mindfulness and relaxation techniques for stress relief.',
        schedule: [
          { day: 'Daily', time: '8:00 PM' }
        ]
      },
      {
        id: '5',
        title: 'Hatha Foundations',
        instructor: 'Emma Wilson',
        category: 'hatha',
        difficulty: 'beginner',
        duration: 60,
        capacity: 18,
        booked: 15,
        rating: 4.5,
        reviews: 92,
        price: 25,
        image: '/images/hatha.jpg',
        isLive: false,
        isRecorded: true,
        description: 'Perfect for beginners learning basic postures and breathing.',
        schedule: [
          { day: 'Tue', time: '9:00 AM' },
          { day: 'Thu', time: '9:00 AM' },
          { day: 'Sat', time: '11:00 AM' }
        ]
      },
      {
        id: '6',
        title: 'Prenatal Yoga',
        instructor: 'Sarah Johnson',
        category: 'prenatal',
        difficulty: 'beginner',
        duration: 45,
        capacity: 12,
        booked: 10,
        rating: 4.9,
        reviews: 45,
        price: 30,
        image: '/images/prenatal.jpg',
        isLive: false,
        isRecorded: true,
        description: 'Gentle practice designed for expecting mothers.',
        schedule: [
          { day: 'Mon', time: '10:00 AM' },
          { day: 'Wed', time: '10:00 AM' },
          { day: 'Fri', time: '10:00 AM' }
        ]
      }
    ]);
  };

  const handleFilterChange = (filterType: string, value: string) => {
    setSelectedFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  const filteredClasses = classes.filter(cls => {
    // Filter by category
    if (selectedFilters.category !== 'all' && cls.category !== selectedFilters.category) {
      return false;
    }
    
    // Filter by difficulty
    if (selectedFilters.difficulty !== 'all' && cls.difficulty !== selectedFilters.difficulty) {
      return false;
    }
    
    // Filter by instructor
    if (selectedFilters.instructor !== 'all' && cls.instructorId !== selectedFilters.instructor) {
      return false;
    }
    
    // Filter by search query
    if (searchQuery && !cls.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !cls.description.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    
    return true;
  });

  const difficultyOptions = [
    { value: 'all', label: 'All Levels' },
    { value: 'beginner', label: 'Beginner' },
    { value: 'intermediate', label: 'Intermediate' },
    { value: 'advanced', label: 'Advanced' }
  ];

  const durationOptions = [
    { value: 'all', label: 'Any Duration' },
    { value: '30', label: '30 min or less' },
    { value: '60', label: '60 min' },
    { value: '90', label: '90 min or more' }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-bold mb-4">Find Your Perfect Yoga Class</h1>
            <p className="text-xl text-blue-100 mb-8">
              Explore hundreds of classes, from beginner to advanced, live or on-demand
            </p>
            
            {/* Search Bar */}
            <div className="relative max-w-2xl">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search classes, instructors, or styles..."
                className="w-full pl-12 pr-4 py-4 rounded-lg text-gray-800"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button className="absolute right-2 top-1/2 transform -translate-y-1/2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Search
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Filters */}
          <div className="lg:w-1/4">
            <div className="bg-white rounded-xl shadow-lg p-6 sticky top-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-gray-800">Filters</h2>
                <Filter size={20} className="text-gray-600" />
              </div>

              {/* Categories */}
              <div className="mb-8">
                <h3 className="font-semibold text-gray-700 mb-4">Categories</h3>
                <div className="space-y-2">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => handleFilterChange('category', cat.id)}
                      className={`flex justify-between items-center w-full p-3 rounded-lg text-left transition-colors ${
                        selectedFilters.category === cat.id
                          ? 'bg-blue-50 text-blue-600 border border-blue-200'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <span>{cat.name}</span>
                      <span className="text-sm text-gray-500">{cat.count}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Difficulty */}
              <div className="mb-8">
                <h3 className="font-semibold text-gray-700 mb-4">Difficulty Level</h3>
                <div className="space-y-2">
                  {difficultyOptions.map((level) => (
                    <button
                      key={level.value}
                      onClick={() => handleFilterChange('difficulty', level.value)}
                      className={`w-full p-3 rounded-lg text-left transition-colors ${
                        selectedFilters.difficulty === level.value
                          ? 'bg-blue-50 text-blue-600 border border-blue-200'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      {level.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration */}
              <div className="mb-8">
                <h3 className="font-semibold text-gray-700 mb-4">Duration</h3>
                <div className="space-y-2">
                  {durationOptions.map((duration) => (
                    <button
                      key={duration.value}
                      onClick={() => handleFilterChange('duration', duration.value)}
                      className={`w-full p-3 rounded-lg text-left transition-colors ${
                        selectedFilters.duration === duration.value
                          ? 'bg-blue-50 text-blue-600 border border-blue-200'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      {duration.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Instructors */}
              <div className="mb-8">
                <h3 className="font-semibold text-gray-700 mb-4">Instructors</h3>
                <div className="space-y-3">
                  {instructors.map((instructor) => (
                    <button
                      key={instructor.id}
                      onClick={() => handleFilterChange('instructor', instructor.id)}
                      className={`flex items-center justify-between w-full p-3 rounded-lg text-left transition-colors ${
                        selectedFilters.instructor === instructor.id
                          ? 'bg-blue-50 text-blue-600 border border-blue-200'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div>
                        <span>{instructor.name}</span>
                        {instructor.rating > 0 && (
                          <div className="flex items-center text-sm text-gray-500 mt-1">
                            <Star size={14} className="fill-yellow-400 text-yellow-400 mr-1" />
                            <span>{instructor.rating}</span>
                          </div>
                        )}
                      </div>
                      {instructor.rating > 0 && (
                        <div className="w-10 h-10 rounded-full overflow-hidden">
                          <img 
                            src={`/images/instructor-${instructor.id}.jpg`}
                            alt={instructor.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setSelectedFilters({
                  category: 'all',
                  difficulty: 'all',
                  duration: 'all',
                  instructor: 'all'
                })}
                className="w-full py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
              >
                Clear All Filters
              </button>
            </div>

            {/* Featured Instructor */}
            <div className="mt-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl shadow-lg p-6 text-white">
              <div className="text-center">
                <div className="w-20 h-20 rounded-full overflow-hidden mx-auto mb-4 border-4 border-white/30">
                  <img 
                    src="/images/featured-instructor.jpg"
                    alt="Featured Instructor"
                    className="w-full h-full object-cover"
                  />
                </div>
                <h3 className="font-bold text-lg mb-2">Master Yogi Chen</h3>
                <p className="text-sm text-white/80 mb-4">20+ years experience</p>
                <p className="text-sm mb-6">"Join my advanced workshop to deepen your practice"</p>
                <button className="w-full py-3 bg-white text-purple-600 rounded-lg font-semibold hover:bg-gray-100">
                  View Workshops
                </button>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:w-3/4">
            {/* Header Stats */}
            <div className="mb-8">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">All Classes</h2>
                  <p className="text-gray-600">{filteredClasses.length} classes found</p>
                </div>
                <div className="flex items-center space-x-4">
                  <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                    <span className="flex items-center">
                      <Calendar size={16} className="mr-2" />
                      Schedule View
                    </span>
                  </button>
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    <span className="flex items-center">
                      <PlayCircle size={16} className="mr-2" />
                      Start Free Trial
                    </span>
                  </button>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {[
                  { label: 'Live Now', value: 3, color: 'bg-red-500', icon: PlayCircle },
                  { label: 'Recorded', value: 42, color: 'bg-blue-500', icon: Download },
                  { label: 'Instructors', value: 12, color: 'bg-green-500', icon: Users },
                  { label: 'Trending', value: 8, color: 'bg-purple-500', icon: TrendingUp }
                ].map((stat, index) => (
                  <div key={index} className="bg-white p-4 rounded-lg shadow">
                    <div className="flex items-center">
                      <div className={`${stat.color} p-3 rounded-full mr-4`}>
                        <stat.icon size={20} className="text-white" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-gray-800">{stat.value}</p>
                        <p className="text-sm text-gray-600">{stat.label}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Classes Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredClasses.map((cls) => (
                <div key={cls.id} className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                  {/* Class Image */}
                  <div className="relative h-48 overflow-hidden">
                    <img 
                      src={cls.image}
                      alt={cls.title}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-4 left-4 flex space-x-2">
                      {cls.isLive && (
                        <span className="px-3 py-1 bg-red-600 text-white text-xs font-semibold rounded-full flex items-center">
                          <PlayCircle size={12} className="mr-1" />
                          LIVE
                        </span>
                      )}
                      {