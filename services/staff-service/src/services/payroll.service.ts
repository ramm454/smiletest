import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  CreatePayrollDto,
  UpdatePayrollDto,
  PayrollFilterDto,
  GeneratePayrollDto,
  AustrianTaxCalculationDto,
} from '../dto/payroll.dto';
import * as moment from 'moment';

@Injectable()
export class PayrollService {
  constructor(private readonly prisma: PrismaService) {}

  // Austrian Tax Classes (2024)
  private readonly TAX_CLASSES = {
    SINGLE: 'I',           // Ledig, geschieden, verwitwet
    MARRIED: 'II',         // Verheiratet, beide Arbeitnehmer
    MARRIED_ONE_EARNER: 'III', // Verheiratet, ein Arbeitnehmer
    MARRIED_TWO_EARNERS: 'IV', // Verheiratet, beide Arbeitnehmer
    SINGLE_PARENT: 'V',    // Alleinerziehend
  };

  // Austrian Social Insurance Rates 2024
  private readonly SOCIAL_INSURANCE_RATES = {
    PENSION: 0.2278,          // 22.78% (10.25% employee + 12.53% employer)
    HEALTH: 0.0788,           // 7.88% (3.87% employee + 4.01% employer)
    ACCIDENT: 0.014,          // 1.4% (employer only)
    UNEMPLOYMENT: 0.06,       // 6% (3% employee + 3% employer)
    INSSURANCE_SUPPLEMENT: 0.02, // 2% (employee only)
  };

  // Austrian Tax Brackets 2024 (Progressive Tax)
  private readonly TAX_BRACKETS = [
    { min: 0, max: 11000, rate: 0.00 },        // Steuerfreibetrag
    { min: 11001, max: 18000, rate: 0.20 },    // 20%
    { min: 18001, max: 31000, rate: 0.35 },    // 35%
    { min: 31001, max: 60000, rate: 0.42 },    // 42%
    { min: 60001, max: 90000, rate: 0.48 },    // 48%
    { min: 90001, max: 1000000, rate: 0.50 },  // 50%
  ];

  // Austrian Deductions (Werbekostenpauschale, etc.)
  private readonly STANDARD_DEDUCTIONS = {
    ADVERTISING_COSTS: 132,           // Werbungskostenpauschale
    SPECIAL_EXPENSES: 60,             // Sonderausgabenpauschale
    EMPLOYEE_DEDUCTION: 132,          // Arbeitnehmerpauschale
    CHILD_DEDUCTION: {                // Kinderabsetzbetrag
      PER_CHILD: 58.40,               // Pro Monat pro Kind
      MAX_CHILDREN: 10,
    },
    SINGLE_PARENT_DEDUCTION: 494,     // Alleinerzieherabsetzbetrag pro Jahr
  };

  // Austrian Minimum Wage 2024
  private readonly MINIMUM_WAGE = {
    HOURLY: 12.45,                    // €/hour (Kollektivvertrag dependent)
    MONTHLY: 2100,                    // €/month (approx)
  };

  // Austrian Public Holidays (Bundesland specific - using Vienna as example)
  private readonly PUBLIC_HOLIDAYS = [
    '2024-01-01', // Neujahr
    '2024-01-06', // Heilige Drei Könige
    '2024-04-01', // Ostermontag
    '2024-05-01', // Staatsfeiertag
    '2024-05-09', // Christi Himmelfahrt
    '2024-05-20', // Pfingstmontag
    '2024-05-30', // Fronleichnam
    '2024-08-15', // Mariä Himmelfahrt
    '2024-10-26', // Nationalfeiertag
    '2024-11-01', // Allerheiligen
    '2024-12-08', // Mariä Empfängnis
    '2024-12-25', // Weihnachten
    '2024-12-26', // Stefanitag
  ];

  async generatePayroll(generatePayrollDto: GeneratePayrollDto, generatedBy: string) {
    const { staffId, periodStart, periodEnd, includeOvertime = true } = generatePayrollDto;

    // Validate staff exists and is active
    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId, isActive: true },
      include: {
        user: true,
        shifts: {
          where: {
            startTime: { gte: new Date(periodStart) },
            endTime: { lte: new Date(periodEnd) },
            status: 'COMPLETED',
          },
        },
        availabilities: true,
      },
    });

    if (!staff) {
      throw new NotFoundException('Staff not found or inactive');
    }

    // Check if payroll already exists for this period
    const existingPayroll = await this.prisma.payroll.findFirst({
      where: {
        staffId,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
      },
    });

    if (existingPayroll) {
      throw new BadRequestException('Payroll already exists for this period');
    }

    // Calculate working days in period
    const workingDays = this.calculateWorkingDays(periodStart, periodEnd);

    // Calculate regular hours
    const regularHours = this.calculateRegularHours(
      staff,
      periodStart,
      periodEnd,
      workingDays,
    );

    // Calculate overtime
    const overtimeHours = includeOvertime
      ? this.calculateOvertime(staff.shifts, regularHours)
      : 0;

    // Calculate gross salary
    const grossSalary = this.calculateGrossSalary(
      staff,
      regularHours,
      overtimeHours,
    );

    // Calculate Austrian taxes and deductions
    const taxCalculation = await this.calculateAustrianTaxes(
      staff,
      grossSalary,
      generatePayrollDto.taxClass || this.TAX_CLASSES.SINGLE,
      generatePayrollDto.children || 0,
      generatePayrollDto.isSingleParent || false,
    );

    // Calculate social insurance contributions
    const socialInsurance = this.calculateSocialInsurance(
      grossSalary,
      staff.employmentType,
    );

    // Calculate net pay
    const netPay = this.calculateNetPay(
      grossSalary,
      taxCalculation,
      socialInsurance,
      generatePayrollDto.otherDeductions || 0,
    );

    // Create payroll record
    const payroll = await this.prisma.payroll.create({
      data: {
        staffId,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        baseSalary: grossSalary.baseSalary,
        overtimePay: grossSalary.overtimePay,
        bonus: generatePayrollDto.bonus || 0,
        deductions: taxCalculation.totalDeductions + socialInsurance.employeeTotal,
        taxAmount: taxCalculation.incomeTax,
        netPay,
        paymentMethod: staff.bankDetails?.['method'] || 'SEPA',
        status: 'pending',
        metadata: {
          calculation: {
            regularHours,
            overtimeHours,
            workingDays,
            taxClass: generatePayrollDto.taxClass,
            children: generatePayrollDto.children,
            isSingleParent: generatePayrollDto.isSingleParent,
            taxCalculation,
            socialInsurance,
          },
          compliance: {
            lohnzettelGenerated: false,
            meldungDone: false,
            svNumber: staff.user?.socialSecurityNumber,
            taxNumber: staff.user?.taxNumber,
          },
        },
      },
      include: {
        staff: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    // Generate Lohnzettel (Austrian pay slip)
    await this.generateLohnzettel(payroll);

    // Send notification
    await this.sendPayrollNotification(staff, payroll);

    return {
      payroll,
      breakdown: {
        grossSalary,
        taxCalculation,
        socialInsurance,
        netPay,
        workingDays,
        regularHours,
        overtimeHours,
      },
    };
  }

  async calculateAustrianTaxes(
    staff: any,
    grossSalary: any,
    taxClass: string,
    children: number = 0,
    isSingleParent: boolean = false,
  ): Promise<any> {
    const monthlyGross = grossSalary.totalGross;
    const yearlyGross = monthlyGross * 14; // Austrian 14-month salary system

    // Calculate taxable income
    let taxableIncome = yearlyGross;

    // Apply standard deductions
    taxableIncome -= this.STANDARD_DEDUCTIONS.ADVERTISING_COSTS * 12;
    taxableIncome -= this.STANDARD_DEDUCTIONS.SPECIAL_EXPENSES * 12;
    taxableIncome -= this.STANDARD_DEDUCTIONS.EMPLOYEE_DEDUCTION * 12;

    // Apply child deductions
    if (children > 0) {
      const childDeduction = this.STANDARD_DEDUCTIONS.CHILD_DEDUCTION.PER_CHILD * 12;
      taxableIncome -= Math.min(children, this.STANDARD_DEDUCTIONS.CHILD_DEDUCTION.MAX_CHILDREN) * childDeduction;
    }

    // Apply single parent deduction
    if (isSingleParent) {
      taxableIncome -= this.STANDARD_DEDUCTIONS.SINGLE_PARENT_DEDUCTION;
    }

    // Apply tax class multipliers
    const taxClassMultiplier = this.getTaxClassMultiplier(taxClass);
    taxableIncome *= taxClassMultiplier;

    // Calculate progressive tax
    let remainingIncome = taxableIncome;
    let totalTax = 0;

    for (const bracket of this.TAX_BRACKETS) {
      if (remainingIncome <= 0) break;

      const bracketAmount = Math.min(
        remainingIncome,
        bracket.max - bracket.min + 1,
      );
      const taxInBracket = bracketAmount * bracket.rate;
      totalTax += taxInBracket;
      remainingIncome -= bracketAmount;
    }

    // Convert yearly tax to monthly
    const monthlyTax = totalTax / 12;

    // Calculate church tax (Kirchensteuer) - optional
    const churchTax = staff.user?.religion === 'catholic' ? monthlyTax * 0.011 : 0;

    // Calculate solidarity contribution (Solidaritätszuschlag) - not in Austria
    const solidarityTax = 0;

    // Calculate total deductions
    const totalDeductions = monthlyTax + churchTax + solidarityTax;

    return {
      taxableIncome: yearlyGross,
      adjustedTaxableIncome: taxableIncome,
      incomeTax: monthlyTax,
      churchTax,
      solidarityTax,
      totalDeductions,
      taxClass,
      taxClassMultiplier,
      children,
      isSingleParent,
      deductionsApplied: {
        advertisingCosts: this.STANDARD_DEDUCTIONS.ADVERTISING_COSTS,
        specialExpenses: this.STANDARD_DEDUCTIONS.SPECIAL_EXPENSES,
        employeeDeduction: this.STANDARD_DEDUCTIONS.EMPLOYEE_DEDUCTION,
        childDeduction: children > 0 ? this.STANDARD_DEDUCTIONS.CHILD_DEDUCTION.PER_CHILD * children : 0,
        singleParentDeduction: isSingleParent ? this.STANDARD_DEDUCTIONS.SINGLE_PARENT_DEDUCTION / 12 : 0,
      },
    };
  }

  calculateSocialInsurance(grossSalary: number, employmentType: string): any {
    const monthlyGross = grossSalary;

    // Different rates for different employment types
    let rates = { ...this.SOCIAL_INSURANCE_RATES };

    if (employmentType === 'part_time' || employmentType === 'contractor') {
      // Adjust rates for part-time/contractors if needed
      rates.HEALTH = 0.0888; // Slightly higher for some cases
    }

    // Employee contributions
    const employeePension = monthlyGross * (rates.PENSION / 2); // Half of total
    const employeeHealth = monthlyGross * (rates.HEALTH / 2); // Half of total
    const employeeUnemployment = monthlyGross * (rates.UNEMPLOYMENT / 2); // Half of total
    const employeeInsuranceSupplement = monthlyGross * rates.INSSURANCE_SUPPLEMENT;

    // Employer contributions
    const employerPension = monthlyGross * (rates.PENSION / 2);
    const employerHealth = monthlyGross * (rates.HEALTH / 2);
    const employerAccident = monthlyGross * rates.ACCIDENT;
    const employerUnemployment = monthlyGross * (rates.UNEMPLOYMENT / 2);

    const employeeTotal = employeePension + employeeHealth + employeeUnemployment + employeeInsuranceSupplement;
    const employerTotal = employerPension + employerHealth + employerAccident + employerUnemployment;
    const total = employeeTotal + employerTotal;

    return {
      employee: {
        pension: employeePension,
        health: employeeHealth,
        unemployment: employeeUnemployment,
        insuranceSupplement: employeeInsuranceSupplement,
        total: employeeTotal,
      },
      employer: {
        pension: employerPension,
        health: employerHealth,
        accident: employerAccident,
        unemployment: employerUnemployment,
        total: employerTotal,
      },
      total,
      rates,
    };
  }

  calculateGrossSalary(
    staff: any,
    regularHours: number,
    overtimeHours: number,
  ): any {
    const hourlyRate = staff.hourlyRate || this.MINIMUM_WAGE.HOURLY;
    const monthlySalary = staff.salary || this.MINIMUM_WAGE.MONTHLY;

    // Calculate base salary (regular hours)
    const baseSalary = (monthlySalary / 173) * regularHours; // 173 = average monthly working hours in Austria

    // Calculate overtime pay (125% for first 10 hours, 150% thereafter)
    let overtimePay = 0;
    if (overtimeHours > 0) {
      const firstOvertime = Math.min(overtimeHours, 10);
      const additionalOvertime = Math.max(overtimeHours - 10, 0);

      overtimePay = (firstOvertime * hourlyRate * 1.25) + 
                    (additionalOvertime * hourlyRate * 1.5);
    }

    // Calculate holiday pay (Urlaubsgeld) - 1/12 of monthly salary per month
    const holidayPay = monthlySalary / 12;

    // Calculate Christmas bonus (Weihnachtsgeld) - 1/12 of monthly salary per month
    const christmasBonus = monthlySalary / 12;

    // Calculate vacation bonus (Urlaubsgeld) - special calculation
    const vacationBonus = this.calculateVacationBonus(staff, regularHours);

    // Calculate Sunday/holiday premiums
    const premiumPay = this.calculatePremiumPay(staff);

    const totalGross = baseSalary + overtimePay + holidayPay + christmasBonus + vacationBonus + premiumPay;

    return {
      baseSalary,
      overtimePay,
      holidayPay,
      christmasBonus,
      vacationBonus,
      premiumPay,
      totalGross,
      hourlyRate,
      monthlySalary,
    };
  }

  calculateNetPay(
    grossSalary: any,
    taxCalculation: any,
    socialInsurance: any,
    otherDeductions: number = 0,
  ): number {
    const totalGross = grossSalary.totalGross;
    const totalDeductions = taxCalculation.totalDeductions + 
                           socialInsurance.employeeTotal + 
                           otherDeductions;

    return totalGross - totalDeductions;
  }

  calculateWorkingDays(startDate: string, endDate: string): number {
    let workingDays = 0;
    const start = moment(startDate);
    const end = moment(endDate);
    
    for (let m = moment(start); m.diff(end, 'days') <= 0; m.add(1, 'days')) {
      // Monday to Friday are working days
      if (m.isoWeekday() >= 1 && m.isoWeekday() <= 5) {
        // Check if it's a public holiday
        const dateStr = m.format('YYYY-MM-DD');
        if (!this.PUBLIC_HOLIDAYS.includes(dateStr)) {
          workingDays++;
        }
      }
    }
    
    return workingDays;
  }

  calculateRegularHours(
    staff: any,
    startDate: string,
    endDate: string,
    workingDays: number,
  ): number {
    // Default to 8 hours per day, 38.5 hours per week (Austrian standard)
    const hoursPerDay = 8;
    const hoursPerWeek = 38.5;
    
    // Check for part-time
    if (staff.employmentType === 'part_time') {
      const partTimePercentage = staff.maxHoursPerWeek 
        ? staff.maxHoursPerWeek / hoursPerWeek 
        : 0.5; // Default 50%
      return workingDays * hoursPerDay * partTimePercentage;
    }
    
    return workingDays * hoursPerDay;
  }

  calculateOvertime(shifts: any[], regularHours: number): number {
    let totalHours = 0;
    
    shifts.forEach(shift => {
      if (shift.actualDuration) {
        totalHours += shift.actualDuration / 60; // Convert minutes to hours
      } else if (shift.startTime && shift.endTime) {
        const duration = (new Date(shift.endTime).getTime() - 
                         new Date(shift.startTime).getTime()) / (1000 * 60 * 60);
        totalHours += duration;
      }
    });
    
    return Math.max(totalHours - regularHours, 0);
  }

  calculateVacationBonus(staff: any, regularHours: number): number {
    // Austrian law: 1/12 of monthly salary as vacation bonus
    const monthlySalary = staff.salary || this.MINIMUM_WAGE.MONTHLY;
    return monthlySalary / 12;
  }

  calculatePremiumPay(staff: any): number {
    // Sunday work: +50% to +100% premium
    // Holiday work: +100% to +150% premium
    // Night work: +25% premium (10 PM to 6 AM)
    return 0; // Implement based on shift data
  }

  getTaxClassMultiplier(taxClass: string): number {
    const multipliers = {
      [this.TAX_CLASSES.SINGLE]: 1.0,
      [this.TAX_CLASSES.MARRIED]: 0.9,
      [this.TAX_CLASSES.MARRIED_ONE_EARNER]: 0.8,
      [this.TAX_CLASSES.MARRIED_TWO_EARNERS]: 0.9,
      [this.TAX_CLASSES.SINGLE_PARENT]: 0.85,
    };
    
    return multipliers[taxClass] || 1.0;
  }

  async generateLohnzettel(payroll: any): Promise<void> {
    // Generate Austrian pay slip (Lohnzettel)
    const lohnzettel = {
      employer: {
        name: 'Yoga Spa GmbH',
        address: 'Hauptstraße 1, 1010 Wien',
        uid: 'ATU12345678',
      },
      employee: {
        name: `${payroll.staff.user.firstName} ${payroll.staff.user.lastName}`,
        svNumber: payroll.metadata?.compliance?.svNumber || 'SV1234567890',
        taxNumber: payroll.metadata?.compliance?.taxNumber || '123456/1234',
      },
      period: {
        from: payroll.periodStart,
        to: payroll.periodEnd,
        paymentDate: payroll.paymentDate || new Date(),
      },
      earnings: {
        bruttolohn: payroll.baseSalary + payroll.overtimePay,
        sonderzahlungen: payroll.bonus,
        urlaubsgeld: payroll.metadata?.calculation?.grossSalary?.holidayPay || 0,
        weihnachtsgeld: payroll.metadata?.calculation?.grossSalary?.christmasBonus || 0,
        gesamtbrutto: payroll.baseSalary + payroll.overtimePay + payroll.bonus,
      },
      deductions: {
        svBeitrag: payroll.metadata?.calculation?.socialInsurance?.employeeTotal || 0,
        lohnsteuer: payroll.taxAmount,
        kirchensteuer: payroll.metadata?.calculation?.taxCalculation?.churchTax || 0,
        sonstigeAbzuege: payroll.deductions - (payroll.taxAmount + (payroll.metadata?.calculation?.socialInsurance?.employeeTotal || 0)),
      },
      netto: payroll.netPay,
      employerContributions: {
        svBeitrag: payroll.metadata?.calculation?.socialInsurance?.employerTotal || 0,
        dafBeitrag: 0, // Dienstgeberabgabe
      },
    };

    // Store Lohnzettel in payroll metadata
    await this.prisma.payroll.update({
      where: { id: payroll.id },
      data: {
        metadata: {
          ...payroll.metadata,
          lohnzettel,
          lohnzettelGenerated: true,
          generatedAt: new Date(),
        },
      },
    });
  }

  async sendPayrollNotification(staff: any, payroll: any): Promise<void> {
    // Send notification to employee about payroll
    console.log(`Payroll notification sent to ${staff.user.email}`);
    
    // In production, integrate with notification service
    // await this.notificationService.sendPayrollNotification(staff.userId, payroll);
  }

  // CRUD Operations
  async getAllPayrolls(filters: PayrollFilterDto) {
    const {
      staffId,
      status,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = filters;

    const skip = (page - 1) * limit;
    const where: any = {};

    if (staffId) where.staffId = staffId;
    if (status) where.status = status;
    if (startDate || endDate) {
      where.periodStart = {};
      if (startDate) where.periodStart.gte = new Date(startDate);
      if (endDate) where.periodStart.lte = new Date(endDate);
    }

    const [payrolls, total] = await Promise.all([
      this.prisma.payroll.findMany({
        where,
        include: {
          staff: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
        },
        orderBy: { periodStart: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.payroll.count({ where }),
    ]);

    return {
      payrolls,
      pagination: {
        total,
        page: parseInt(page.toString()),
        limit: parseInt(limit.toString()),
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getPayrollById(id: string) {
    const payroll = await this.prisma.payroll.findUnique({
      where: { id },
      include: {
        staff: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
          },
        },
      },
    });

    if (!payroll) {
      throw new NotFoundException('Payroll not found');
    }

    return payroll;
  }

  async updatePayrollStatus(id: string, status: string, updatedBy: string) {
    const payroll = await this.prisma.payroll.findUnique({
      where: { id },
    });

    if (!payroll) {
      throw new NotFoundException('Payroll not found');
    }

    // Check if payroll can be updated
    if (payroll.status === 'paid' && status !== 'paid') {
      throw new BadRequestException('Cannot modify paid payroll');
    }

    const updatedPayroll = await this.prisma.payroll.update({
      where: { id },
      data: {
        status,
        paymentDate: status === 'paid' ? new Date() : null,
        updatedBy,
      },
    });

    return updatedPayroll;
  }

  async deletePayroll(id: string, deletedBy: string) {
    const payroll = await this.prisma.payroll.findUnique({
      where: { id },
    });

    if (!payroll) {
      throw new NotFoundException('Payroll not found');
    }

    if (payroll.status === 'paid') {
      throw new ForbiddenException('Cannot delete paid payroll');
    }

    await this.prisma.payroll.delete({
      where: { id },
    });

    return { success: true, message: 'Payroll deleted successfully' };
  }

  async getPayrollStats() {
    const [
      totalPayrolls,
      totalPaid,
      totalPending,
      totalProcessing,
      totalAmount,
      averageNetPay,
    ] = await Promise.all([
      this.prisma.payroll.count(),
      this.prisma.payroll.count({ where: { status: 'paid' } }),
      this.prisma.payroll.count({ where: { status: 'pending' } }),
      this.prisma.payroll.count({ where: { status: 'processing' } }),
      this.prisma.payroll.aggregate({
        _sum: { netPay: true },
      }),
      this.prisma.payroll.aggregate({
        _avg: { netPay: true },
      }),
    ]);

    // Calculate monthly totals
    const currentMonth = new Date();
    const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const lastDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

    const monthlyStats = await this.prisma.payroll.aggregate({
      where: {
        periodStart: {
          gte: firstDayOfMonth,
          lte: lastDayOfMonth,
        },
        status: 'paid',
      },
      _sum: {
        baseSalary: true,
        overtimePay: true,
        bonus: true,
        netPay: true,
        taxAmount: true,
      },
      _count: true,
    });

    return {
      overview: {
        totalPayrolls,
        totalPaid,
        totalPending,
        totalProcessing,
        totalAmount: totalAmount._sum.netPay || 0,
        averageNetPay: averageNetPay._avg.netPay || 0,
      },
      monthly: {
        count: monthlyStats._count,
        totalBaseSalary: monthlyStats._sum.baseSalary || 0,
        totalOvertime: monthlyStats._sum.overtimePay || 0,
        totalBonus: monthlyStats._sum.bonus || 0,
        totalNetPay: monthlyStats._sum.netPay || 0,
        totalTax: monthlyStats._sum.taxAmount || 0,
      },
      byDepartment: await this.getPayrollByDepartment(),
      byMonth: await this.getPayrollTrend(),
    };
  }

  async getPayrollByDepartment() {
    const payrolls = await this.prisma.payroll.findMany({
      where: { status: 'paid' },
      include: {
        staff: {
          include: {
            user: true,
          },
        },
      },
    });

    const byDepartment = payrolls.reduce((acc, payroll) => {
      const department = payroll.staff.department || 'Unknown';
      if (!acc[department]) {
        acc[department] = {
          count: 0,
          totalNetPay: 0,
          totalTax: 0,
          totalGross: 0,
        };
      }
      acc[department].count++;
      acc[department].totalNetPay += payroll.netPay;
      acc[department].totalTax += payroll.taxAmount;
      acc[department].totalGross += payroll.baseSalary + payroll.overtimePay + payroll.bonus;
      return acc;
    }, {});

    return byDepartment;
  }

  async getPayrollTrend() {
    // Get payrolls from last 12 months
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const payrolls = await this.prisma.payroll.findMany({
      where: {
        periodStart: { gte: twelveMonthsAgo },
        status: 'paid',
      },
      select: {
        periodStart: true,
        netPay: true,
        taxAmount: true,
        baseSalary: true,
      },
      orderBy: { periodStart: 'asc' },
    });

    // Group by month
    const monthlyTrend = payrolls.reduce((acc, payroll) => {
      const month = payroll.periodStart.toISOString().slice(0, 7); // YYYY-MM
      if (!acc[month]) {
        acc[month] = {
          netPay: 0,
          taxAmount: 0,
          grossSalary: 0,
          count: 0,
        };
      }
      acc[month].netPay += payroll.netPay;
      acc[month].taxAmount += payroll.taxAmount;
      acc[month].grossSalary += payroll.baseSalary;
      acc[month].count++;
      return acc;
    }, {});

    // Convert to array and fill missing months
    const result = [];
    for (let i = 0; i < 12; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const month = date.toISOString().slice(0, 7);
      
      result.unshift({
        month,
        ...(monthlyTrend[month] || {
          netPay: 0,
          taxAmount: 0,
          grossSalary: 0,
          count: 0,
        }),
      });
    }

    return result;
  }

  async processBulkPayroll(payrollIds: string[], processedBy: string) {
    const results = [];
    
    for (const payrollId of payrollIds) {
      try {
        const payroll = await this.prisma.payroll.findUnique({
          where: { id: payrollId },
        });

        if (!payroll) {
          results.push({ payrollId, success: false, error: 'Payroll not found' });
          continue;
        }

        if (payroll.status !== 'pending') {
          results.push({ payrollId, success: false, error: 'Payroll not in pending state' });
          continue;
        }

        // Process payment (integrate with payment service in production)
        // For now, just mark as processing
        const updatedPayroll = await this.prisma.payroll.update({
          where: { id: payrollId },
          data: {
            status: 'processing',
            paymentDate: new Date(),
            updatedBy: processedBy,
          },
        });

        // Generate payment file for bank transfer (SEPA XML)
        await this.generateSEPAFile(updatedPayroll);

        results.push({ payrollId, success: true, data: updatedPayroll });
      } catch (error) {
        results.push({ payrollId, success: false, error: error.message });
      }
    }

    return results;
  }

  async generateSEPAFile(payroll: any): Promise<void> {
    // Generate SEPA XML file for bank transfer
    const sepaData = {
      creditor: {
        name: 'Yoga Spa GmbH',
        iban: 'AT611904300234573201',
        bic: 'BKAUATWW',
      },
      debtor: {
        name: `${payroll.staff.user.firstName} ${payroll.staff.user.lastName}`,
        iban: payroll.staff.bankDetails?.iban || '',
      },
      payment: {
        amount: payroll.netPay,
        currency: 'EUR',
        purpose: `Gehalt ${payroll.periodStart.toISOString().slice(0, 7)}`,
        endToEndId: `YOGASPA-${payroll.id}`,
      },
    };

    // Store SEPA file in metadata
    await this.prisma.payroll.update({
      where: { id: payroll.id },
      data: {
        metadata: {
          ...payroll.metadata,
          sepaFile: sepaData,
          sepaGenerated: true,
        },
      },
    });
  }

  async getAustrianComplianceReport(startDate: string, endDate: string) {
    // Generate Austrian compliance reports
    const payrolls = await this.prisma.payroll.findMany({
      where: {
        periodStart: { gte: new Date(startDate) },
        periodEnd: { lte: new Date(endDate) },
        status: 'paid',
      },
      include: {
        staff: {
          include: {
            user: true,
          },
        },
      },
    });

    // Lohnzettel Summary
    const lohnzettelSummary = payrolls.map(payroll => ({
      employee: `${payroll.staff.user.firstName} ${payroll.staff.user.lastName}`,
      svNumber: payroll.metadata?.compliance?.svNumber,
      period: `${payroll.periodStart.toISOString().slice(0, 10)} - ${payroll.periodEnd.toISOString().slice(0, 10)}`,
      gross: payroll.baseSalary + payroll.overtimePay + payroll.bonus,
      net: payroll.netPay,
      tax: payroll.taxAmount,
      svContributions: payroll.metadata?.calculation?.socialInsurance?.employeeTotal || 0,
    }));

    // Meldung an Finanzamt (ELMA)
    const finanzamtMeldung = {
      unternehmer: {
        name: 'Yoga Spa GmbH',
        uid: 'ATU12345678',
        address: 'Hauptstraße 1, 1010 Wien',
      },
      meldezeitraum: `${startDate} - ${endDate}`,
      lohnsumme: payrolls.reduce((sum, p) => sum + p.baseSalary + p.overtimePay + p.bonus, 0),
      lohnsteuer: payrolls.reduce((sum, p) => sum + p.taxAmount, 0),
      anzahlBeschaeftigte: new Set(payrolls.map(p => p.staffId)).size,
      meldedatum: new Date().toISOString(),
    };

    // Sozialversicherungsmeldung
    const svMeldung = {
      traeger: 'Österreichische Gesundheitskasse (ÖGK)',
      meldezeitraum: `${startDate} - ${endDate}`,
      beitragsgrundlagen: payrolls.map(p => ({
        svNummer: p.metadata?.compliance?.svNumber,
        beitragsgrundlage: p.baseSalary + p.overtimePay + p.bonus,
        arbeitnehmerAnteil: p.metadata?.calculation?.socialInsurance?.employeeTotal || 0,
        arbeitgeberAnteil: p.metadata?.calculation?.socialInsurance?.employerTotal || 0,
      })),
      gesamtbeitraege: {
        arbeitnehmer: payrolls.reduce((sum, p) => sum + (p.metadata?.calculation?.socialInsurance?.employeeTotal || 0), 0),
        arbeitgeber: payrolls.reduce((sum, p) => sum + (p.metadata?.calculation?.socialInsurance?.employerTotal || 0), 0),
      },
    };

    return {
      lohnzettelSummary,
      finanzamtMeldung,
      svMeldung,
      summary: {
        totalPayrolls: payrolls.length,
        totalGross: finanzamtMeldung.lohnsumme,
        totalTax: finanzamtMeldung.lohnsteuer,
        totalSVContributions: svMeldung.gesamtbeitraege.arbeitnehmer + svMeldung.gesamtbeitraege.arbeitgeber,
        averageNetPay: payrolls.reduce((sum, p) => sum + p.netPay, 0) / payrolls.length,
      },
    };
  }

  async checkDatabase() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'connected';
    } catch (error) {
      return 'disconnected';
    }
  }
}