'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Calendar, 
  Clock, 
  Users, 
  MapPin, 
  Video, 
  Mic, 
  Headphones, 
  CreditCard, 
  CheckCircle, 
  AlertCircle,
  ChevronRight,
  Filter,
  Search,
  Star,
  TrendingUp,
  Zap
} from 'lucide-react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import VoiceBooking from '@/components/booking/VoiceBooking';
import BookingCalendar from '@/components/booking/BookingCalendar';
import { toast, Toaster } from 'react-hot-toast';

interface Class {
  id: string;
  title: string;
  description: string;
  type: string;
  difficulty: string;
  duration: number;
  maxCapacity: number;
  currentBookings: number;
  price: number;
  startTime: string;
  endTime: string;
  locationType: 'STUDIO' | 'ONLINE' | 'HYBRID' | 'OUTDOOR';
  studioRoom?: string;
  onlineLink?: string;
  address?: string;
  instructor: {
    id: string;
    displayName: string;
    profileImage?: string;
    rating: number;
    specialties: string[];
  };
  status: string;
  isFeatured: boolean;
  tags: string[];
  equipmentNeeded: string[];
}

interface Booking {
  id: string;
  userId: string;
  classId?: string;
  sessionId?: string;
  type: string;
  startTime: string;
  endTime: string;
  participants: number;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  createdAt: string;
  class?: Class;
}

interface Instructor {
  id: string;
  displayName: string;
  bio?: string;
  specialties: string[];
  rating: number;
  profileImage?: string;
  isAvailable: boolean;
}

export default function BookingPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('classes');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [classes, setClasses] = useState<Class[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [bookingStep, setBookingStep] = useState(1);
  const [bookingDetails, setBookingDetails] = useState({
    participants: 1,
    specialRequests: '',
    guestEmails: [] as string[],
  });
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [showVoiceBooking, setShowVoiceBooking] = useState(false);
  const [streamingNow, setStreamingNow] = useState<Class[]>([]);

  const classTypes = [
    { id: 'all', name: 'All Classes', icon: '🎯' },
    { id: 'hatha', name: 'Hatha', icon: '🧘' },
    { id: 'vinyasa', name: 'Vinyasa', icon: '💫' },
    { id: 'ashtanga', name: 'Ashtanga', icon: '🔥' },
    { id: 'yin', name: 'Yin', icon: '🌙' },
    { id: 'restorative', name: 'Restorative', icon: '🌿' },
    { id: 'hot', name: 'Hot Yoga', icon: '🌡️' },
    { id: 'prenatal', name: 'Prenatal', icon: '🤰' },
  ];

  const difficulties = [
    { id: 'all', name: 'All Levels' },
    { id: 'beginner', name: 'Beginner' },
    { id: 'intermediate', name: 'Intermediate' },
    { id: 'advanced', name: 'Advanced' },
  ];

  const locations = [
    { id: 'all', name: 'All Locations', icon: MapPin },
    { id: 'studio', name: 'Studio', icon: MapPin },
    { id: 'online', name: 'Online', icon: Video },
    { id: 'hybrid', name: 'Hybrid', icon: Video },
    { id: 'outdoor', name: 'Outdoor', icon: MapPin },
  ];

  useEffect(() => {
    fetchClasses();
    fetchBookings();
    fetchInstructors();
    fetchLiveStreams();
  }, [selectedDate, selectedType, selectedDifficulty, selectedLocation]);

  const fetchClasses = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        date: selectedDate.toISOString().split('T')[0],
        type: selectedType !== 'all' ? selectedType : '',
        difficulty: selectedDifficulty !== 'all' ? selectedDifficulty : '',
        locationType: selectedLocation !== 'all' ? selectedLocation : '',
        search: searchQuery,
      });

      const response = await fetch(`/api/classes?${params}`);
      const data = await response.json();
      setClasses(data.classes || []);
    } catch (error) {
      console.error('Error fetching classes:', error);
      toast.error('Failed to load classes');
    } finally {
      setLoading(false);
    }
  };

  const fetchBookings = async () => {
    try {
      const response = await fetch('/api/bookings/my-bookings');
      const data = await response.json();
      setBookings(data.bookings || []);
    } catch (error) {
      console.error('Error fetching bookings:', error);
    }
  };

  const fetchInstructors = async () => {
    try {
      const response = await fetch('/api/instructors');
      const data = await response.json();
      setInstructors(data.instructors || []);
    } catch (error) {
      console.error('Error fetching instructors:', error);
    }
  };

  const fetchLiveStreams = async () => {
    try {
      const response = await fetch('/api/live/now');
      const data = await response.json();
      setStreamingNow(data.sessions || []);
    } catch (error) {
      console.error('Error fetching live streams:', error);
    }
  };

  const handleClassSelect = (yogaClass: Class) => {
    setSelectedClass(yogaClass);
    setBookingStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBooking = async () => {
    if (!selectedClass) return;

    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId: selectedClass.id,
          participants: bookingDetails.participants,
          specialRequests: bookingDetails.specialRequests,
          guestEmails: bookingDetails.guestEmails,
        }),
      });

      if (response.ok) {
        const booking = await response.json();
        toast.success('Booking confirmed!');
        setBookings([booking, ...bookings]);
        setBookingStep(3);
        
        // Reset after 5 seconds
        setTimeout(() => {
          setSelectedClass(null);
          setBookingStep(1);
          setBookingDetails({
            participants: 1,
            specialRequests: '',
            guestEmails: [],
          });
        }, 5000);
      } else {
        throw new Error('Booking failed');
      }
    } catch (error) {
      console.error('Booking error:', error);
      toast.error('Failed to create booking');
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    if (!confirm('Are you sure you want to cancel this booking?')) return;

    try {
      const response = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: 'POST',
      });

      if (response.ok) {
        toast.success('Booking cancelled successfully');
        setBookings(bookings.filter(b => b.id !== bookingId));
      } else {
        throw new Error('Cancellation failed');
      }
    } catch (error) {
      console.error('Cancellation error:', error);
      toast.error('Failed to cancel booking');
    }
  };

  const handleJoinLiveStream = (classId: string) => {
    router.push(`/live/${classId}`);
  };

  const tabs = [
    { id: 'classes', label: 'Browse Classes', icon: Calendar },
    { id: 'calendar', label: 'My Calendar', icon: Calendar },
    { id: 'bookings', label: 'My Bookings', icon: CheckCircle },
    { id: 'live', label: 'Live Now', icon: Video },
    { id: 'voice', label: 'Voice Book', icon: Mic },
    { id: 'instructors', label: 'Instructors', icon: Users },
  ];

  if (loading && classes.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Book Your Session</h1>
              <p className="text-gray-600 mt-2">Find and book yoga classes, live sessions, and workshops</p>
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowVoiceBooking(!showVoiceBooking)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all"
              >
                <Mic size={20} />
                Book with Voice AI
              </button>
              
              <button
                onClick={() => router.push('/dashboard')}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Dashboard
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-6 flex flex-wrap gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white shadow-lg'
                      : 'bg-white text-gray-700 hover:bg-gray-100 border'
                  }`}
                >
                  <Icon size={18} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Voice Booking Modal */}
      {showVoiceBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Voice Booking Assistant</h2>
                <button
                  onClick={() => setShowVoiceBooking(false)}
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  ✕
                </button>
              </div>
              <VoiceBooking onBookingCreated={() => {
                setShowVoiceBooking(false);
                fetchBookings();
              }} />
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {activeTab === 'classes' && (
          <>
            {/* Filters */}
            <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="text"
                      placeholder="Search classes, instructors, or keywords..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Calendar size={20} className="text-gray-500" />
                    <DatePicker
                      selected={selectedDate}
                      onChange={(date: Date) => setSelectedDate(date)}
                      className="px-3 py-2 border border-gray-300 rounded-lg"
                      dateFormat="MMMM d, yyyy"
                    />
                  </div>
                  
                  <button
                    onClick={fetchClasses}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Filter size={20} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Class Type Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Class Type
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {classTypes.map((type) => (
                      <button
                        key={type.id}
                        onClick={() => setSelectedType(type.id)}
                        className={`px-3 py-1.5 rounded-full text-sm ${
                          selectedType === type.id
                            ? 'bg-blue-100 text-blue-700 border border-blue-300'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        <span className="mr-1">{type.icon}</span>
                        {type.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Difficulty Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Difficulty
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {difficulties.map((diff) => (
                      <button
                        key={diff.id}
                        onClick={() => setSelectedDifficulty(diff.id)}
                        className={`px-3 py-1.5 rounded-full text-sm ${
                          selectedDifficulty === diff.id
                            ? 'bg-green-100 text-green-700 border border-green-300'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {diff.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Location Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Location
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {locations.map((loc) => {
                      const Icon = loc.icon;
                      return (
                        <button
                          key={loc.id}
                          onClick={() => setSelectedLocation(loc.id)}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm ${
                            selectedLocation === loc.id
                              ? 'bg-purple-100 text-purple-700 border border-purple-300'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          <Icon size={14} />
                          {loc.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Classes Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {/* Upcoming Classes */}
              <div className="lg:col-span-2">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  Available Classes ({classes.length})
                </h2>
                
                {classes.length === 0 ? (
                  <div className="bg-white rounded-xl shadow p-8 text-center">
                    <Calendar size={48} className="mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No classes found</h3>
                    <p className="text-gray-600 mb-4">Try adjusting your filters or select a different date</p>
                    <button
                      onClick={() => {
                        setSelectedType('all');
                        setSelectedDifficulty('all');
                        setSelectedLocation('all');
                        setSelectedDate(new Date());
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Reset Filters
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {classes.map((yogaClass) => (
                      <div
                        key={yogaClass.id}
                        className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow border border-gray-200"
                      >
                        {/* Class Header */}
                        <div className="p-6">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                yogaClass.type === 'hot' ? 'bg-red-100 text-red-800' :
                                yogaClass.type === 'vinyasa' ? 'bg-blue-100 text-blue-800' :
                                yogaClass.type === 'yin' ? 'bg-purple-100 text-purple-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {yogaClass.type.toUpperCase()}
                              </span>
                              <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                                yogaClass.difficulty === 'beginner' ? 'bg-green-100 text-green-800' :
                                yogaClass.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {yogaClass.difficulty.toUpperCase()}
                              </span>
                            </div>
                            {yogaClass.isFeatured && (
                              <span className="flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                                <Star size={12} />
                                Featured
                              </span>
                            )}
                          </div>

                          <h3 className="text-xl font-bold text-gray-900 mb-2">{yogaClass.title}</h3>
                          <p className="text-gray-600 text-sm mb-4 line-clamp-2">{yogaClass.description}</p>

                          {/* Class Details */}
                          <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="flex items-center text-gray-600">
                              <Clock size={16} className="mr-2" />
                              <span className="text-sm">{yogaClass.duration} min</span>
                            </div>
                            <div className="flex items-center text-gray-600">
                              <Users size={16} className="mr-2" />
                              <span className="text-sm">
                                {yogaClass.currentBookings}/{yogaClass.maxCapacity} spots
                              </span>
                            </div>
                            <div className="flex items-center text-gray-600">
                              {yogaClass.locationType === 'ONLINE' ? (
                                <Video size={16} className="mr-2" />
                              ) : (
                                <MapPin size={16} className="mr-2" />
                              )}
                              <span className="text-sm">
                                {yogaClass.locationType === 'ONLINE' ? 'Online' : 
                                 yogaClass.locationType === 'HYBRID' ? 'Hybrid' :
                                 yogaClass.locationType === 'OUTDOOR' ? 'Outdoor' : 'Studio'}
                              </span>
                            </div>
                            <div className="flex items-center text-gray-600">
                              <CreditCard size={16} className="mr-2" />
                              <span className="text-sm font-semibold">
                                ${yogaClass.price || 'Free'}
                              </span>
                            </div>
                          </div>

                          {/* Instructor */}
                          <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center">
                              {yogaClass.instructor.profileImage ? (
                                <img
                                  src={yogaClass.instructor.profileImage}
                                  alt={yogaClass.instructor.displayName}
                                  className="w-8 h-8 rounded-full mr-3"
                                />
                              ) : (
                                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center mr-3">
                                  <Users size={16} className="text-gray-500" />
                                </div>
                              )}
                              <div>
                                <p className="font-medium text-gray-900">{yogaClass.instructor.displayName}</p>
                                <div className="flex items-center">
                                  <Star size={12} className="text-yellow-400 mr-1" />
                                  <span className="text-xs text-gray-600">
                                    {yogaClass.instructor.rating.toFixed(1)} • {yogaClass.instructor.specialties[0]}
                                  </span>
                                </div>
                              </div>
                            </div>
                            
                            <div className="text-right">
                              <p className="text-sm text-gray-600">
                                {new Date(yogaClass.startTime).toLocaleTimeString([], { 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                })}
                              </p>
                              <p className="text-xs text-gray-500">
                                {new Date(yogaClass.startTime).toLocaleDateString([], {
                                  weekday: 'short',
                                  month: 'short',
                                  day: 'numeric'
                                })}
                              </p>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleClassSelect(yogaClass)}
                              disabled={yogaClass.currentBookings >= yogaClass.maxCapacity}
                              className={`flex-1 py-2 px-4 rounded-lg font-medium text-center ${
                                yogaClass.currentBookings >= yogaClass.maxCapacity
                                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                  : 'bg-blue-600 text-white hover:bg-blue-700'
                              }`}
                            >
                              {yogaClass.currentBookings >= yogaClass.maxCapacity ? 'Full' : 'Book Now'}
                            </button>
                            
                            {yogaClass.locationType === 'ONLINE' || yogaClass.locationType === 'HYBRID' ? (
                              <button
                                onClick={() => router.push(`/classes/${yogaClass.id}`)}
                                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                              >
                                Details
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sidebar - Quick Booking & Stats */}
              <div className="space-y-6">
                {/* Quick Stats */}
                <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
                  <h3 className="text-lg font-semibold mb-4">Booking Stats</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-blue-100">Today's Bookings</span>
                      <span className="font-bold text-xl">{bookings.filter(b => 
                        new Date(b.startTime).toDateString() === new Date().toDateString()
                      ).length}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-blue-100">This Month</span>
                      <span className="font-bold text-xl">{bookings.filter(b => 
                        new Date(b.startTime).getMonth() === new Date().getMonth()
                      ).length}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-blue-100">Live Classes</span>
                      <span className="font-bold text-xl">{streamingNow.length}</span>
                    </div>
                  </div>
                </div>

                {/* Quick Booking */}
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Book</h3>
                  <div className="space-y-3">
                    <button
                      onClick={() => {
                        setSelectedType('vinyasa');
                        setSelectedDifficulty('all');
                        setSelectedLocation('online');
                      }}
                      className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center">
                        <Video size={20} className="text-blue-600 mr-3" />
                        <div className="text-left">
                          <p className="font-medium text-gray-900">Online Vinyasa</p>
                          <p className="text-sm text-gray-600">Available now</p>
                        </div>
                      </div>
                      <ChevronRight size={20} className="text-gray-400" />
                    </button>

                    <button
                      onClick={() => {
                        setSelectedType('yin');
                        setSelectedDifficulty('beginner');
                        setSelectedLocation('studio');
                      }}
                      className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center">
                        <MapPin size={20} className="text-green-600 mr-3" />
                        <div className="text-left">
                          <p className="font-medium text-gray-900">Studio Yin</p>
                          <p className="text-sm text-gray-600">Beginner friendly</p>
                        </div>
                      </div>
                      <ChevronRight size={20} className="text-gray-400" />
                    </button>

                    <button
                      onClick={() => setShowVoiceBooking(true)}
                      className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg hover:from-purple-100 hover:to-blue-100"
                    >
                      <div className="flex items-center">
                        <Mic size={20} className="text-purple-600 mr-3" />
                        <div className="text-left">
                          <p className="font-medium text-gray-900">Voice Booking</p>
                          <p className="text-sm text-gray-600">AI-powered booking</p>
                        </div>
                      </div>
                      <Zap size={20} className="text-purple-600" />
                    </button>
                  </div>
                </div>

                {/* Live Now */}
                {streamingNow.length > 0 && (
                  <div className="bg-white rounded-xl shadow-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">Live Now</h3>
                      <span className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                        LIVE
                      </span>
                    </div>
                    <div className="space-y-3">
                      {streamingNow.slice(0, 3).map((session) => (
                        <div
                          key={session.id}
                          className="p-3 border border-gray-200 rounded-lg hover:border-red-300 cursor-pointer"
                          onClick={() => handleJoinLiveStream(session.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-gray-900 truncate">{session.title}</p>
                              <p className="text-sm text-gray-600">{session.instructor.displayName}</p>
                            </div>
                            <button className="px-3 py-1 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700">
                              Join
                            </button>
                          </div>
                        </div>
                      ))}
                      {streamingNow.length > 3 && (
                        <button
                          onClick={() => setActiveTab('live')}
                          className="w-full text-center text-blue-600 hover:text-blue-800 text-sm font-medium py-2"
                        >
                          View all {streamingNow.length} live sessions →
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === 'calendar' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">My Calendar</h2>
            <BookingCalendar bookings={bookings} onBookingSelect={setSelectedClass} />
          </div>
        )}

        {activeTab === 'bookings' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">My Bookings</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => router.push('/bookings/upcoming')}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  View All
                </button>
                <button
                  onClick={() => setActiveTab('classes')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Book New
                </button>
              </div>
            </div>

            {bookings.length === 0 ? (
              <div className="text-center py-12">
                <Calendar size={48} className="mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No bookings yet</h3>
                <p className="text-gray-600 mb-6">Book your first yoga class or session</p>
                <button
                  onClick={() => setActiveTab('classes')}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Browse Classes
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {bookings.map((booking) => (
                  <div
                    key={booking.id}
                    className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            booking.status === 'CONFIRMED' ? 'bg-green-100 text-green-800' :
                            booking.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {booking.status}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            booking.paymentStatus === 'COMPLETED' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {booking.paymentStatus}
                          </span>
                        </div>
                        
                        <h3 className="font-semibold text-gray-900 mb-1">
                          {booking.class?.title || 'Private Session'}
                        </h3>
                        
                        <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-3">
                          <div className="flex items-center">
                            <Calendar size={14} className="mr-2" />
                            {new Date(booking.startTime).toLocaleDateString([], {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </div>
                          <div className="flex items-center">
                            <Clock size={14} className="mr-2" />
                            {new Date(booking.startTime).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                          <div className="flex items-center">
                            <Users size={14} className="mr-2" />
                            {booking.participants} {booking.participants === 1 ? 'person' : 'people'}
                          </div>
                          <div className="flex items-center">
                            <CreditCard size={14} className="mr-2" />
                            ${booking.totalAmount}
                          </div>
                        </div>

                        {booking.class?.instructor && (
                          <div className="flex items-center text-sm text-gray-600">
                            <span>Instructor: {booking.class.instructor.displayName}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        {booking.status === 'CONFIRMED' && (
                          <>
                            <button
                              onClick={() => handleCancelBooking(booking.id)}
                              className="px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50"
                            >
                              Cancel
                            </button>
                            {booking.class?.locationType === 'ONLINE' && (
                              <button
                                onClick={() => booking.class && handleJoinLiveStream(booking.class.id)}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                              >
                                Join
                              </button>
                            )}
                          </>
                        )}
                        <button
                          onClick={() => router.push(`/bookings/${booking.id}`)}
                          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                          Details
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'live' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Live Streaming Now</h2>
            {streamingNow.length === 0 ? (
              <div className="text-center py-12">
                <Video size={48} className="mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No live sessions</h3>
                <p className="text-gray-600 mb-4">Check back later for live yoga sessions</p>
                <button
                  onClick={() => setActiveTab('classes')}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Browse Upcoming Classes
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {streamingNow.map((session) => (
                  <div
                    key={session.id}
                    className="border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition-shadow"
                  >
                    <div className="aspect-video bg-gray-900 relative">
                      {/* Video Player Placeholder */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <Video size={48} className="text-white mx-auto mb-2" />
                          <span className="flex items-center justify-center gap-2