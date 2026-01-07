import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  IsArray,
  IsEnum,
  IsBoolean,
  IsObject,
  Min,
  Max,
} from 'class-validator';

// Session DTOs
export class CreateLiveSessionDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  type: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsDateString()
  startTime: string;

  @IsOptional()
  @IsDateString()
  endTime?: string;

  @IsOptional()
  @IsNumber()
  duration?: number = 60;

  @IsOptional()
  @IsString()
  timezone?: string = 'UTC';

  @IsOptional()
  @IsString()
  recurrenceRule?: string;

  @IsOptional()
  @IsObject()
  recurrenceExceptions?: any;

  @IsNumber()
  @Min(1)
  maxParticipants: number;

  @IsOptional()
  @IsBoolean()
  waitlistEnabled?: boolean = true;

  @IsOptional()
  @IsNumber()
  maxWaitlist?: number = 10;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsString()
  currency?: string = 'USD';

  @IsOptional()
  @IsEnum(['VIDEO', 'AUDIO', 'SCREENSHARE', 'HYBRID'])
  streamType?: string = 'VIDEO';

  @IsOptional()
  @IsString()
  streamPlatform?: string;

  @IsOptional()
  @IsEnum(['PUBLIC', 'PRIVATE', 'INVITE_ONLY', 'PASSWORD_PROTECTED'])
  accessType?: string = 'PUBLIC';

  @IsOptional()
  @IsString()
  accessCode?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean = false;

  @IsOptional()
  @IsEnum(['DRAFT', 'SCHEDULED', 'LIVE'])
  status?: string = 'SCHEDULED';

  @IsOptional()
  @IsBoolean()
  chatEnabled?: boolean = true;

  @IsOptional()
  @IsBoolean()
  qaEnabled?: boolean = true;

  @IsOptional()
  @IsBoolean()
  pollsEnabled?: boolean = false;

  @IsOptional()
  @IsBoolean()
  recordingEnabled?: boolean = true;

  @IsOptional()
  @IsBoolean()
  breakoutRooms?: boolean = false;

  @IsOptional()
  @IsArray()
  tags?: string[];

  @IsOptional()
  @IsString()
  thumbnail?: string;

  @IsOptional()
  @IsString()
  agenda?: string;

  @IsOptional()
  @IsObject()
  materials?: any;
}

export class UpdateLiveSessionDto extends CreateLiveSessionDto {
  @IsOptional()
  @IsEnum(['DRAFT', 'SCHEDULED', 'LIVE', 'ENDED', 'CANCELLED'])
  status?: string;
}

export class JoinSessionDto {
  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsString()
  accessCode?: string;

  @IsOptional()
  @IsString()
  deviceType?: string;

  @IsOptional()
  @IsString()
  browser?: string;
}

// Participant DTOs
export class UpdateParticipantDto {
  @IsOptional()
  @IsEnum(['HOST', 'CO_HOST', 'PANELIST', 'ATTENDEE', 'MODERATOR'])
  role?: string;

  @IsOptional()
  @IsEnum(['REGISTERED', 'JOINED', 'LEFT', 'REMOVED', 'BANNED'])
  status?: string;

  @IsOptional()
  @IsBoolean()
  videoEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  audioEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  handRaised?: boolean;

  @IsOptional()
  @IsObject()
  permissions?: any;
}

// Chat DTOs
export class SendMessageDto {
  @IsString()
  message: string;

  @IsOptional()
  @IsEnum(['TEXT', 'IMAGE', 'FILE', 'POLL', 'SYSTEM'])
  messageType?: string = 'TEXT';

  @IsOptional()
  @IsObject()
  metadata?: any;

  @IsOptional()
  @IsString()
  parentId?: string;
}

// Poll DTOs
export class CreatePollDto {
  @IsString()
  question: string;

  @IsArray()
  options: any[]; // Array of {id: string, text: string}

  @IsOptional()
  @IsBoolean()
  isMultipleChoice?: boolean = false;

  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean = true;
}

// Analytics DTOs
export class AnalyticsFilterDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  metric?: string;
}