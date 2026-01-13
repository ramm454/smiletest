// src/modules/realtime/language-switcher.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WebSocketGateway, WebSocketServer, SubscribeMessage } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@Injectable()
@WebSocketGateway({
  namespace: 'language',
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
  }
})
export class LanguageSwitcherService {
  @WebSocketServer()
  server: Server;
  
  private readonly logger = new Logger(LanguageSwitcherService.name);
  private userConnections = new Map<string, Socket[]>(); // userId -> sockets
  private languagePreferences = new Map<string, string>(); // userId -> language
  
  constructor(private eventEmitter: EventEmitter2) {
    // Listen for language change events from other services
    this.eventEmitter.on('user.language.changed', (data: any) => {
      this.broadcastLanguageChange(data.userId, data.newLanguage);
    });
  }
  
  handleConnection(client: Socket) {
    const userId = client.handshake.query.userId as string;
    const language = client.handshake.query.language as string;
    
    if (!userId) {
      client.disconnect();
      return;
    }
    
    // Store connection
    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, []);
    }
    this.userConnections.get(userId)!.push(client);
    
    // Store language preference
    if (language) {
      this.languagePreferences.set(userId, language);
    }
    
    client.data.userId = userId;
    
    this.logger.log(`User ${userId} connected to language switcher`);
  }
  
  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    
    if (userId && this.userConnections.has(userId)) {
      const connections = this.userConnections.get(userId)!;
      const index = connections.indexOf(client);
      
      if (index > -1) {
        connections.splice(index, 1);
      }
      
      if (connections.length === 0) {
        this.userConnections.delete(userId);
        this.languagePreferences.delete(userId);
      }
    }
    
    this.logger.log(`User ${userId} disconnected from language switcher`);
  }
  
  @SubscribeMessage('changeLanguage')
  handleLanguageChange(
    client: Socket,
    data: { language: string; broadcast?: boolean }
  ) {
    const userId = client.data.userId;
    
    if (!userId) {
      return { success: false, error: 'User not authenticated' };
    }
    
    const oldLanguage = this.languagePreferences.get(userId);
    const newLanguage = data.language;
    
    // Update preference
    this.languagePreferences.set(userId, newLanguage);
    
    // Notify user's own connections
    this.notifyUserLanguageChange(userId, newLanguage);
    
    // Broadcast to other users if requested
    if (data.broadcast) {
      this.broadcastLanguageChange(userId, newLanguage);
    }
    
    // Emit event for other services
    this.eventEmitter.emit('language.changed', {
      userId,
      oldLanguage,
      newLanguage,
      timestamp: new Date().toISOString()
    });
    
    this.logger.log(`User ${userId} changed language from ${oldLanguage} to ${newLanguage}`);
    
    return {
      success: true,
      oldLanguage,
      newLanguage,
      timestamp: new Date().toISOString()
    };
  }
  
  @SubscribeMessage('getCurrentLanguage')
  handleGetCurrentLanguage(client: Socket) {
    const userId = client.data.userId;
    
    if (!userId) {
      return { success: false, error: 'User not authenticated' };
    }
    
    const language = this.languagePreferences.get(userId) || 'en';
    
    return {
      success: true,
      language,
      timestamp: new Date().toISOString()
    };
  }
  
  @SubscribeMessage('subscribeToLanguageChanges')
  handleSubscribe(client: Socket, data: { userIds: string[] }) {
    const subscriberId = client.data.userId;
    
    if (!subscriberId) {
      return { success: false, error: 'User not authenticated' };
    }
    
    // Subscribe to language changes for specified users
    data.userIds.forEach(userId => {
      client.join(`language-changes:${userId}`);
    });
    
    return {
      success: true,
      subscribedTo: data.userIds,
      timestamp: new Date().toISOString()
    };
  }
  
  async broadcastLanguageChange(userId: string, newLanguage: string): Promise<void> {
    // Notify user's own connections
    this.notifyUserLanguageChange(userId, newLanguage);
    
    // Notify subscribers
    this.server.to(`language-changes:${userId}`).emit('userLanguageChanged', {
      userId,
      newLanguage,
      timestamp: new Date().toISOString()
    });
  }
  
  private notifyUserLanguageChange(userId: string, newLanguage: string): void {
    const connections = this.userConnections.get(userId) || [];
    
    connections.forEach(connection => {
      connection.emit('languageChanged', {
        language: newLanguage,
        timestamp: new Date().toISOString()
      });
    });
  }
  
  async getUserLanguage(userId: string): Promise<string | null> {
    return this.languagePreferences.get(userId) || null;
  }
  
  async getOnlineUsersByLanguage(language: string): Promise<string[]> {
    const users: string[] = [];
    
    for (const [userId, userLanguage] of this.languagePreferences.entries()) {
      if (userLanguage === language && this.userConnections.has(userId)) {
        users.push(userId);
      }
    }
    
    return users;
  }
  
  async getLanguageDistribution(): Promise<Record<string, number>> {
    const distribution: Record<string, number> = {};
    
    for (const language of this.languagePreferences.values()) {
      distribution[language] = (distribution[language] || 0) + 1;
    }
    
    return distribution;
  }
  
  async forceLanguageUpdate(
    userId: string,
    language: string,
    reason: string
  ): Promise<boolean> {
    const connections = this.userConnections.get(userId);
    
    if (!connections || connections.length === 0) {
      return false;
    }
    
    // Send force update to all user connections
    connections.forEach(connection => {
      connection.emit('forceLanguageUpdate', {
        language,
        reason,
        timestamp: new Date().toISOString(),
        enforcedBy: 'system'
      });
    });
    
    // Update preference
    this.languagePreferences.set(userId, language);
    
    this.logger.log(`Forced language update for user ${userId} to ${language}, reason: ${reason}`);
    
    return true;
  }
}