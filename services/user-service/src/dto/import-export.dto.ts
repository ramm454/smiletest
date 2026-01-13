import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';

export enum ExportFormat {
  CSV = 'csv',
  JSON = 'json',
  XML = 'xml'
}

export class ExportUsersDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  userIds?: string[];
  
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fields?: string[];
  
  @IsOptional()
  @IsEnum(ExportFormat)
  format?: ExportFormat = ExportFormat.JSON;
  
  @IsOptional()
  @IsString()
  dateFrom?: string;
  
  @IsOptional()
  @IsString()
  dateTo?: string;
}

export class ImportUsersDto {
  @IsString()
  data: string; // Base64 encoded file or JSON string
  
  @IsEnum(ExportFormat)
  format: ExportFormat;
  
  @IsOptional()
  @IsBoolean()
  updateExisting?: boolean = false;
  
  @IsOptional()
  @IsBoolean()
  sendWelcomeEmails?: boolean = true;
}