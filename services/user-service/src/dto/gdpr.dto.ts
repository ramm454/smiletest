import { 
  IsArray, IsBoolean, IsDate, IsEmail, IsEnum, IsIP, IsISO8601, 
  IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested 
} from 'class-validator';
import { Type } from 'class-transformer';

export enum GdprRequestType {
  ACCESS = 'ACCESS',
  RECTIFICATION = 'RECTIFICATION',
  ERASURE = 'ERASURE',
  RESTRICTION = 'RESTRICTION',
  PORTABILITY = 'PORTABILITY',
  OBJECTION = 'OBJECTION',
  WITHDRAW_CONSENT = 'WITHDRAW_CONSENT'
}

export enum VerificationMethod {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  ID_DOCUMENT = 'ID_DOCUMENT',
  IN_PERSON = 'IN_PERSON'
}

export class DataSubjectRequestDto {
  @IsEnum(GdprRequestType)
  requestType: GdprRequestType;
  
  @IsOptional()
  @IsString()
  description?: string;
  
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requestedData?: string[]; // Specific fields for access/rectification
  
  @IsOptional()
  @IsString()
  justification?: string; // Required for objection requests
  
  @IsOptional()
  @IsEnum(VerificationMethod)
  verificationMethod?: VerificationMethod = VerificationMethod.EMAIL;
  
  @IsOptional()
  @IsString()
  idDocument?: string; // Base64 encoded for ID verification
}

export class DataPortabilityRequestDto {
  @IsEnum(ExportFormat)
  format: ExportFormat = ExportFormat.JSON;
  
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dataTypes?: string[] = ['profile', 'bookings', 'payments', 'preferences'];
  
  @IsOptional()
  @IsBoolean()
  includeMetadata?: boolean = true;
}

export class RectificationRequestDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DataFieldRectification)
  corrections: DataFieldRectification[];
  
  @IsOptional()
  @IsString()
  justification?: string;
}

export class DataFieldRectification {
  @IsString()
  field: string; // e.g., 'email', 'firstName', 'phone'
  
  @IsNotEmpty()
  currentValue: any;
  
  @IsNotEmpty()
  correctedValue: any;
  
  @IsOptional()
  @IsString()
  supportingDocument?: string; // Base64 for proof
}

export class ProcessingAgreementDto {
  @IsString()
  version: string;
  
  @IsArray()
  @IsString({ each: true })
  purposes: string[];
  
  @IsArray()
  @IsString({ each: true })
  dataCategories: string[];
  
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubProcessor)
  subProcessors: SubProcessor[];
  
  @IsBoolean()
  internationalTransfers: boolean;
  
  @IsOptional()
  @IsString()
  transferMechanism?: string;
  
  @IsOptional()
  @IsIP()
  ipAddress?: string;
  
  @IsOptional()
  @IsString()
  userAgent?: string;
}

export class SubProcessor {
  @IsString()
  name: string;
  
  @IsString()
  service: string; // e.g., 'Hosting', 'Analytics', 'Payment Processing'
  
  @IsString()
  country: string;
  
  @IsOptional()
  @IsString()
  dataProcessingAddendum?: string; // URL to DPA
}

export class DataBreachReportDto {
  @IsString()
  type: string;
  
  @IsString()
  description: string;
  
  @IsISO8601()
  discoveredAt: string;
  
  @IsOptional()
  @IsISO8601()
  occurredFrom?: string;
  
  @IsOptional()
  @IsISO8601()
  occurredTo?: string;
  
  @IsNumber()
  estimatedAffectedUsers: number;
  
  @IsArray()
  @IsString({ each: true })
  affectedDataTypes: string[];
  
  @IsString()
  riskLevel: 'low' | 'medium' | 'high';
  
  @IsArray()
  @IsString({ each: true })
  likelyConsequences: string[];
  
  @IsArray()
  @IsString({ each: true })
  containmentActions: string[];
}

export class CookiePreferencesDto {
  @IsBoolean()
  necessary: boolean = true; // Cannot be false
  
  @IsBoolean()
  preferences: boolean;
  
  @IsBoolean()
  analytics: boolean;
  
  @IsBoolean()
  marketing: boolean;
  
  @IsOptional()
  @IsString()
  consentString?: string; // IAB TCF string
  
  @IsOptional()
  @IsString()
  userAgent?: string;
  
  @IsOptional()
  @IsIP()
  ipAddress?: string;
  
  @IsOptional()
  @IsString()
  country?: string;
}

export class RetentionRuleDto {
  @IsString()
  dataType: string;
  
  @IsString()
  category: string;
  
  @IsString()
  legalBasis: string;
  
  @IsNumber()
  retentionPeriod: number; // In months
  
  @IsString()
  retentionTrigger: string;
  
  @IsBoolean()
  autoDelete: boolean = true;
  
  @IsOptional()
  @IsString()
  deletionProcedure?: string;
  
  @IsOptional()
  @IsBoolean()
  archiveBeforeDelete?: boolean = false;
  
  @IsOptional()
  @IsNumber()
  archivePeriod?: number;
}