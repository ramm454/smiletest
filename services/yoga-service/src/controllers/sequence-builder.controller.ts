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
import { SequenceBuilderService } from '../services/sequence-builder.service';
import { CreateSequenceDto, UpdateSequenceDto } from '../dto/class-sequence.dto';
import { AuthGuard } from '../guards/auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller('sequences')
@ApiTags('Sequence Builder')
export class SequenceBuilderController {
  constructor(private readonly sequenceBuilderService: SequenceBuilderService) {}

  @Get()
  @ApiOperation({ summary: 'Get all sequences' })
  async getSequences(@Query() filters: any) {
    return this.sequenceBuilderService.listSequences(filters);
  }

  @Get('templates')
  @ApiOperation({ summary: 'Get sequence templates' })
  async getTemplates(@Query() filters: any) {
    return this.sequenceBuilderService.getSequenceTemplates(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get sequence by ID' })
  async getSequence(@Param('id') id: string) {
    return this.sequenceBuilderService.getSequence(id);
  }

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('INSTRUCTOR', 'ADMIN')
  @ApiOperation({ summary: 'Create a new sequence' })
  async createSequence(
    @Body() createSequenceDto: CreateSequenceDto,
    @Headers('x-user-id') userId: string,
  ) {
    return this.sequenceBuilderService.createSequence(createSequenceDto, userId);
  }

  @Post(':id/generate-from-template')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('INSTRUCTOR', 'ADMIN')
  @ApiOperation({ summary: 'Generate sequence from template' })
  async generateFromTemplate(
    @Param('id') templateId: string,
    @Headers('x-user-id') userId: string,
    @Body() modifications: any,
  ) {
    return this.sequenceBuilderService.generateSequenceFromTemplate(templateId, userId, modifications);
  }

  @Put(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('INSTRUCTOR', 'ADMIN')
  @ApiOperation({ summary: 'Update a sequence' })
  async updateSequence(
    @Param('id') id: string,
    @Body() updateSequenceDto: UpdateSequenceDto,
    @Headers('x-user-id') userId: string,
  ) {
    return this.sequenceBuilderService.updateSequence(id, userId, updateSequenceDto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('INSTRUCTOR', 'ADMIN')
  @ApiOperation({ summary: 'Delete a sequence' })
  async deleteSequence(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string,
  ) {
    return this.sequenceBuilderService.deleteSequence(id, userId);
  }

  @Post(':id/rate')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Rate a sequence' })
  async rateSequence(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string,
    @Body() body: { rating: number; review?: string },
  ) {
    return this.sequenceBuilderService.rateSequence(id, userId, body.rating, body.review);
  }

  @Post(':id/use-in-class/:classId')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('INSTRUCTOR', 'ADMIN')
  @ApiOperation({ summary: 'Use sequence in a class' })
  async useInClass(
    @Param('id') sequenceId: string,
    @Param('classId') classId: string,
  ) {
    return this.sequenceBuilderService.useSequenceInClass(sequenceId, classId);
  }
}