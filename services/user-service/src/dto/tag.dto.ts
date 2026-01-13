import { IsArray, IsBoolean, IsHexColor, IsOptional, IsString } from 'class-validator';

export class CreateTagDto {
  @IsString()
  name: string;
  
  @IsOptional()
  @IsString()
  description?: string;
  
  @IsOptional()
  @IsHexColor()
  color?: string;
}

export class AssignTagsDto {
  @IsArray()
  @IsString({ each: true })
  tagIds: string[];
}

export class UserFilterDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
  
  @IsOptional()
  @IsString()
  segment?: 'new' | 'active' | 'inactive' | 'premium' | 'trial';
  
  @IsOptional()
  @IsString()
  dateFrom?: string;
  
  @IsOptional()
  @IsString()
  dateTo?: string;
}