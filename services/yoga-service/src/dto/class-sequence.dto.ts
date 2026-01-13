import { IsString, IsArray, IsOptional, IsNumber, IsBoolean, ValidateNested, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class SequencePoseDto {
  @ApiProperty()
  @IsString()
  poseId: string;

  @ApiProperty()
  @IsNumber()
  order: number;

  @ApiProperty()
  @IsNumber()
  duration: number; // seconds

  @ApiProperty()
  @IsString()
  @IsOptional()
  transitionInstructions?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  breathPattern?: string; // inhale/exhale pattern
}

export class CreateSequenceDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty({ enum: ['morning', 'evening', 'energizing', 'relaxing', 'strength', 'flexibility'] })
  @IsEnum(['morning', 'evening', 'energizing', 'relaxing', 'strength', 'flexibility'])
  type: string;

  @ApiProperty({ enum: ['beginner', 'intermediate', 'advanced'] })
  @IsEnum(['beginner', 'intermediate', 'advanced'])
  difficulty: string;

  @ApiProperty()
  @IsNumber()
  totalDuration: number; // minutes

  @ApiProperty({ type: [SequencePoseDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SequencePoseDto)
  poses: SequencePoseDto[];

  @ApiProperty()
  @IsString()
  @IsOptional()
  focusArea?: string; // e.g., 'hips', 'shoulders', 'core'

  @ApiProperty()
  @IsBoolean()
  @IsOptional()
  isTemplate?: boolean = false;
}

export class UpdateSequenceDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  totalDuration?: number;
}