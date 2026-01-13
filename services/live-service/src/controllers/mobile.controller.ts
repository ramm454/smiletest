import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Headers,
  UseGuards,
  Query,
} from '@nestjs/common';
import { AuthGuard } from '../guards/auth.guard';
import { MobileService } from '../services/mobile.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller('mobile')
@ApiTags('Mobile')
export class MobileController {
  constructor(private readonly mobileService: MobileService) {}

  @Get('sessions/upcoming')
  @ApiOperation({ summary: 'Get upcoming sessions for mobile' })
  async getUpcomingSessions(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Headers('x-user-id') userId?: string,
  ) {
    return this.mobileService.getUpcomingSessions(page, limit, userId);
  }

  @Get('sessions/live')
  @ApiOperation({ summary: 'Get live sessions for mobile' })
  async getLiveSessions(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.mobileService.getLiveSessions(page, limit);
  }

  @Get('sessions/:id')
  @ApiOperation({ summary: 'Get session details for mobile' })
  async getSessionForMobile(
    @Param('id') id: string,
    @Headers('x-user-id') userId?: string,
  ) {
    return this.mobileService.getSessionForMobile(id, userId);
  }

  @Post('sessions/:id/join')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Join session from mobile' })
  async joinSessionMobile(
    @Param('id') id: string,
    @Body() joinData: any,
    @Headers('x-user-id') userId: string,
  ) {
    return this.mobileService.joinSessionMobile(id, userId, joinData);
  }

  @Post('notifications/token')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Register push notification token' })
  async registerPushToken(
    @Body() tokenData: { token: string; platform: 'ios' | 'android' },
    @Headers('x-user-id') userId: string,
  ) {
    return this.mobileService.registerPushToken(userId, tokenData);
  }

  @Get('offline/content')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get offline content' })
  async getOfflineContent(@Headers('x-user-id') userId: string) {
    return this.mobileService.getOfflineContent(userId);
  }

  @Post('sessions/:id/download')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Download session for offline viewing' })
  async downloadForOffline(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string,
  ) {
    return this.mobileService.downloadForOffline(id, userId);
  }
}