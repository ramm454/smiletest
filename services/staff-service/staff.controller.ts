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
import { StaffService } from '../services/staff.service';
import {
  CreateStaffDto,
  UpdateStaffDto,
  StaffFilterDto,
  UpdateStaffStatusDto,
} from '../dto/staff.dto';
import { AuthGuard } from '../guards/auth.guard';

@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get('health')
  async healthCheck() {
    return {
      status: 'healthy',
      service: 'staff-service',
      timestamp: new Date().toISOString(),
      database: await this.staffService.checkDatabase(),
    };
  }

  @Post()
  @UseGuards(AuthGuard)
  async createStaff(
    @Body() createStaffDto: CreateStaffDto,
    @Headers('x-user-id') createdById: string,
  ) {
    return this.staffService.createStaff(createStaffDto, createdById);
  }

  @Get()
  @UseGuards(AuthGuard)
  async getAllStaff(@Query() filters: StaffFilterDto) {
    return this.staffService.getAllStaff(filters);
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  async getStaffById(@Param('id') id: string) {
    return this.staffService.getStaffById(id);
  }

  @Get('user/:userId')
  @UseGuards(AuthGuard)
  async getStaffByUserId(@Param('userId') userId: string) {
    return this.staffService.getStaffByUserId(userId);
  }

  @Put(':id')
  @UseGuards(AuthGuard)
  async updateStaff(
    @Param('id') id: string,
    @Body() updateStaffDto: UpdateStaffDto,
    @Headers('x-user-id') updatedById: string,
  ) {
    return this.staffService.updateStaff(id, updateStaffDto, updatedById);
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  async deleteStaff(
    @Param('id') id: string,
    @Headers('x-user-id') deletedById: string,
  ) {
    return this.staffService.deleteStaff(id, deletedById);
  }

  @Put(':id/status')
  @UseGuards(AuthGuard)
  async updateStaffStatus(
    @Param('id') id: string,
    @Body() statusDto: UpdateStaffStatusDto,
    @Headers('x-user-id') updatedById: string,
  ) {
    return this.staffService.updateStaffStatus(id, statusDto.status, updatedById);
  }

  @Get(':id/performance')
  @UseGuards(AuthGuard)
  async getStaffPerformance(@Param('id') id: string) {
    return this.staffService.getStaffPerformance(id);
  }

  @Post(':id/reviews')
  @UseGuards(AuthGuard)
  async addPerformanceReview(
    @Param('id') id: string,
    @Body() reviewData: any,
    @Headers('x-user-id') reviewerId: string,
  ) {
    return this.staffService.addPerformanceReview(id, reviewData, reviewerId);
  }

  @Get('department/:department')
  @UseGuards(AuthGuard)
  async getStaffByDepartment(@Param('department') department: string) {
    return this.staffService.getStaffByDepartment(department);
  }

  @Get('stats/summary')
  @UseGuards(AuthGuard)
  async getStaffStats() {
    return this.staffService.getStaffStats();
  }
}