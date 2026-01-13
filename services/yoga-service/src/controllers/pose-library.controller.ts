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
import { PoseLibraryService } from '../services/pose-library.service';
import { CreatePoseDto, UpdatePoseDto, PoseFilterDto } from '../dto/pose-library.dto';
import { AuthGuard } from '../guards/auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller('poses')
@ApiTags('Pose Library')
export class PoseLibraryController {
  constructor(private readonly poseLibraryService: PoseLibraryService) {}

  @Get()
  @ApiOperation({ summary: 'Get all yoga poses' })
  async getPoses(@Query() filters: PoseFilterDto) {
    return this.poseLibraryService.listPoses(filters);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get pose categories' })
  async getCategories() {
    return this.poseLibraryService.getPoseCategories();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get pose by ID' })
  async getPose(@Param('id') id: string) {
    return this.poseLibraryService.getPose(id);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get pose statistics' })
  async getPoseStats(@Param('id') id: string) {
    return this.poseLibraryService.getPoseStats(id);
  }

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('INSTRUCTOR', 'ADMIN')
  @ApiOperation({ summary: 'Create a new yoga pose' })
  async createPose(
    @Body() createPoseDto: CreatePoseDto,
    @Headers('x-user-id') userId: string,
  ) {
    return this.poseLibraryService.createPose(createPoseDto, userId);
  }

  @Put(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('INSTRUCTOR', 'ADMIN')
  @ApiOperation({ summary: 'Update a yoga pose' })
  async updatePose(
    @Param('id') id: string,
    @Body() updatePoseDto: UpdatePoseDto,
  ) {
    return this.poseLibraryService.updatePose(id, updatePoseDto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('INSTRUCTOR', 'ADMIN')
  @ApiOperation({ summary: 'Delete a yoga pose' })
  async deletePose(@Param('id') id: string) {
    return this.poseLibraryService.deletePose(id);
  }
}