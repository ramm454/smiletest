'use client';
import { useState, useEffect, useRef } from 'react';
import { Video, Users, MessageSquare, Share2, Settings, Mic, MicOff, Video as VideoIcon, VideoOff, ScreenShare, Whiteboard, BarChart, Download } from 'lucide-react';
import io from 'socket.io-client';

interface LiveSessionProps {
  sessionId: string;
  userId: string;
  token: string;
}

export default function LiveSession({ sessionId, userId, token }: LiveSessionProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const socket = useRef<any>(null);

  useEffect(() => {
    initializeSession();
    return () => {
      cleanupSession();
    };
  }, [sessionId, userId]);

  const initializeSession = async () => {
    try {
      // Initialize WebSocket connection
      socket.current = io('http://localhost:3004/live', {
        query: {
          sessionId,
          userId,
        },
      });

      // Setup socket event listeners
      socket.current.on('connect', () => {
        console.log('Connected to live session');
      });

      socket.current.on('existing-participants', (participants: any[]) => {
        participants.forEach(participant => {
          createPeerConnection(participant.socketId, false);
        });
      });

      socket.current.on('participant-joined', (data: any) => {
        createPeerConnection(data.socketId, true);
        addParticipant(data);
      });

      socket.current.on('participant-left', (data: any) => {
        removeParticipant(data.socketId);
      });

      socket.current.on('offer', async (data: any) => {
        const pc = peerConnections.current.get(data.from);
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.current.emit('answer', {
            to: data.from,
            answer: answer,
          });
        }
      });

      socket.current.on('answer', async (data: any) => {
        const pc = peerConnections.current.get(data.from);
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        }
      });

      socket.current.on('ice-candidate', async (data: any) => {
        const pc = peerConnections.current.get(data.from);
        if (pc && data.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
      });

      socket.current.on('new-chat-message', (message: any) => {
        setMessages(prev => [...prev, message]);
      });

      socket.current.on('screen-share-started', (data: any) => {
        console.log(`${data.userId} started screen sharing`);
      });

      socket.current.on('screen-share-stopped', (data: any) => {
        console.log(`${data.userId} stopped screen sharing`);
      });

      // Get local media stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

    } catch (error) {
      console.error('Error initializing session:', error);
    }
  };

  const createPeerConnection = (socketId: string, isInitiator: boolean) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });

    // Add local stream to connection
    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });
    }

    // Handle remote stream
    pc.ontrack = (event) => {
      setRemoteStreams(prev => {
        const newMap = new Map(prev);
        newMap.set(socketId, event.streams[0]);
        return newMap;
      });
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.current.emit('ice-candidate', {
          to: socketId,
          candidate: event.candidate,
        });
      }
    };

    peerConnections.current.set(socketId, pc);

    // Create offer if initiator
    if (isInitiator) {
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .then(() => {
          socket.current.emit('offer', {
            to: socketId,
            offer: pc.localDescription,
          });
        });
    }
  };

  const toggleAudio = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsAudioMuted(!isAudioMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
        });
        
        // Replace video track in all peer connections
        const videoTrack = screenStream.getVideoTracks()[0];
        
        peerConnections.current.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) {
            sender.replaceTrack(videoTrack);
          }
        });

        screenStream.getVideoTracks()[0].onended = () => {
          toggleScreenShare();
        };

        setIsScreenSharing(true);
        socket.current.emit('screen-share-start', { sessionId });
      } else {
        // Switch back to camera
        if (localStream) {
          const cameraTrack = localStream.getVideoTracks()[0];
          peerConnections.current.forEach(pc => {
            const sender = pc.getSenders().find(s => s.track?.kind === 'video');
            if (sender) {
              sender.replaceTrack(cameraTrack);
            }
          });
        }
        setIsScreenSharing(false);
        socket.current.emit('screen-share-stop', { sessionId });
      }
    } catch (error) {
      console.error('Error toggling screen share:', error);
    }
  };

  const sendMessage = (message: string) => {
    socket.current.emit('send-message', {
      sessionId,
      message,
    });
    setMessages(prev => [...prev, {
      userId,
      message,
      timestamp: new Date().toISOString(),
      isOwn: true,
    }]);
  };

  const cleanupSession = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    
    peerConnections.current.forEach(pc => pc.close());
    peerConnections.current.clear();
    
    if (socket.current) {
      socket.current.disconnect();
    }
  };

  const addParticipant = (participant: any) => {
    setParticipants(prev => [...prev, participant]);
  };

  const removeParticipant = (socketId: string) => {
    setParticipants(prev => prev.filter(p => p.socketId !== socketId));
    setRemoteStreams(prev => {
      const newMap = new Map(prev);
      newMap.delete(socketId);
      return newMap;
    });
    peerConnections.current.get(socketId)?.close();
    peerConnections.current.delete(socketId);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Video Grid */}
        <div className="flex-1 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 h-full">
            {/* Local Video */}
            <div className="relative bg-black rounded-lg overflow-hidden">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-2 left-2 text-white text-sm bg-black bg-opacity-50 px-2 py-1 rounded">
                You {isAudioMuted && '(Muted)'} {isVideoOff && '(Video Off)'}
              </div>
            </div>

            {/* Remote Videos */}
            {Array.from(remoteStreams.entries()).map(([socketId, stream]) => (
              <div key={socketId} className="relative bg-black rounded-lg overflow-hidden">
                <video
                  autoPlay
                  className="w-full h-full object-cover"
                  ref={(video) => {
                    if (video) video.srcObject = stream;
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col">
          {/* Participants */}
          <div className="p-4 border-b border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-white font-semibold">Participants ({participants.length + 1})</h3>
              <Users className="text-gray-400" size={20} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center text-white text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                You
              </div>
              {participants.map(participant => (
                <div key={participant.socketId} className="flex items-center text-gray-300 text-sm">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  User {participant.userId}
                </div>
              ))}
            </div>
          </div>

          {/* Chat */}
          <div className="flex-1 p-4 overflow-hidden flex flex-col">
            <h3 className="text-white font-semibold mb-2">Chat</h3>
            <div className="flex-1 overflow-y-auto mb-4">
              {messages.map((msg, index) => (
                <div key={index} className={`mb-2 ${msg.isOwn ? 'text-right' : 'text-left'}`}>
                  <div className={`inline-block px-3 py-2 rounded-lg ${msg.isOwn ? 'bg-blue-600 text-white' : 'bg-gray-700 text-white'}`}>
                    <p className="text-sm">{msg.message}</p>
                    <p className="text-xs opacity-75 mt-1">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex">
              <input
                type="text"
                placeholder="Type a message..."
                className="flex-1 px-3 py-2 bg-gray-700 text-white rounded-l-lg focus:outline-none"
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                    sendMessage(e.currentTarget.value);
                    e.currentTarget.value = '';
                  }
                }}
              />
              <button className="px-4 py-2 bg-blue-600 text-white rounded-r-lg hover:bg-blue-700">
                Send
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-gray-800 p-4 border-t border-gray-700">
        <div className="flex justify-center items-center space-x-4">
          <button
            onClick={toggleAudio}
            className={`p-3 rounded-full ${isAudioMuted ? 'bg-red-600' : 'bg-gray-700'} hover:bg-gray-600`}
          >
            {isAudioMuted ? <MicOff size={24} className="text-white" /> : <Mic size={24} className="text-white" />}
          </button>
          <button
            onClick={toggleVideo}
            className={`p-3 rounded-full ${isVideoOff ? 'bg-red-600' : 'bg-gray-700'} hover:bg-gray-600`}
          >
            {isVideoOff ? <VideoOff size={24} className="text-white" /> : <VideoIcon size={24} className="text-white" />}
          </button>
          <button
            onClick={toggleScreenShare}
            className={`p-3 rounded-full ${isScreenSharing ? 'bg-green-600' : 'bg-gray-700'} hover:bg-gray-600`}
          >
            <Share2 size={24} className="text-white" />
          </button>
          <button
            onClick={() => setShowWhiteboard(!showWhiteboard)}
            className="p-3 rounded-full bg-gray-700 hover:bg-gray-600"
          >
            <Whiteboard size={24} className="text-white" />
          </button>
          <button className="p-3 rounded-full bg-gray-700 hover:bg-gray-600">
            <Settings size={24} className="text-white" />
          </button>
          <button className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
            Leave
          </button>
        </div>
      </div>

      {/* Whiteboard Modal */}
      {showWhiteboard && (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center">
          <div className="bg-gray-800 rounded-lg w-4/5 h-4/5 flex flex-col">
            <div className="p-4 border-b border-gray-700 flex justify-between items-center">
              <h3 className="text-white text-xl">Whiteboard</h3>
              <button
                onClick={() => setShowWhiteboard(false)}
                className="text-white hover:text-gray-300"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 bg-white">
              {/* Whiteboard canvas would go here */}
              <div className="w-full h-full flex items-center justify-center text-gray-500">
                Whiteboard Canvas (Interactive Drawing Area)
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}