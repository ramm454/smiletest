import { IsOptional, IsString, IsUrl } from 'class-validator';

export class LinkAccountDto {
  @IsString()
  provider: 'google' | 'facebook' | 'apple' | 'github';
  
  @IsString()
  accessToken: string;
  
  @IsOptional()
  @IsString()
  idToken?: string;
}

export class UnlinkAccountDto {
  @IsString()
  provider: string;
}