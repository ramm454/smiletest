'use client';

import { useState, useEffect } from 'react';
import { Plus, Filter, Search, Star, Users, Clock, BookOpen } from 'lucide-react';

interface Sequence {
  id: string;
  name: string;
  description: string;
  type: string;
  difficulty: string;
  totalDuration: number;
  focusArea: string;
  instructor: {
    id: string;
    firstName: string;
    lastName: string;
    avatar: string;
  };
  usageCount: number;
  averageRating: number;
}

export default function SequencesPage() {
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState('all');

  useEffect(() => {
    fetchSequences();
  }, [selectedType, selectedDifficulty]);

  const fetchSequences = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedType !== 'all') params.append('type', selectedType);
      if (selectedDifficulty !== 'all') params.append('difficulty', selectedDifficulty);

      const response = await fetch(`/api/yoga/sequences?${params}`);
      const data = await response.json();
      setSequences(data.sequences || []);
    } catch (error) {
      console.error('Error fetching sequences:', error);
    } finally {
      setLoading(false);
    }
  };

  const sequenceTypes = [
    { id: 'all', name: 'All Types' },
    { id: 'morning', name: 'Morning' },
    { id: 'evening', name: 'Evening' },
    { id: 'energizing', name: 'Energizing' },
    { id: 'relaxing', name: 'Relaxing' },
    { id: 'strength', name: 'Strength' },
    { id: 'flexibility', name: 'Flexibility' },
  ];

  const difficulties = [
    { id: 'all', name: 'All Levels' },
    { id: 'beginner', name: 'Beginner' },
    { id: 'intermediate', name: 'Intermediate' },
    { id: 'advanced', name: 'Advanced' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Yoga Sequences</h1>
              <p className="text-gray-600">Build and discover yoga sequences for your practice</p>
            </div>
            <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
              <Plus size={20} />
              Create Sequence
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1">
              <h3 className="font-medium text-gray-700 mb-2">Sequence Type</h3>
              <div className="flex flex-wrap gap-2">
                {sequenceTypes.map(type => (
                  <button
                    key={type.id}
                    onClick={() => setSelectedType(type.id)}
                    className={`px-4 py-2 rounded-full ${selectedType === type.id ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                  >
                    {type.name}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h3 className="font-medium text-gray-700 mb-2">Difficulty</h3>
              <div className="flex flex-wrap gap-2">
                {difficulties.map(diff => (
                  <button
                    key={diff.id}
                    onClick={() => setSelectedDifficulty(diff.id)}
                    className={`px-4 py-2 rounded-full ${selectedDifficulty === diff.id ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                  >
                    {diff.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Sequences Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading sequences...</p>
          </div>
        ) : sequences.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl shadow">
            <BookOpen size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No sequences found</h3>
            <p className="text-gray-600">Create the first sequence or try different filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sequences.map(sequence => (
              <div key={sequence.id} className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${sequence.type === 'morning' ? 'bg-yellow-100 text-yellow-800' : sequence.type === 'evening' ? 'bg-indigo-100 text-indigo-800' : 'bg-blue-100 text-blue-800'}`}>
                        {sequence.type}
                      </span>
                      <span className={`ml-2 px-3 py-1 rounded-full text-xs font-medium ${sequence.difficulty === 'beginner' ? 'bg-green-100 text-green-800' : sequence.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                        {sequence.difficulty}
                      </span>
                    </div>
                    <div className="flex items-center">
                      <Star size={16} className="text-yellow-400 fill-yellow-400" />
                      <span className="ml-1 text-sm font-medium">{sequence.averageRating.toFixed(1)}</span>
                    </div>
                  </div>

                  <h3 className="font-bold text-gray-900 text-lg mb-2">{sequence.name}</h3>
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">{sequence.description}</p>

                  <div className="flex items-center text-gray-600 text-sm mb-6">
                    <div className="flex items-center mr-4">
                      <Clock size={16} className="mr-2" />
                      <span>{sequence.totalDuration} min</span>
                    </div>
                    <div className="flex items-center">
                      <Users size={16} className="mr-2" />
                      <span>{sequence.usageCount} uses</span>
                    </div>
                  </div>

                  {sequence.focusArea && (
                    <div className="mb-6">
                      <span className="px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-sm">
                        Focus: {sequence.focusArea}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      {sequence.instructor.avatar ? (
                        <img
                          src={sequence.instructor.avatar}
                          alt={sequence.instructor.firstName}
                          className="w-8 h-8 rounded-full mr-3"
                        />
                      ) : (
                        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center mr-3">
                          <Users size={16} className="text-gray-500" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-gray-900 text-sm">
                          {sequence.instructor.firstName} {sequence.instructor.lastName}
                        </p>
                      </div>
                    </div>
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}