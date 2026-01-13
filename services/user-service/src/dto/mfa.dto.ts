import { IsBoolean, IsEmail, IsOptional, IsString } from 'class-validator';

export class SetupMFADto {
  @IsString()
  method: 'email' | 'sms' | 'app';
  
  @IsOptional()
  @IsString()
  phoneNumber?: string;
  
  @IsOptional()
  @IsEmail()
  recoveryEmail?: string;
}

export class VerifyMFADto {
  @IsString()
  method: 'email' | 'sms' | 'app' | 'backup';
  
  @IsString()
  code: string;
  
  @IsOptional()
  @IsString()
  deviceName?: string;
}

export class EnableMFADto {
  @IsBoolean()
  enable: boolean;
  
  @IsString()
  method: 'email' | 'sms' | 'app';
  
  @IsString()
  verificationCode: string;
}

export class GenerateBackupCodesDto {
  @IsString()
  password: string;
}