import { IsString, IsBoolean, IsOptional, IsEnum, IsNumber, IsArray } from 'class-validator';

export class ModerateUserDto {
  @IsString()
  sessionId: string;

  @IsString()
  targetUserId: string;

  @IsEnum(['mute', 'unmute', 'kick', 'ban', 'warn', 'promote'])
  action: string;

  @IsOptional()
  @IsNumber()
  duration?: number; // in minutes for temporary actions

  @IsOptional()
  @IsString()
  reason?: string;
}

export class ContentFilterDto {
  @IsString()
  sessionId: string;

  @IsBoolean()
  profanityFilter: boolean;

  @IsBoolean()
  linkFilter: boolean;

  @IsBoolean()
  spamFilter: boolean;

  @IsOptional()
  @IsArray()
  blockedWords?: string[];

  @IsOptional()
  @IsNumber()
  messageRateLimit?: number; // messages per minute
}

export class AiModerationConfigDto {
  @IsBoolean()
  enableToxicityDetection: boolean;

  @IsBoolean()
  enableSentimentAnalysis: boolean;

  @IsOptional()
  @IsNumber()
  toxicityThreshold?: number; // 0-1

  @IsOptional()
  @IsNumber()
  autoActionThreshold?: number; // 0-1
}