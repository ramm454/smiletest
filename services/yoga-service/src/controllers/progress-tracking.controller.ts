import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Headers,
} from '@nestjs/common';
import { ProgressTrackingService } from '../services/progress-tracking.service';
import { TrackPracticeDto, StudentGoalDto } from '../dto/progress-tracking.dto';
import { AuthGuard } from '../guards/auth.guard';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller('progress')
@ApiTags('Progress Tracking')
export class ProgressTrackingController {
  constructor(private readonly progressTrackingService: ProgressTrackingService) {}

  @Post('track')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Track a practice session' })
  async trackPractice(
    @Body() trackPracticeDto: TrackPracticeDto,
    @Headers('x-user-id') userId: string,
  ) {
    return this.progressTrackingService.trackPractice({
      ...trackPracticeDto,
      userId,
    });
  }

  @Get('stats')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get progress statistics' })
  async getStats(
    @Headers('x-user-id') userId: string,
    @Query('timeframe') timeframe: string,
  ) {
    return this.progressTrackingService.getUserProgressStats(userId, timeframe);
  }

  @Get('calendar')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get practice calendar' })
  async getCalendar(
    @Headers('x-user-id') userId: string,
    @Query('year') year: number,
    @Query('month') month: number,
  ) {
    return this.progressTrackingService.getPracticeCalendar(userId, year, month);
  }

  @Get('achievements')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get achievements' })
  async getAchievements(@Headers('x-user-id') userId: string) {
    return this.progressTrackingService.getAchievements(userId);
  }

  @Get('recommendations')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get personalized recommendations' })
  async getRecommendations(@Headers('x-user-id') userId: string) {
    return this.progressTrackingService.getRecommendations(userId);
  }

  @Get('pose/:poseId')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get pose progress' })
  async getPoseProgress(
    @Param('poseId') poseId: string,
    @Headers('x-user-id') userId: string,
  ) {
    return this.progressTrackingService.getPoseProgress(userId, poseId);
  }

  @Post('goals')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Create a new goal' })
  async createGoal(
    @Body() goalDto: StudentGoalDto,
    @Headers('x-user-id') userId: string,
  ) {
    return this.progressTrackingService.createGoal({
      ...goalDto,
      userId,
    });
  }

  @Get('goals')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get my goals' })
  async getGoals(@Headers('x-user-id') userId: string) {
    return this.progressTrackingService.getUserGoals(userId);
  }

  @Put('goals/:id/progress')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Update goal progress' })
  async updateGoalProgress(
    @Param('id') goalId: string,
    @Headers('x-user-id') userId: string,
    @Body() body: { progress: number },
  ) {
    return this.progressTrackingService.updateGoalProgress(goalId, body.progress, userId);
  }
}