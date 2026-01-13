import { IsString, IsNumber, IsOptional, IsDateString, IsArray, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TrackPracticeDto {
  @ApiProperty()
  @IsString()
  userId: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  classId?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  sequenceId?: string;

  @ApiProperty()
  @IsNumber()
  duration: number; // minutes

  @ApiProperty({ enum: ['yoga', 'meditation', 'pranayama'] })
  @IsEnum(['yoga', 'meditation', 'pranayama'])
  practiceType: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  focusArea?: string;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  caloriesBurned?: number;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  heartRateAvg?: number;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  posesPracticed?: string[];

  @ApiProperty()
  @IsString()
  @IsOptional()
  notes?: string;
}

export class StudentGoalDto {
  @ApiProperty()
  @IsString()
  userId: string;

  @ApiProperty()
  @IsString()
  goalType: string; // 'flexibility', 'strength', 'weight_loss', 'stress_reduction'

  @ApiProperty()
  @IsString()
  target: string; // e.g., 'master crow pose', 'practice 5x/week'

  @ApiProperty()
  @IsDateString()
  targetDate: string;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  currentProgress?: number = 0;
}