import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  IsArray,
  IsEnum,
  Min,
  Max,
} from 'class-validator';

export class CreateBookingDto {
  @IsString()
  userId: string;

  @IsOptional()
  @IsString()
  classId?: string;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsDateString()
  startTime: string;

  @IsDateString()
  endTime: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  participants?: number = 1;

  @IsOptional()
  @IsArray()
  participantNames?: string[];

  @IsOptional()
  @IsArray()
  guestEmails?: string[];

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  specialRequests?: string;

  @IsOptional()
  @IsEnum(['WEB', 'APP', 'VOICE', 'ADMIN'])
  source?: string = 'WEB';
}