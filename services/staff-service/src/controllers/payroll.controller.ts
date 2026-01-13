import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Headers,
} from '@nestjs/common';
import { PayrollService } from '../services/payroll.service';
import {
  CreatePayrollDto,
  UpdatePayrollDto,
  PayrollFilterDto,
  GeneratePayrollDto,
  ProcessBulkPayrollDto,
  ComplianceReportDto,
  AustrianTaxCalculationDto,
} from '../dto/payroll.dto';
import { AuthGuard } from '../guards/auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';

@Controller('payroll')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Get('health')
  async healthCheck() {
    return {
      status: 'healthy',
      service: 'payroll-service',
      timestamp: new Date().toISOString(),
      database: await this.payrollService.checkDatabase(),
    };
  }

  @Post('generate')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'HR')
  async generatePayroll(
    @Body() generatePayrollDto: GeneratePayrollDto,
    @Headers('x-user-id') generatedBy: string,
  ) {
    return this.payrollService.generatePayroll(generatePayrollDto, generatedBy);
  }

  @Post('bulk/generate')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'HR')
  async generateBulkPayroll(
    @Body() body: { staffIds: string[]; periodStart: string; periodEnd: string },
    @Headers('x-user-id') generatedBy: string,
  ) {
    const results = [];
    for (const staffId of body.staffIds) {
      const payrollDto: GeneratePayrollDto = {
        staffId,
        periodStart: body.periodStart,
        periodEnd: body.periodEnd,
      };
      try {
        const result = await this.payrollService.generatePayroll(payrollDto, generatedBy);
        results.push({ staffId, success: true, data: result });
      } catch (error) {
        results.push({ staffId, success: false, error: error.message });
      }
    }
    return results;
  }

  @Post('bulk/process')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'HR')
  async processBulkPayroll(
    @Body() processBulkPayrollDto: ProcessBulkPayrollDto,
  ) {
    return this.payrollService.processBulkPayroll(
      processBulkPayrollDto.payrollIds,
      processBulkPayrollDto.processedBy,
    );
  }

  @Post('calculate/austrian-tax')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'HR', 'STAFF')
  async calculateAustrianTax(
    @Body() taxCalculationDto: AustrianTaxCalculationDto,
  ) {
    // This would normally use actual staff data
    const mockStaff = {
      salary: taxCalculationDto.grossSalary * 12, // Convert to yearly
      user: {
        religion: taxCalculationDto.religion,
      },
    };

    const result = await this.payrollService.calculateAustrianTaxes(
      mockStaff,
      { totalGross: taxCalculationDto.grossSalary },
      taxCalculationDto.taxClass,
      taxCalculationDto.children,
      taxCalculationDto.isSingleParent,
    );

    return {
      calculation: result,
      breakdown: {
        monthlyGross: taxCalculationDto.grossSalary,
        yearlyGross: taxCalculationDto.grossSalary * 12,
        monthlyNet: taxCalculationDto.grossSalary - result.totalDeductions,
        taxRate: (result.incomeTax / taxCalculationDto.grossSalary) * 100,
      },
    };
  }

  @Get()
  @UseGuards(AuthGuard)
  async getAllPayrolls(@Query() filters: PayrollFilterDto) {
    return this.payrollService.getAllPayrolls(filters);
  }

  @Get('staff/:staffId')
  @UseGuards(AuthGuard)
  async getStaffPayrolls(
    @Param('staffId') staffId: string,
    @Query() filters: Omit<PayrollFilterDto, 'staffId'>,
  ) {
    const payrollFilters: PayrollFilterDto = {
      ...filters,
      staffId,
    };
    return this.payrollService.getAllPayrolls(payrollFilters);
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  async getPayrollById(@Param('id') id: string) {
    return this.payrollService.getPayrollById(id);
  }

  @Get(':id/lohnzettel')
  @UseGuards(AuthGuard)
  async getLohnzettel(@Param('id') id: string) {
    const payroll = await this.payrollService.getPayrollById(id);
    return payroll.metadata?.lohnzettel || { error: 'Lohnzettel not generated' };
  }

  @Get(':id/sepa')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'HR')
  async getSEPAFile(@Param('id') id: string) {
    const payroll = await this.payrollService.getPayrollById(id);
    return payroll.metadata?.sepaFile || { error: 'SEPA file not generated' };
  }

  @Put(':id/status')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'HR')
  async updatePayrollStatus(
    @Param('id') id: string,
    @Body() body: { status: string },
    @Headers('x-user-id') updatedBy: string,
  ) {
    return this.payrollService.updatePayrollStatus(id, body.status, updatedBy);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'HR')
  async deletePayroll(
    @Param('id') id: string,
    @Headers('x-user-id') deletedBy: string,
  ) {
    return this.payrollService.deletePayroll(id, deletedBy);
  }

  @Get('stats/summary')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'HR')
  async getPayrollStats() {
    return this.payrollService.getPayrollStats();
  }

  @Post('reports/compliance')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'HR')
  async generateComplianceReport(@Body() reportDto: ComplianceReportDto) {
    return this.payrollService.getAustrianComplianceReport(
      reportDto.startDate,
      reportDto.endDate,
    );
  }

  @Get('austrian/rules')
  @UseGuards(AuthGuard)
  async getAustrianRules() {
    return {
      taxClasses: [
        { code: 'I', description: 'Ledig, geschieden, verwitwet' },
        { code: 'II', description: 'Verheiratet, beide Arbeitnehmer' },
        { code: 'III', description: 'Verheiratet, ein Arbeitnehmer' },
        { code: 'IV', description: 'Verheiratet, beide Arbeitnehmer (gleiche Steuer)' },
        { code: 'V', description: 'Alleinerziehend' },
      ],
      socialInsurance: {
        pension: { rate: 0.2278, employee: 0.1025, employer: 0.1253 },
        health: { rate: 0.0788, employee: 0.0387, employer: 0.0401 },
        accident: { rate: 0.014, employee: 0, employer: 0.014 },
        unemployment: { rate: 0.06, employee: 0.03, employer: 0.03 },
        insuranceSupplement: { rate: 0.02, employee: 0.02, employer: 0 },
      },
      taxBrackets: [
        { min: 0, max: 11000, rate: 0.00, description: 'Steuerfreibetrag' },
        { min: 11001, max: 18000, rate: 0.20, description: '20%' },
        { min: 18001, max: 31000, rate: 0.35, description: '35%' },
        { min: 31001, max: 60000, rate: 0.42, description: '42%' },
        { min: 60001, max: 90000, rate: 0.48, description: '48%' },
        { min: 90001, max: 1000000, rate: 0.50, description: '50%' },
      ],
      deductions: {
        advertisingCosts: 132, // Werbungskostenpauschale
        specialExpenses: 60, // Sonderausgabenpauschale
        employeeDeduction: 132, // Arbeitnehmerpauschale
        childDeduction: { perChild: 58.40, maxChildren: 10 },
        singleParentDeduction: 494,
      },
      minimumWage: {
        hourly: 12.45,
        monthly: 2100,
      },
      workingHours: {
        weekly: 38.5,
        daily: 8,
        monthlyAverage: 173,
      },
      overtime: {
        first10Hours: 1.25, // 125%
        additionalHours: 1.5, // 150%
        sundayPremium: 1.5, // 150%
        holidayPremium: 2.0, // 200%
        nightPremium: 1.25, // 125% (10 PM - 6 AM)
      },
      specialPayments: {
        holidayBonus: 1/12, // Urlaubsgeld
        christmasBonus: 1/12, // Weihnachtsgeld
        vacationDays: 25, // Minimum vacation days per year
      },
      compliance: {
        lohnzettelRequired: true,
        meldungFinanzamt: 'monthly',
        meldungSV: 'monthly',
        recordKeeping: '7 years',
        payslipDelivery: 'electronically acceptable',
      },
    };
  }

  @Get('calendar/holidays/:year')
  @UseGuards(AuthGuard)
  async getAustrianHolidays(@Param('year') year: string) {
    const holidays = [
      { date: `${year}-01-01`, name: 'Neujahr' },
      { date: `${year}-01-06`, name: 'Heilige Drei Könige' },
      { date: this.calculateEasterMonday(year), name: 'Ostermontag' },
      { date: `${year}-05-01`, name: 'Staatsfeiertag' },
      { date: this.calculateAscension(year), name: 'Christi Himmelfahrt' },
      { date: this.calculatePentecostMonday(year), name: 'Pfingstmontag' },
      { date: this.calculateCorpusChristi(year), name: 'Fronleichnam' },
      { date: `${year}-08-15`, name: 'Mariä Himmelfahrt' },
      { date: `${year}-10-26`, name: 'Nationalfeiertag' },
      { date: `${year}-11-01`, name: 'Allerheiligen' },
      { date: `${year}-12-08`, name: 'Mariä Empfängnis' },
      { date: `${year}-12-25`, name: 'Weihnachten' },
      { date: `${year}-12-26`, name: 'Stefanitag' },
    ];

    return {
      year,
      holidays,
      note: 'Holidays may vary by Bundesland. These are Vienna dates.',
    };
  }

  // Helper methods for calculating movable holidays
  private calculateEasterMonday(year: string): string {
    // Simplified calculation - in production use a proper library
    const y = parseInt(year);
    const a = y % 19;
    const b = Math.floor(y / 100);
    const c = y % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    
    const easter = new Date(y, month - 1, day);
    easter.setDate(easter.getDate() + 1); // Easter Monday
    
    return easter.toISOString().split('T')[0];
  }

  private calculateAscension(year: string): string {
    const easterMonday = this.calculateEasterMonday(year);
    const easter = new Date(easterMonday);
    easter.setDate(easter.getDate() - 1); // Back to Easter Sunday
    easter.setDate(easter.getDate() + 39); // Ascension is 39 days after Easter
    return easter.toISOString().split('T')[0];
  }

  private calculatePentecostMonday(year: string): string {
    const easterMonday = this.calculateEasterMonday(year);
    const easter = new Date(easterMonday);
    easter.setDate(easter.getDate() - 1); // Back to Easter Sunday
    easter.setDate(easter.getDate() + 50); // Pentecost Monday is 50 days after Easter
    return easter.toISOString().split('T')[0];
  }

  private calculateCorpusChristi(year: string): string {
    const easterMonday = this.calculateEasterMonday(year);
    const easter = new Date(easterMonday);
    easter.setDate(easter.getDate() - 1); // Back to Easter Sunday
    easter.setDate(easter.getDate() + 60); // Corpus Christi is 60 days after Easter
    return easter.toISOString().split('T')[0];
  }
}