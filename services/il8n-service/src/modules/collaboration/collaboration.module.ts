// src/modules/collaboration/collaboration.module.ts
import { Module } from '@nestjs/common';
import { CollaborationGateway } from './collaboration.gateway';
import { CollaborationService } from './collaboration.service';

@Module({
  providers: [CollaborationGateway, CollaborationService],
  exports: [CollaborationService]
})
export class CollaborationModule {}

// src/modules/collaboration/collaboration.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  namespace: 'collaboration',
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
  }
})
export class CollaborationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;
  
  private readonly logger = new Logger(CollaborationGateway.name);
  private translationRooms = new Map<string, Set<string>>(); // roomId -> Set of userIds
  private userRooms = new Map<string, Set<string>>(); // userId -> Set of roomIds

  handleConnection(client: Socket) {
    const userId = client.handshake.query.userId as string;
    const language = client.handshake.query.language as string;
    
    client.data.userId = userId;
    client.data.language = language;
    
    this.logger.log(`Client connected: ${userId}`);
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    
    // Remove user from all rooms
    const rooms = this.userRooms.get(userId) || new Set();
    rooms.forEach(roomId => {
      this.leaveTranslationRoom(client, roomId);
    });
    
    this.userRooms.delete(userId);
    this.logger.log(`Client disconnected: ${userId}`);
  }

  @SubscribeMessage('joinTranslationRoom')
  handleJoinRoom(
    @MessageBody() data: { roomId: string; translationKey: string },
    @ConnectedSocket() client: Socket
  ) {
    const { roomId, translationKey } = data;
    const userId = client.data.userId;
    
    client.join(roomId);
    
    // Initialize room if not exists
    if (!this.translationRooms.has(roomId)) {
      this.translationRooms.set(roomId, new Set());
    }
    
    // Add user to room
    this.translationRooms.get(roomId)!.add(userId);
    
    // Track user's rooms
    if (!this.userRooms.has(userId)) {
      this.userRooms.set(userId, new Set());
    }
    this.userRooms.get(userId)!.add(roomId);
    
    // Notify others in room
    client.to(roomId).emit('userJoined', {
      userId,
      language: client.data.language,
      timestamp: new Date().toISOString()
    });
    
    this.logger.log(`User ${userId} joined room ${roomId}`);
    
    return {
      success: true,
      roomId,
      participants: Array.from(this.translationRooms.get(roomId)!)
    };
  }

  @SubscribeMessage('leaveTranslationRoom')
  handleLeaveRoom(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: Socket
  ) {
    return this.leaveTranslationRoom(client, data.roomId);
  }

  @SubscribeMessage('suggestTranslation')
  handleSuggestion(
    @MessageBody() data: {
      roomId: string;
      translationKey: string;
      language: string;
      suggestion: string;
      context?: any;
    },
    @ConnectedSocket() client: Socket
  ) {
    const { roomId, translationKey, language, suggestion, context } = data;
    const userId = client.data.userId;
    
    // Broadcast suggestion to room
    this.server.to(roomId).emit('translationSuggestion', {
      userId,
      translationKey,
      language,
      suggestion,
      context,
      timestamp: new Date().toISOString(),
      votes: { up: 0, down: 0 }
    });
    
    return { success: true };
  }

  @SubscribeMessage('voteTranslation')
  handleVote(
    @MessageBody() data: {
      suggestionId: string;
      vote: 'up' | 'down';
    },
    @ConnectedSocket() client: Socket
  ) {
    const { suggestionId, vote } = data;
    
    // Broadcast vote to relevant room
    this.server.emit('voteUpdated', {
      suggestionId,
      userId: client.data.userId,
      vote,
      timestamp: new Date().toISOString()
    });
    
    return { success: true };
  }

  @SubscribeMessage('realTimeTranslation')
  handleRealTimeTranslation(
    @MessageBody() data: {
      text: string;
      targetLang: string;
      sourceLang?: string;
    },
    @ConnectedSocket() client: Socket
  ) {
    const { text, targetLang, sourceLang } = data;
    
    // Real-time translation with streaming response
    const streamId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Simulate streaming translation (in production, this would use your AI model)
    let translated = '';
    const words = text.split(' ');
    
    words.forEach((word, index) => {
      setTimeout(() => {
        // Simulate translation (replace with AI model)
        translated += this.simulateTranslate(word, targetLang) + ' ';
        
        client.emit('translationChunk', {
          streamId,
          chunk: this.simulateTranslate(word, targetLang),
          progress: ((index + 1) / words.length) * 100,
          isComplete: index === words.length - 1,
          finalTranslation: index === words.length - 1 ? translated.trim() : undefined
        });
      }, index * 100); // 100ms delay between words
    });
    
    return {
      success: true,
      streamId,
      estimatedTime: words.length * 100
    };
  }

  private leaveTranslationRoom(client: Socket, roomId: string) {
    const userId = client.data.userId;
    
    client.leave(roomId);
    
    // Remove user from room tracking
    if (this.translationRooms.has(roomId)) {
      this.translationRooms.get(roomId)!.delete(userId);
      
      // Clean up empty rooms
      if (this.translationRooms.get(roomId)!.size === 0) {
        this.translationRooms.delete(roomId);
      }
    }
    
    // Remove room from user tracking
    if (this.userRooms.has(userId)) {
      this.userRooms.get(userId)!.delete(roomId);
    }
    
    // Notify others
    client.to(roomId).emit('userLeft', {
      userId,
      timestamp: new Date().toISOString()
    });
    
    return { success: true };
  }

  private simulateTranslate(word: string, targetLang: string): string {
    // Simple mock translation
    const translations: Record<string, Record<string, string>> = {
      'hello': { 'de': 'hallo', 'fr': 'bonjour', 'es': 'hola' },
      'world': { 'de': 'welt', 'fr': 'monde', 'es': 'mundo' },
      // Add more words as needed
    };
    
    return translations[word.toLowerCase()]?.[targetLang] || word;
  }
}