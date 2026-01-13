import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  IsArray,
  IsEnum,
  Min,
  Max,
  IsBoolean,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRecurringBookingDto {
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
  firstOccurrence: string;

  @IsNumber()
  @Min(30)
  @Max(300)
  duration: number; // in minutes

  @IsEnum(['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'CUSTOM'])
  recurrenceType: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(52)
  repeatEvery?: number = 1;

  @IsOptional()
  @IsArray()
  daysOfWeek?: number[]; // 0-6 for Sunday-Saturday

  @IsOptional()
  @IsString()
  customRule?: string; // RRULE format

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  occurrenceCount?: number;

  @IsOptional()
  @IsArray()
  excludeDates?: string[];

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

  @IsOptional()
  @IsBoolean()
  skipFirstPayment?: boolean = false;
}

export class UpdateRecurringBookingDto {
  @IsOptional()
  @IsEnum(['ACTIVE', 'PAUSED', 'CANCELLED'])
  status?: string;

  @IsOptional()
  @IsDateString()
  pauseUntil?: string;

  @IsOptional()
  @IsArray()
  skipOccurrences?: string[];

  @IsOptional()
  @IsString()
  cancellationReason?: string;
}