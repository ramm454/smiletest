'use client';
import { useState, useEffect } from 'react';
import { Shield, MicOff, UserX, AlertTriangle, Users, MessageSquare, Filter, Ban, CheckCircle } from 'lucide-react';

interface ModerationPanelProps {
  sessionId: string;
  userId: string;
  isHost: boolean;
  onModerate: (action: any) => Promise<void>;
}

export default function ModerationPanel({ sessionId, userId, isHost, onModerate }: ModerationPanelProps) {
  const [participants, setParticipants] = useState<any[]>([]);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [moderationLogs, setModerationLogs] = useState<any[]>([]);
  const [filters, setFilters] = useState({
    profanity: true,
    links: true,
    spam: true,
  });

  useEffect(() => {
    loadModerationData();
    const interval = setInterval(loadModerationData, 5000);
    return () => clearInterval(interval);
  }, [sessionId]);

  const loadModerationData = async () => {
    try {
      const [participantsRes, messagesRes, logsRes] = await Promise.all([
        fetch(`/api/live/${sessionId}/participants`),
        fetch(`/api/live/${sessionId}/messages?limit=50`),
        fetch(`/api/live/${sessionId}/moderation-logs`),
      ]);

      if (participantsRes.ok) {
        const data = await participantsRes.json();
        setParticipants(data.participants || []);
      }

      if (messagesRes.ok) {
        const data = await messagesRes.json();
        setChatMessages(data.messages || []);
      }

      if (logsRes.ok) {
        const data = await logsRes.logs();
        setModerationLogs(data.logs || []);
      }
    } catch (error) {
      console.error('Error loading moderation data:', error);
    }
  };

  const handleModerate = async (action: string, targetUserId: string, duration?: number) => {
    try {
      await onModerate({
        sessionId,
        targetUserId,
        action,
        duration,
        reason: `Moderated by ${userId}`,
      });
      
      // Refresh data
      loadModerationData();
    } catch (error) {
      console.error('Moderation failed:', error);
    }
  };

  const filteredMessages = chatMessages.filter(msg => {
    if (filters.profanity && this.containsProfanity(msg.message)) return false;
    if (filters.links && this.containsLinks(msg.message)) return false;
    if (filters.spam && this.isSpam(msg)) return false;
    return true;
  });

  return (
    <div className="bg-gray-800 rounded-lg p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold flex items-center">
          <Shield className="mr-2" size={20} />
          Moderation Panel
        </h3>
        <div className="flex items-center space-x-2">
          <button className="p-2 bg-gray-700 rounded hover:bg-gray-600">
            <Filter size={16} />
          </button>
          <button className="p-2 bg-gray-700 rounded hover:bg-gray-600">
            <AlertTriangle size={16} />
          </button>
        </div>
      </div>

      {/* Content Filters */}
      <div className="mb-4 p-3 bg-gray-900 rounded">
        <h4 className="text-gray-300 text-sm font-medium mb-2">Content Filters</h4>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilters(prev => ({ ...prev, profanity: !prev.profanity }))}
            className={`px-3 py-1 rounded text-sm ${filters.profanity ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300'}`}
          >
            Profanity
          </button>
          <button
            onClick={() => setFilters(prev => ({ ...prev, links: !prev.links }))}
            className={`px-3 py-1 rounded text-sm ${filters.links ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
          >
            Links
          </button>
          <button
            onClick={() => setFilters(prev => ({ ...prev, spam: !prev.spam }))}
            className={`px-3 py-1 rounded text-sm ${filters.spam ? 'bg-yellow-600 text-white' : 'bg-gray-700 text-gray-300'}`}
          >
            Spam
          </button>
        </div>
      </div>

      {/* Participants List */}
      <div className="flex-1 overflow-auto mb-4">
        <h4 className="text-gray-300 text-sm font-medium mb-2 flex items-center">
          <Users className="mr-2" size={16} />
          Participants ({participants.length})
        </h4>
        <div className="space-y-2">
          {participants.map(participant => (
            <div
              key={participant.id}
              className={`p-2 rounded flex items-center justify-between ${selectedUser === participant.userId ? 'bg-gray-700' : 'bg-gray-900'}`}
              onClick={() => setSelectedUser(participant.userId)}
            >
              <div className="flex items-center">
                <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center mr-2">
                  {participant.user.firstName?.charAt(0) || 'U'}
                </div>
                <div>
                  <p className="text-white text-sm">
                    {participant.user.firstName} {participant.user.lastName}
                  </p>
                  <p className="text-gray-400 text-xs">{participant.role}</p>
                </div>
              </div>
              
              {isHost && participant.role !== 'HOST' && (
                <div className="flex space-x-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleModerate('mute', participant.userId, 10);
                    }}
                    className="p-1 bg-gray-700 rounded hover:bg-gray-600"
                    title="Mute for 10 minutes"
                  >
                    <MicOff size={14} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleModerate('kick', participant.userId);
                    }}
                    className="p-1 bg-gray-700 rounded hover:bg-gray-600"
                    title="Kick from session"
                  >
                    <UserX size={14} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleModerate('ban', participant.userId, 60);
                    }}
                    className="p-1 bg-gray-700 rounded hover:bg-gray-600"
                    title="Ban for 1 hour"
                  >
                    <Ban size={14} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Recent Moderation Logs */}
      <div className="mt-4">
        <h4 className="text-gray-300 text-sm font-medium mb-2">Recent Actions</h4>
        <div className="space-y-1 max-h-32 overflow-auto">
          {moderationLogs.slice(0, 5).map(log => (
            <div key={log.id} className="p-2 bg-gray-900 rounded text-xs">
              <p className="text-gray-300">
                <span className="font-medium">{log.moderator.firstName}</span>
                {' '}{log.action}{' '}
                <span className="font-medium">{log.targetUser.firstName}</span>
              </p>
              <p className="text-gray-500 text-xs">{new Date(log.createdAt).toLocaleTimeString()}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      {selectedUser && (
        <div className="mt-4 p-3 bg-gray-900 rounded">
          <h4 className="text-gray-300 text-sm font-medium mb-2">Quick Actions</h4>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleModerate('warn', selectedUser)}
              className="p-2 bg-yellow-600 rounded text-sm hover:bg-yellow-700"
            >
              Warn
            </button>
            <button
              onClick={() => handleModerate('mute', selectedUser, 5)}
              className="p-2 bg-orange-600 rounded text-sm hover:bg-orange-700"
            >
              Mute 5min
            </button>
            <button
              onClick={() => handleModerate('kick', selectedUser)}
              className="p-2 bg-red-600 rounded text-sm hover:bg-red-700"
            >
              Kick
            </button>
            <button
              onClick={() => handleModerate('ban', selectedUser, 60)}
              className="p-2 bg-purple-600 rounded text-sm hover:bg-purple-700"
            >
              Ban 1hr
            </button>
          </div>
        </div>
      )}
    </div>
  );
}