import { IsString, IsOptional, IsBoolean, IsNumber, IsArray, IsObject } from 'class-validator';

export class CreateSessionTemplateDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  type: string;

  @IsNumber()
  duration: number;

  @IsNumber()
  maxParticipants: number;

  @IsOptional()
  @IsBoolean()
  waitlistEnabled?: boolean = true;

  @IsOptional()
  @IsBoolean()
  chatEnabled?: boolean = true;

  @IsOptional()
  @IsBoolean()
  pollsEnabled?: boolean = false;

  @IsOptional()
  @IsBoolean()
  recordingEnabled?: boolean = true;

  @IsOptional()
  @IsBoolean()
  breakoutRoomsEnabled?: boolean = false;

  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;

  @IsOptional()
  @IsArray()
  tags?: string[];
}

export class ApplyTemplateDto {
  @IsString()
  templateId: string;

  @IsString()
  instructorId: string;

  @IsString()
  startTime: string;
}