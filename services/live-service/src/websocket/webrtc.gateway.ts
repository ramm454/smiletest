import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';

@WebSocketGateway({
  namespace: '/live',
  cors: {
    origin: '*',
  },
})
@Injectable()
export class WebRTCGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WebRTCGateway.name);
  private readonly activeConnections = new Map<string, Socket>();
  private readonly roomParticipants = new Map<string, Set<string>>();

  async handleConnection(socket: Socket) {
    const sessionId = socket.handshake.query.sessionId as string;
    const userId = socket.handshake.query.userId as string;

    if (!sessionId || !userId) {
      socket.disconnect();
      return;
    }

    this.activeConnections.set(socket.id, socket);
    socket.join(sessionId);

    if (!this.roomParticipants.has(sessionId)) {
      this.roomParticipants.set(sessionId, new Set());
    }
    this.roomParticipants.get(sessionId).add(socket.id);

    this.logger.log(`User ${userId} connected to session ${sessionId}`);

    // Notify other participants
    socket.to(sessionId).emit('participant-joined', {
      userId,
      socketId: socket.id,
    });

    // Send existing participants to new user
    const participants = Array.from(this.roomParticipants.get(sessionId))
      .filter(id => id !== socket.id)
      .map(id => ({
        socketId: id,
        userId: this.activeConnections.get(id)?.handshake.query.userId,
      }));

    socket.emit('existing-participants', participants);
  }

  handleDisconnect(socket: Socket) {
    const sessionId = socket.handshake.query.sessionId as string;
    const userId = socket.handshake.query.userId as string;

    this.activeConnections.delete(socket.id);

    if (sessionId && this.roomParticipants.has(sessionId)) {
      this.roomParticipants.get(sessionId).delete(socket.id);
      
      if (this.roomParticipants.get(sessionId).size === 0) {
        this.roomParticipants.delete(sessionId);
      }
    }

    socket.to(sessionId).emit('participant-left', {
      userId,
      socketId: socket.id,
    });

    this.logger.log(`User ${userId} disconnected from session ${sessionId}`);
  }

  @SubscribeMessage('offer')
  handleOffer(@ConnectedSocket() socket: Socket, @MessageBody() data: any) {
    const { to, offer } = data;
    socket.to(to).emit('offer', {
      from: socket.id,
      offer,
    });
  }

  @SubscribeMessage('answer')
  handleAnswer(@ConnectedSocket() socket: Socket, @MessageBody() data: any) {
    const { to, answer } = data;
    socket.to(to).emit('answer', {
      from: socket.id,
      answer,
    });
  }

  @SubscribeMessage('ice-candidate')
  handleIceCandidate(@ConnectedSocket() socket: Socket, @MessageBody() data: any) {
    const { to, candidate } = data;
    socket.to(to).emit('ice-candidate', {
      from: socket.id,
      candidate,
    });
  }

  @SubscribeMessage('screen-share-start')
  handleScreenShareStart(@ConnectedSocket() socket: Socket, @MessageBody() data: any) {
    const { sessionId } = data;
    socket.to(sessionId).emit('screen-share-started', {
      userId: socket.handshake.query.userId,
      socketId: socket.id,
    });
  }

  @SubscribeMessage('screen-share-stop')
  handleScreenShareStop(@ConnectedSocket() socket: Socket, @MessageBody() data: any) {
    const { sessionId } = data;
    socket.to(sessionId).emit('screen-share-stopped', {
      userId: socket.handshake.query.userId,
    });
  }

  @SubscribeMessage('whiteboard-update')
  handleWhiteboardUpdate(@ConnectedSocket() socket: Socket, @MessageBody() data: any) {
    const { sessionId, drawingData } = data;
    socket.to(sessionId).emit('whiteboard-updated', {
      userId: socket.handshake.query.userId,
      drawingData,
    });
  }

  @SubscribeMessage('send-message')
  handleChatMessage(@ConnectedSocket() socket: Socket, @MessageBody() data: any) {
    const { sessionId, message } = data;
    socket.to(sessionId).emit('new-chat-message', {
      userId: socket.handshake.query.userId,
      message,
      timestamp: new Date().toISOString(),
    });
  }
}