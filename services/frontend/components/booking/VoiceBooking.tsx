'use client';

import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, Play, RefreshCw } from 'lucide-react';

interface VoiceBookingProps {
  onBookingCreated: (booking: any) => void;
}

export default function VoiceBooking({ onBookingCreated }: VoiceBookingProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [conversation, setConversation] = useState<Array<{role: string, text: string}>>([]);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const voiceCommands = [
    "Book a yoga class for tomorrow morning",
    "Schedule a spa treatment for 2 people",
    "I want to meditate this evening",
    "Cancel my booking",
    "What are your prices?",
    "Help me reschedule"
  ];

  const startListening = () => {
    setIsListening(true);
    setTranscript('Listening...');
    
    // Mock voice recognition
    setTimeout(() => {
      const mockCommand = voiceCommands[Math.floor(Math.random() * voiceCommands.length)];
      setTranscript(mockCommand);
      processVoiceCommand(mockCommand);
      setIsListening(false);
    }, 2000);
  };

  const stopListening = () => {
    setIsListening(false);
    if (transcript === 'Listening...') {
      setTranscript('');
    }
  };

  const processVoiceCommand = async (command: string) => {
    setIsProcessing(true);
    setConversation(prev => [...prev, { role: 'user', text: command }]);
    
    try {
      // Call voice service
      const response = await fetch('http://localhost:8005/api/v1/voice/command', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: command,
          language: 'en'
        }),
      });

      if (response.ok) {
        const result = await response.json();
        const aiMessage = result.data?.response?.message || 'I understand your request.';
        setAiResponse(aiMessage);
        setConversation(prev => [...prev, { role: 'assistant', text: aiMessage }]);

        // If booking was created, notify parent
        if (result.data?.response?.action === 'booking_created') {
          onBookingCreated(result.data.response.booking);
        }

        // If there's audio response, play it
        if (result.data?.response?.audio?.base64) {
          const audioBlob = base64ToBlob(result.data.response.audio.base64, 'audio/mp3');
          const url = URL.createObjectURL(audioBlob);
          setAudioUrl(url);
        }
      } else {
        throw new Error('Voice service error');
      }
    } catch (error) {
      console.error('Voice processing error:', error);
      setAiResponse('Sorry, I encountered an error. Please try again.');
      setConversation(prev => [...prev, { role: 'assistant', text: 'Error processing request.' }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const base64ToBlob = (base64: string, mimeType: string) => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  };

  const playAudio = () => {
    if (audioRef.current && audioUrl) {
      audioRef.current.play();
    }
  };

  const resetConversation = () => {
    setTranscript('');
    setAiResponse('');
    setConversation([]);
    setAudioUrl(null);
  };

  const handleQuickCommand = (command: string) => {
    setTranscript(command);
    processVoiceCommand(command);
  };

  return (
    <div className="space-y-6">
      {/* Voice Input */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Voice Command</h3>
          <button
            onClick={resetConversation}
            className="p-2 text-gray-500 hover:text-gray-700"
            title="Reset conversation"
          >
            <RefreshCw size={20} />
          </button>
        </div>

        <div className="flex items-center space-x-4 mb-4">
          <button
            onClick={isListening ? stopListening : startListening}
            className={`p-4 rounded-full ${
              isListening 
                ? 'bg-red-100 text-red-600 animate-pulse' 
                : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
            }`}
          >
            {isListening ? <MicOff size={24} /> : <Mic size={24} />}
          </button>
          
          <div className="flex-1">
            <div className="text-sm text-gray-500 mb-1">You said:</div>
            <div className="p-3 bg-white rounded-lg border border-gray-200 min-h-[3rem]">
              {transcript || 'Click the microphone and speak...'}
            </div>
          </div>
        </div>

        {/* Quick Commands */}
        <div className="mb-4">
          <div className="text-sm text-gray-500 mb-2">Try saying:</div>
          <div className="flex flex-wrap gap-2">
            {voiceCommands.map((command, index) => (
              <button
                key={index}
                onClick={() => handleQuickCommand(command)}
                className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
              >
                {command}
              </button>
            ))}
          </div>
        </div>

        {/* Audio Player */}
        {audioUrl && (
          <div className="mt-4 p-3 bg-white rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Volume2 size={20} className="text-green-600" />
                <span className="text-sm text-gray-600">AI Response Audio</span>
              </div>
              <button
                onClick={playAudio}
                className="p-2 bg-green-100 text-green-600 rounded-full hover:bg-green-200"
              >
                <Play size={16} />
              </button>
            </div>
            <audio ref={audioRef} src={audioUrl} className="hidden" />
          </div>
        )}
      </div>

      {/* AI Response */}
      {aiResponse && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">AI Assistant Response</h3>
          <div className="p-4 bg-white rounded-lg border border-green-200">
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-green-100 rounded-full">
                <Volume2 size={20} className="text-green-600" />
              </div>
              <div className="flex-1">
                <p className="text-gray-700">{aiResponse}</p>
                {isProcessing && (
                  <div className="mt-2 flex items-center space-x-2 text-sm text-gray-500">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span>Processing...</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Conversation History */}
      {conversation.length > 0 && (
        <div className="bg-gray-50 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Conversation</h3>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {conversation.map((msg, index) => (
              <div
                key={index}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-lg ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-none'
                      : 'bg-white border border-gray-200 rounded-bl-none'
                  }`}
                >
                  <div className="text-sm font-medium mb-1">
                    {msg.role === 'user' ? 'You' : 'AI Assistant'}
                  </div>
                  <p>{msg.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Service Info */}
      <div className="text-center text-sm text-gray-500">
        <p>Voice service powered by AI agents • Real-time processing • Natural language understanding</p>
        <div className="flex justify-center space-x-6 mt-2">
          <a 
            href="http://localhost:8005/docs" 
            target="_blank" 
            className="text-blue-600 hover:underline"
          >
            Voice API Docs
          </a>
          <a 
            href="http://localhost:3002/health" 
            target="_blank" 
            className="text-blue-600 hover:underline"
          >
            Booking Service Health
          </a>
          <a 
            href="http://localhost:8002/health" 
            target="_blank" 
            className="text-blue-600 hover:underline"
          >
            AI Agent Health
          </a>
        </div>
      </div>
    </div>
  );
}