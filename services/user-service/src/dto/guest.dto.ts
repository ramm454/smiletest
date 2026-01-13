import { IsBoolean, IsEmail, IsOptional, IsString } from 'class-validator';

export class CreateGuestDto {
  @IsOptional()
  @IsString()
  sessionId?: string;
  
  @IsOptional()
  @IsEmail()
  email?: string;
  
  @IsOptional()
  @IsString()
  firstName?: string;
  
  @IsOptional()
  @IsString()
  lastName?: string;
  
  @IsOptional()
  @IsString()
  deviceId?: string;
  
  @IsOptional()
  @IsString()
  ipAddress?: string;
  
  @IsOptional()
  @IsString()
  userAgent?: string;
}

export class ConvertGuestDto {
  @IsString()
  sessionId: string;
  
  @IsEmail()
  email: string;
  
  @IsString()
  password: string;
  
  @IsOptional()
  @IsString()
  firstName?: string;
  
  @IsOptional()
  @IsString()
  lastName?: string;
  
  @IsOptional()
  @IsBoolean()
  keepCart?: boolean = true;
  
  @IsOptional()
  @IsBoolean()
  keepPreferences?: boolean = true;
}

export class GuestLoginDto {
  @IsString()
  sessionId: string;
  
  @IsOptional()
  @IsString()
  deviceId?: string;
}