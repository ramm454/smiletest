import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Headers,
} from '@nestjs/common';
import { YogaService } from '../yoga.service';
import { AuthGuard } from '../guards/auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller('yoga')
@ApiTags('Yoga')
export class YogaController {
  constructor(private readonly yogaService: YogaService) {}

  @Get('health')
  @ApiOperation({ summary: 'Health check for yoga service' })
  async healthCheck() {
    return {
      status: 'healthy',
      service: 'yoga-service',
      timestamp: new Date().toISOString(),
      database: await this.yogaService.checkDatabase(),
    };
  }

  // Class Management endpoints
  @Get('classes')
  @ApiOperation({ summary: 'Get yoga classes' })
  async getClasses(@Query() filters: any) {
    return this.yogaService.listClasses(filters);
  }

  @Get('classes/:id')
  @ApiOperation({ summary: 'Get class by ID' })
  async getClass(@Param('id') id: string) {
    return this.yogaService.getClass(id);
  }

  @Post('classes')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('INSTRUCTOR', 'ADMIN')
  @ApiOperation({ summary: 'Create a new yoga class' })
  async createClass(
    @Body() createClassDto: any,
    @Headers('x-user-id') instructorId: string,
  ) {
    return this.yogaService.createClass(createClassDto, instructorId);
  }

  @Put('classes/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('INSTRUCTOR', 'ADMIN')
  @ApiOperation({ summary: 'Update a yoga class' })
  async updateClass(
    @Param('id') id: string,
    @Headers('x-user-id') instructorId: string,
    @Body() updateDto: any,
  ) {
    return this.yogaService.updateClass(id, instructorId, updateDto);
  }

  @Delete('classes/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('INSTRUCTOR', 'ADMIN')
  @ApiOperation({ summary: 'Cancel a yoga class' })
  async cancelClass(
    @Param('id') id: string,
    @Headers('x-user-id') instructorId: string,
    @Body() body: { reason?: string },
  ) {
    return this.yogaService.cancelClass(id, instructorId, body.reason);
  }

  // Instructor Management endpoints
  @Get('instructors')
  @ApiOperation({ summary: 'Get instructors' })
  async getInstructors(@Query() filters: any) {
    return this.yogaService.listInstructors(filters);
  }

  @Get('instructors/:id')
  @ApiOperation({ summary: 'Get instructor by ID' })
  async getInstructor(@Param('id') id: string) {
    return this.yogaService.getInstructor(id);
  }

  @Get('instructors/:id/analytics')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('INSTRUCTOR', 'ADMIN')
  @ApiOperation({ summary: 'Get instructor analytics' })
  async getInstructorAnalytics(
    @Param('id') id: string,
    @Query('timeframe') timeframe: string,
  ) {
    return this.yogaService.getInstructorAnalytics(id, timeframe);
  }

  // Waitlist Management
  @Post('classes/:id/waitlist')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Join class waitlist' })
  async joinWaitlist(
    @Param('id') classId: string,
    @Headers('x-user-id') userId: string,
  ) {
    return this.yogaService.addToWaitlist(classId, userId);
  }

  @Post('classes/:id/waitlist/promote')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('INSTRUCTOR', 'ADMIN')
  @ApiOperation({ summary: 'Promote from waitlist' })
  async promoteFromWaitlist(
    @Param('id') classId: string,
    @Body() body: { count?: number },
  ) {
    return this.yogaService.promoteFromWaitlist(classId, body.count);
  }
}