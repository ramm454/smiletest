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
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class GroupMemberDto {
  @IsString()
  email: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean = false;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;
}

export class CreateGroupBookingDto {
  @IsString()
  userId: string;

  @IsOptional()
  @IsString()
  classId?: string;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsDateString()
  startTime: string;

  @IsDateString()
  endTime: string;

  @IsOptional()
  @IsString()
  timezone?: string = 'UTC';

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GroupMemberDto)
  members: GroupMemberDto[];

  @IsOptional()
  @IsString()
  groupName?: string;

  @IsOptional()
  @IsEnum(['FIXED', 'PER_PERSON', 'TIERED'])
  pricingType?: string = 'PER_PERSON';

  @IsOptional()
  @IsNumber()
  @Min(0)
  groupPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(2)
  minParticipants?: number = 2;

  @IsOptional()
  @IsNumber()
  @Min(2)
  maxParticipants?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercentage?: number = 0;

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
  requireAllPayment?: boolean = false;
}

export class UpdateGroupBookingDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GroupMemberDto)
  members?: GroupMemberDto[];

  @IsOptional()
  @IsString()
  groupName?: string;

  @IsOptional()
  @IsEnum(['CONFIRMED', 'PENDING', 'CANCELLED', 'PARTIAL'])
  status?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class AddGroupMemberDto {
  @IsString()
  email: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;
}