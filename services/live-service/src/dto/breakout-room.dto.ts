import { IsString, IsArray, IsOptional, IsBoolean, IsNumber } from 'class-validator';

export class CreateBreakoutRoomDto {
  @IsString()
  sessionId: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  maxParticipants: number;

  @IsOptional()
  @IsArray()
  participantIds?: string[];

  @IsOptional()
  @IsString()
  hostId?: string;
}

export class AssignParticipantDto {
  @IsString()
  roomId: string;

  @IsString()
  participantId: string;
}

export class BreakoutRoomConfigDto {
  @IsOptional()
  @IsBoolean()
  allowReturn?: boolean = true;

  @IsOptional()
  @IsNumber()
  duration?: number;

  @IsOptional()
  @IsString()
  activity?: string;
}