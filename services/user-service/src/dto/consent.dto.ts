import { IsBoolean, IsIP, IsOptional, IsString } from 'class-validator';

export class ConsentDto {
  @IsString()
  consentType: string;
  
  @IsString()
  version: string;
  
  @IsBoolean()
  granted: boolean;
  
  @IsOptional()
  @IsString()
  ipAddress?: string;
  
  @IsOptional()
  @IsString()
  userAgent?: string;
}

export class ConsentHistoryDto {
  @IsString()
  consentType: string;
  
  @IsOptional()
  @IsString()
  userId?: string;
}