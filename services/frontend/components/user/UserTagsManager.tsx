'use client';
import { useState, useEffect } from 'react';
import { Tag, Plus, X, Edit2, Filter } from 'lucide-react';

interface UserTag {
  id: string;
  name: string;
  description?: string;
  color: string;
  userCount?: number;
  isAssigned?: boolean;
}

export default function UserTagsManager() {
  const [tags, setTags] = useState<UserTag[]>([]);
  const [userTags, setUserTags] = useState<string[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newTag, setNewTag] = useState({ name: '', color: '#3B82F6', description: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadTags();
    loadUserTags();
  }, []);

  const loadTags = async () => {
    try {
      const response = await fetch('/api/user?endpoint=admin-tags');
      if (response.ok) {
        const data = await response.json();
        setTags(data);
      }
    } catch (error) {
      console.error('Error loading tags:', error);
    }
  };

  const loadUserTags = async () => {
    try {
      const response = await fetch('/api/user?endpoint=tags');
      if (response.ok) {
        const data = await response.json();
        setUserTags(data.map((t: any) => t.tagId));
      }
    } catch (error) {
      console.error('Error loading user tags:', error);
    }
  };

  const createTag = async () => {
    if (!newTag.name.trim()) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/user?endpoint=admin-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTag)
      });
      
      if (response.ok) {
        const createdTag = await response.json();
        setTags([...tags, createdTag]);
        setNewTag({ name: '', color: '#3B82F6', description: '' });
        setShowCreate(false);
      }
    } catch (error) {
      console.error('Error creating tag:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleUserTag = async (tagId: string) => {
    const newUserTags = userTags.includes(tagId)
      ? userTags.filter(id => id !== tagId)
      : [...userTags, tagId];
    
    setUserTags(newUserTags);
    
    try {
      await fetch('/api/user?endpoint=tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagIds: newUserTags })
      });
    } catch (error) {
      console.error('Error updating tags:', error);
      // Revert on error
      setUserTags(userTags);
    }
  };

  const deleteTag = async (tagId: string) => {
    if (!confirm('Delete this tag? This will remove it from all users.')) return;
    
    try {
      const response = await fetch(`/api/user?endpoint=admin-tags&tagId=${tagId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setTags(tags.filter(t => t.id !== tagId));
        setUserTags(userTags.filter(id => id !== tagId));
      }
    } catch (error) {
      console.error('Error deleting tag:', error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">User Tags & Segmentation</h2>
          <p className="text-gray-600 mt-2">
            Organize users with tags and create segments for targeted communication
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
        >
          <Plus size={20} className="mr-2" />
          New Tag
        </button>
      </div>

      {showCreate && (
        <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <h3 className="font-semibold text-gray-800 mb-3">Create New Tag</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tag Name *
              </label>
              <input
                type="text"
                value={newTag.name}
                onChange={(e) => setNewTag({...newTag, name: e.target.value})}
                className="w-full p-2 border border-gray-300 rounded"
                placeholder="e.g., Premium User"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Color
              </label>
              <div className="flex items-center">
                <input
                  type="color"
                  value={newTag.color}
                  onChange={(e) => setNewTag({...newTag, color: e.target.value})}
                  className="w-10 h-10 cursor-pointer"
                />
                <span className="ml-2 text-sm text-gray-600">{newTag.color}</span>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <input
                type="text"
                value={newTag.description}
                onChange={(e) => setNewTag({...newTag, description: e.target.value})}
                className="w-full p-2 border border-gray-300 rounded"
                placeholder="Optional description"
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={createTag}
              disabled={loading || !newTag.name.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Tag'}
            </button>
          </div>
        </div>
      )}

      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">My Tags</h3>
        {userTags.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No tags assigned yet</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags
              .filter(tag => userTags.includes(tag.id))
              .map(tag => (
                <div
                  key={tag.id}
                  className="flex items-center px-3 py-2 rounded-full"
                  style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                >
                  <Tag size={14} className="mr-2" />
                  <span className="font-medium">{tag.name}</span>
                  <button
                    onClick={() => toggleUserTag(tag.id)}
                    className="ml-2 p-1 hover:bg-white/30 rounded-full"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">All Available Tags</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tags.map(tag => (
            <div
              key={tag.id}
              className={`p-4 border rounded-lg ${userTags.includes(tag.id) ? 'border-blue-300 bg-blue-50' : 'border-gray-200'}`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center mr-3"
                    style={{ backgroundColor: tag.color }}
                  >
                    <Tag size={16} className="text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800">{tag.name}</h4>
                    {tag.description && (
                      <p className="text-sm text-gray-600 mt-1">{tag.description}</p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => toggleUserTag(tag.id)}
                    className={`px-3 py-1 text-sm rounded ${
                      userTags.includes(tag.id)
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {userTags.includes(tag.id) ? 'Remove' : 'Add'}
                  </button>
                  <button
                    onClick={() => deleteTag(tag.id)}
                    className="p-1 text-gray-400 hover:text-red-600"
                    title="Delete tag"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
              
              <div className="flex justify-between text-sm text-gray-500 mt-3">
                <span>{tag.userCount || 0} users</span>
                <button className="flex items-center text-blue-600 hover:text-blue-800">
                  <Filter size={14} className="mr-1" />
                  Filter users
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 p-4 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg">
        <h4 className="font-semibold text-gray-800 mb-2">Tag Segments</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
          <button className="p-3 bg-white border border-gray-300 rounded-lg hover:border-blue-300 text-left">
            <div className="font-medium text-gray-800">New Users (Last 7 days)</div>
            <div className="text-sm text-gray-600 mt-1">Users who joined recently</div>
          </button>
          
          <button className="p-3 bg-white border border-gray-300 rounded-lg hover:border-blue-300 text-left">
            <div className="font-medium text-gray-800">Active Bookers</div>
            <div className="text-sm text-gray-600 mt-1">Users with 3+ bookings this month</div>
          </button>
          
          <button className="p-3 bg-white border border-gray-300 rounded-lg hover:border-blue-300 text-left">
            <div className="font-medium text-gray-800">Inactive Users</div>
            <div className="text-sm text-gray-600 mt-1">No login in 30+ days</div>
          </button>
        </div>
      </div>
    </div>
  );
}