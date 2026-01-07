import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  Query,
  UseGuards,
  Headers,
} from '@nestjs/common';
import { LiveService } from './live.service';
import { 
  CreateLiveSessionDto, 
  UpdateLiveSessionDto, 
  JoinSessionDto,
  CreatePollDto,
  SendMessageDto,
  UpdateParticipantDto 
} from './dto/live.dto';
import { AuthGuard } from './guards/auth.guard';

@Controller('live')
export class LiveController {
  constructor(private readonly liveService: LiveService) {}

  @Get('health')
  async healthCheck() {
    return {
      status: 'healthy',
      service: 'live-service',
      timestamp: new Date().toISOString(),
      database: await this.liveService.checkDatabase(),
    };
  }

  // Session Management
  @Post('sessions')
  @UseGuards(AuthGuard)
  async createSession(
    @Body() createLiveSessionDto: CreateLiveSessionDto,
    @Headers('x-user-id') userId: string,
  ) {
    return this.liveService.createSession(createLiveSessionDto, userId);
  }

  @Get('sessions/:id')
  async getSession(
    @Param('id') id: string,
    @Headers('x-user-id') userId?: string,
  ) {
    return this.liveService.getSession(id, userId);
  }

  @Get('sessions')
  async listSessions(@Query() query: any) {
    return this.liveService.listSessions(query);
  }

  @Put('sessions/:id')
  @UseGuards(AuthGuard)
  async updateSession(
    @Param('id') id: string,
    @Body() updateLiveSessionDto: UpdateLiveSessionDto,
    @Headers('x-user-id') userId: string,
  ) {
    return this.liveService.updateSession(id, userId, updateLiveSessionDto);
  }

  @Delete('sessions/:id')
  @UseGuards(AuthGuard)
  async deleteSession(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string,
  ) {
    return this.liveService.deleteSession(id, userId);
  }

  // Participant Management
  @Post('sessions/:id/join')
  async joinSession(
    @Param('id') id: string,
    @Body() joinSessionDto: JoinSessionDto,
    @Headers('x-user-id') userId: string,
  ) {
    joinSessionDto.sessionId = id;
    return this.liveService.joinSession(joinSessionDto, userId);
  }

  @Post('sessions/:id/leave')
  @UseGuards(AuthGuard)
  async leaveSession(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string,
  ) {
    return this.liveService.leaveSession(id, userId);
  }

  @Get('sessions/:id/participants')
  async getParticipants(
    @Param('id') id: string,
    @Query() query: any,
  ) {
    return this.liveService.getParticipants(id, query);
  }

  @Put('sessions/:sessionId/participants/:participantId')
  @UseGuards(AuthGuard)
  async updateParticipant(
    @Param('sessionId') sessionId: string,
    @Param('participantId') participantId: string,
    @Body() updateDto: UpdateParticipantDto,
    @Headers('x-user-id') userId: string,
  ) {
    return this.liveService.updateParticipant(sessionId, participantId, updateDto, userId);
  }

  // Chat Management
  @Post('sessions/:id/messages')
  @UseGuards(AuthGuard)
  async sendMessage(
    @Param('id') id: string,
    @Body() messageDto: SendMessageDto,
    @Headers('x-user-id') userId: string,
  ) {
    return this.liveService.sendMessage(id, userId, messageDto);
  }

  @Get('sessions/:id/messages')
  async getMessages(
    @Param('id') id: string,
    @Query() query: any,
  ) {
    return this.liveService.getMessages(id, query);
  }

  // Poll Management
  @Post('sessions/:id/polls')
  @UseGuards(AuthGuard)
  async createPoll(
    @Param('id') id: string,
    @Body() pollDto: CreatePollDto,
    @Headers('x-user-id') userId: string,
  ) {
    return this.liveService.createPoll(id, userId, pollDto);
  }

  @Post('polls/:id/vote')
  @UseGuards(AuthGuard)
  async voteOnPoll(
    @Param('id') id: string,
    @Body() body: { selectedOptions: string[] },
    @Headers('x-user-id') userId: string,
  ) {
    return this.liveService.voteOnPoll(id, userId, body.selectedOptions);
  }

  @Get('polls/:id/results')
  async getPollResults(@Param('id') id: string) {
    return this.liveService.getPollResults(id);
  }

  // Recording Management
  @Post('sessions/:id/recordings/start')
  @UseGuards(AuthGuard)
  async startRecording(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string,
  ) {
    return this.liveService.startRecording(id, userId);
  }

  @Post('sessions/:id/recordings/stop')
  @UseGuards(AuthGuard)
  async stopRecording(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string,
  ) {
    return this.liveService.stopRecording(id, userId);
  }

  @Get('sessions/:id/recordings')
  async getRecordings(@Param('id') id: string) {
    return this.liveService.getRecordings(id);
  }

  // Waitlist Management
  @Post('sessions/:id/waitlist')
  @UseGuards(AuthGuard)
  async addToWaitlist(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string,
  ) {
    return this.liveService.addToWaitlist(id, userId);
  }

  @Post('sessions/:id/waitlist/promote')
  @UseGuards(AuthGuard)
  async promoteFromWaitlist(
    @Param('id') id: string,
    @Body() body: { count?: number },
  ) {
    return this.liveService.promoteFromWaitlist(id, body.count);
  }

  // Analytics
  @Get('sessions/:id/analytics')
  @UseGuards(AuthGuard)
  async getSessionAnalytics(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string,
  ) {
    return this.liveService.getSessionAnalytics(id, userId);
  }

  // Real-time endpoints (WebSocket)
  @Get('sessions/:id/stream')
  async getStreamInfo(@Param('id') id: string) {
    const session = await this.liveService.getSession(id);
    return {
      streamUrl: session.streamUrl,
      chatEnabled: session.chatEnabled,
      qaEnabled: session.qaEnabled,
    };
  }

  // Search endpoints
  @Get('search')
  async searchSessions(@Query() query: any) {
    return this.liveService.listSessions({
      ...query,
      search: query.q,
    });
  }

  // Calendar integration
  @Get('sessions/:id/calendar')
  async getCalendarEvent(@Param('id') id: string) {
    const session = await this.liveService.getSession(id);
    return {
      title: session.title,
      description: session.description,
      startTime: session.startTime,
      endTime: session.endTime,
      location: session.streamUrl,
      timezone: session.timezone,
    };
  }
}