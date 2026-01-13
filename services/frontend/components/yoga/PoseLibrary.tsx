'use client';

import { useState, useEffect } from 'react';
import { Search, Filter, Heart, Activity, Star, Clock } from 'lucide-react';

interface Pose {
  id: string;
  name: string;
  sanskritName?: string;
  category: string;
  difficulty: string;
  benefits: string[];
  imageUrl?: string;
  duration?: number;
}

export default function PoseLibrary() {
  const [poses, setPoses] = useState<Pose[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPoses();
  }, [selectedCategory, selectedDifficulty, searchQuery]);

  const fetchPoses = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory !== 'all') params.append('category', selectedCategory);
      if (selectedDifficulty !== 'all') params.append('difficulty', selectedDifficulty);
      if (searchQuery) params.append('search', searchQuery);

      const response = await fetch(`/api/yoga/poses?${params}`);
      const data = await response.json();
      setPoses(data.poses || []);
      
      // Extract unique categories
      const uniqueCategories = [...new Set(data.poses?.map((p: Pose) => p.category) || [])];
      setCategories(uniqueCategories);
    } catch (error) {
      console.error('Error fetching poses:', error);
    } finally {
      setLoading(false);
    }
  };

  const difficulties = ['beginner', 'intermediate', 'advanced'];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Yoga Pose Library</h1>
          <p className="text-gray-600">Explore hundreds of yoga poses with detailed instructions</p>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search poses by name, benefits, or Sanskrit name..."
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <button
              onClick={fetchPoses}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Filter size={20} />
              Apply Filters
            </button>
          </div>

          <div className="flex flex-wrap gap-4">
            {/* Category Filter */}
            <div>
              <h3 className="font-medium text-gray-700 mb-2">Category</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`px-4 py-2 rounded-full ${selectedCategory === 'all' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  All
                </button>
                {categories.map(category => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-4 py-2 rounded-full ${selectedCategory === category ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>

            {/* Difficulty Filter */}
            <div>
              <h3 className="font-medium text-gray-700 mb-2">Difficulty</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedDifficulty('all')}
                  className={`px-4 py-2 rounded-full ${selectedDifficulty === 'all' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  All Levels
                </button>
                {difficulties.map(difficulty => (
                  <button
                    key={difficulty}
                    onClick={() => setSelectedDifficulty(difficulty)}
                    className={`px-4 py-2 rounded-full capitalize ${selectedDifficulty === difficulty ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                  >
                    {difficulty}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Poses Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading poses...</p>
          </div>
        ) : poses.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl shadow">
            <Activity size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No poses found</h3>
            <p className="text-gray-600">Try adjusting your filters or search terms</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {poses.map(pose => (
              <div key={pose.id} className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                {/* Pose Image */}
                <div className="h-48 bg-gradient-to-br from-blue-100 to-purple-100 relative">
                  {pose.imageUrl ? (
                    <img
                      src={pose.imageUrl}
                      alt={pose.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <Activity size={64} className="text-gray-400" />
                    </div>
                  )}
                  <div className="absolute top-4 right-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${pose.difficulty === 'beginner' ? 'bg-green-100 text-green-800' : pose.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                      {pose.difficulty}
                    </span>
                  </div>
                </div>

                {/* Pose Details */}
                <div className="p-6">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg">{pose.name}</h3>
                      {pose.sanskritName && (
                        <p className="text-gray-600 text-sm italic">{pose.sanskritName}</p>
                      )}
                    </div>
                    <button className="p-2 text-gray-400 hover:text-red-500">
                      <Heart size={20} />
                    </button>
                  </div>

                  <div className="flex items-center text-gray-600 text-sm mb-4">
                    <span className="px-2 py-1 bg-gray-100 rounded">{pose.category}</span>
                    {pose.duration && (
                      <span className="ml-2 flex items-center">
                        <Clock size={14} className="mr-1" />
                        {pose.duration}s
                      </span>
                    )}
                  </div>

                  <div className="mb-4">
                    <h4 className="font-medium text-gray-700 mb-2">Benefits:</h4>
                    <div className="flex flex-wrap gap-2">
                      {pose.benefits.slice(0, 3).map((benefit, index) => (
                        <span key={index} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs">
                          {benefit}
                        </span>
                      ))}
                      {pose.benefits.length > 3 && (
                        <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                          +{pose.benefits.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                      View Details
                    </button>
                    <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">
                      Add to Sequence
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl shadow">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-full mr-4">
                <Activity size={24} className="text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">{poses.length}</p>
                <p className="text-gray-600">Total Poses</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-full mr-4">
                <Star size={24} className="text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">
                  {poses.filter(p => p.difficulty === 'beginner').length}
                </p>
                <p className="text-gray-600">Beginner Poses</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-full mr-4">
                <Filter size={24} className="text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">{categories.length}</p>
                <p className="text-gray-600">Categories</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}