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
import { CertificationService } from '../services/certification.service';
import { CreateCertificationDto, EnrollInCertificationDto, UpdateCertificationProgressDto } from '../dto/certification.dto';
import { AuthGuard } from '../guards/auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller('certifications')
@ApiTags('Certifications')
export class CertificationController {
  constructor(private readonly certificationService: CertificationService) {}

  @Get()
  @ApiOperation({ summary: 'Get all certifications' })
  async getCertifications(@Query() filters: any) {
    return this.certificationService.listCertifications(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get certification by ID' })
  async getCertification(@Param('id') id: string) {
    return this.certificationService.getCertification(id);
  }

  @Get(':id/stats')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('INSTRUCTOR', 'ADMIN')
  @ApiOperation({ summary: 'Get certification statistics' })
  async getCertificationStats(@Param('id') id: string) {
    return this.certificationService.getCertificationStats(id);
  }

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('INSTRUCTOR', 'ADMIN')
  @ApiOperation({ summary: 'Create a new certification' })
  async createCertification(
    @Body() createCertificationDto: CreateCertificationDto,
    @Headers('x-user-id') userId: string,
  ) {
    return this.certificationService.createCertification(createCertificationDto, userId);
  }

  @Post('enroll')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Enroll in a certification' })
  async enroll(
    @Body() enrollDto: EnrollInCertificationDto,
    @Headers('x-user-id') userId: string,
  ) {
    return this.certificationService.enrollInCertification({
      ...enrollDto,
      userId,
    });
  }

  @Get('my/enrollments')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get my enrollments' })
  async getMyEnrollments(@Headers('x-user-id') userId: string) {
    return this.certificationService.getUserEnrollments(userId);
  }

  @Put('progress')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('INSTRUCTOR', 'ADMIN')
  @ApiOperation({ summary: 'Update certification progress' })
  async updateProgress(@Body() updateDto: UpdateCertificationProgressDto) {
    return this.certificationService.updateEnrollmentProgress(updateDto);
  }

  @Post(':enrollmentId/certificate')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Generate certificate' })
  async generateCertificate(
    @Param('enrollmentId') enrollmentId: string,
    @Headers('x-user-id') userId: string,
  ) {
    return this.certificationService.generateCertificate(enrollmentId);
  }
}