import { IsString, IsNumber, IsOptional, IsArray } from 'class-validator';

export class EditRecordingDto {
  @IsString()
  recordingId: string;

  @IsOptional()
  @IsNumber()
  startTrim?: number;

  @IsOptional()
  @IsNumber()
  endTrim?: number;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  chapters?: Array<{
    title: string;
    timestamp: number;
  }>;

  @IsOptional()
  @IsBoolean()
  addWatermark?: boolean = false;

  @IsOptional()
  @IsString()
  watermarkText?: string;
}

export class GenerateThumbnailDto {
  @IsString()
  recordingId: string;

  @IsNumber()
  timestamp: number;
}

export class RecordingMetadataDto {
  @IsOptional()
  @IsArray()
  tags?: string[];

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsBoolean()
  downloadable?: boolean;
}