import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsArray,
  IsDateString,
  Min,
  Max,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreateYogaClassDto {
  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty({ enum: ['vinyasa', 'hatha', 'yin', 'hot', 'restorative', 'ashtanga'] })
  @IsEnum(['vinyasa', 'hatha', 'yin', 'hot', 'restorative', 'ashtanga'])
  type: string;

  @ApiProperty({ enum: ['beginner', 'intermediate', 'advanced'] })
  @IsEnum(['beginner', 'intermediate', 'advanced'])
  difficulty: string;

  @ApiProperty()
  @IsNumber()
  @Min(30)
  @Max(180)
  duration: number; // minutes

  @ApiProperty()
  @IsNumber()
  @Min(1)
  @Max(100)
  capacity: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty()
  @IsDateString()
  startTime: string;

  @ApiProperty()
  @IsDateString()
  endTime: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  room?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiProperty({ type: [String], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  equipmentNeeded?: string[];

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  recurrenceRule?: string;
}

export class UpdateYogaClassDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  @Min(0)
  price?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  room?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  status?: string;
}

export class CreateInstructorDto {
  @ApiProperty()
  @IsString()
  bio: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  specialties: string[];

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(50)
  experienceYears: number;

  @ApiProperty({ type: [String], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  certifications?: string[];

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  availabilitySchedule?: string; // JSON string or specific format
}

export class UpdateInstructorDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  bio?: string;

  @ApiProperty({ type: [String], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  specialties?: string[];

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  availabilitySchedule?: string;
}

export class ClassFilterDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  difficulty?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  instructorId?: string;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  date?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiProperty({ required: false, default: 1 })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiProperty({ required: false, default: 20 })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  minPrice?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  maxPrice?: number;

  @ApiProperty({ required: false, default: 'startTime' })
  @IsString()
  @IsOptional()
  sortBy?: string = 'startTime';

  @ApiProperty({ required: false, default: 'asc' })
  @IsString()
  @IsOptional()
  sortOrder?: string = 'asc';
}