import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  IsEnum,
  IsBoolean,
  IsArray,
  Min,
  Max,
  IsPositive,
} from 'class-validator';

export class CreatePayrollDto {
  @IsString()
  staffId: string;

  @IsDateString()
  periodStart: string;

  @IsDateString()
  periodEnd: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  baseSalary?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  overtimePay?: number = 0;

  @IsOptional()
  @IsNumber()
  @Min(0)
  bonus?: number = 0;

  @IsOptional()
  @IsNumber()
  @Min(0)
  deductions?: number = 0;

  @IsOptional()
  @IsNumber()
  @Min(0)
  taxAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  netPay?: number;

  @IsOptional()
  @IsEnum(['SEPA', 'cash', 'check'])
  paymentMethod?: string = 'SEPA';

  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @IsOptional()
  @IsEnum(['pending', 'processing', 'paid', 'failed'])
  status?: string = 'pending';
}

export class UpdatePayrollDto extends CreatePayrollDto {
  @IsOptional()
  @IsString()
  updatedBy?: string;
}

export class PayrollFilterDto {
  @IsOptional()
  @IsString()
  staffId?: string;

  @IsOptional()
  @IsEnum(['pending', 'processing', 'paid', 'failed'])
  status?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class GeneratePayrollDto {
  @IsString()
  staffId: string;

  @IsDateString()
  periodStart: string;

  @IsDateString()
  periodEnd: string;

  @IsOptional()
  @IsBoolean()
  includeOvertime?: boolean = true;

  @IsOptional()
  @IsEnum(['I', 'II', 'III', 'IV', 'V'])
  taxClass?: string = 'I';

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  children?: number = 0;

  @IsOptional()
  @IsBoolean()
  isSingleParent?: boolean = false;

  @IsOptional()
  @IsNumber()
  @Min(0)
  bonus?: number = 0;

  @IsOptional()
  @IsNumber()
  @Min(0)
  otherDeductions?: number = 0;
}

export class AustrianTaxCalculationDto {
  @IsNumber()
  @Min(0)
  grossSalary: number;

  @IsEnum(['I', 'II', 'III', 'IV', 'V'])
  taxClass: string = 'I';

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  children?: number = 0;

  @IsOptional()
  @IsBoolean()
  isSingleParent?: boolean = false;

  @IsOptional()
  @IsBoolean()
  hasChurchTax?: boolean = false;

  @IsOptional()
  @IsString()
  religion?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  additionalDeductions?: number = 0;
}

export class ProcessBulkPayrollDto {
  @IsArray()
  @IsString({ each: true })
  payrollIds: string[];

  @IsString()
  processedBy: string;

  @IsOptional()
  @IsDateString()
  paymentDate?: string;
}

export class ComplianceReportDto {
  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsEnum(['monthly', 'quarterly', 'yearly'])
  reportType?: string = 'monthly';

  @IsOptional()
  @IsBoolean()
  includeFinanzamt?: boolean = true;

  @IsOptional()
  @IsBoolean()
  includeSV?: boolean = true;

  @IsOptional()
  @IsBoolean()
  generateFiles?: boolean = false;
}

export class SEPAFileDto {
  @IsString()
  payrollId: string;

  @IsOptional()
  @IsBoolean()
  generateXml?: boolean = true;

  @IsOptional()
  @IsBoolean()
  generateCsv?: boolean = false;
}