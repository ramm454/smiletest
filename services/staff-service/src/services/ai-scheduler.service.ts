/**
 * AI-Enhanced Scheduler Service
 * Integrates with AI service for intelligent scheduling and optimization
 */
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma.service';
import * as moment from 'moment';

interface AIStaffProfile {
  staff_id: string;
  name: string;
  department: string;
  skills: string[];
  experience_level: string;
  preferred_shift: string;
  max_hours_per_week: number;
  hourly_rate: number;
  performance_score: number;
  current_workload: number;
  fatigue_level: number;
}

interface AIShiftRequirement {
  shift_id: string;
  department: string;
  required_skills: string[];
  start_time: string;
  end_time: string;
  duration_hours: number;
  min_staff: number;
  optimal_staff: number;
  priority: string;
  location: string;
  complexity_score: number;
}

interface AIOptimizationResult {
  optimization_id: string;
  status: string;
  assignments: Array<{
    staff_index: number;
    shift_index: number;
    assignment_cost: number;
    suitability: number;
    start_time?: string;
    end_time?: string;
    duration?: number;
  }>;
  metrics: {
    coverage_percentage: number;
    avg_suitability_score: number;
    workload_fairness: number;
    skill_utilization_percentage: number;
    preference_satisfaction: number;
    total_assignments: number;
    unassigned_shifts: number;
    avg_hours_per_staff: number;
    workload_std_dev: number;
  };
  constraints_violations: string[];
  recommendations: string[];
  generated_at: string;
}

interface WorkloadBalancingResult {
  balance_id: string;
  staff_distribution: Record<string, number>;
  imbalance_score: number;
  redistribution_plan: Array<{
    from_staff_id: string;
    to_staff_id: string;
    task_id: string;
    expected_workload_change: number;
    reason: string;
    priority: string;
  }>;
  predicted_burnout_risk: Record<string, number>;
  improvement_suggestions: string[];
}

@Injectable()
export class AISchedulerService {
  private readonly logger = new Logger(AISchedulerService.name);
  private readonly aiServiceUrl = process.env.AI_SERVICE_URL || 'http://ai-gateway:8001';

  constructor(
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * AI-powered schedule optimization
   */
  async optimizeSchedule(
    startDate: Date,
    endDate: Date,
    department?: string,
    optimizationType: 'balanced' | 'efficiency' | 'fairness' | 'cost' = 'balanced',
  ): Promise<AIOptimizationResult> {
    try {
      // 1. Fetch staff data
      const staffProfiles = await this.prepareStaffProfiles(department);
      
      // 2. Fetch shift requirements
      const shiftRequirements = await this.prepareShiftRequirements(startDate, endDate, department);
      
      // 3. Prepare AI constraints (Austrian labor law)
      const constraints = this.prepareAustrianConstraints();
      
      // 4. Call AI service
      const aiResult = await this.callAIScheduleOptimization(
        staffProfiles,
        shiftRequirements,
        constraints,
        optimizationType,
      );
      
      // 5. Apply AI recommendations to database
      await this.applyAIRecommendations(aiResult, staffProfiles, shiftRequirements);
      
      return aiResult;
      
    } catch (error) {
      this.logger.error(`AI schedule optimization failed: ${error.message}`);
      return this.fallbackOptimization(startDate, endDate, department);
    }
  }

  /**
   * AI-powered workload balancing
   */
  async balanceWorkload(
    department?: string,
    timePeriod: 'daily' | 'weekly' | 'monthly' = 'weekly',
  ): Promise<WorkloadBalancingResult> {
    try {
      // 1. Fetch current workload data
      const staffProfiles = await this.prepareStaffProfiles(department);
      const currentAssignments = await this.getCurrentAssignments(department);
      
      // 2. Call AI service for workload balancing
      const aiResult = await this.callAIWorkloadBalancing(
        staffProfiles,
        currentAssignments,
        timePeriod,
      );
      
      // 3. Generate actionable insights
      const insights = await this.generateWorkloadInsights(aiResult);
      
      return {
        ...aiResult,
        insights,
      };
      
    } catch (error) {
      this.logger.error(`AI workload balancing failed: ${error.message}`);
      return this.fallbackWorkloadBalance(department);
    }
  }

  /**
   * Predict staff performance using AI
   */
  async predictStaffPerformance(
    staffId: string,
    lookaheadDays: number = 30,
  ): Promise<any> {
    try {
      // 1. Fetch historical performance data
      const historicalData = await this.getHistoricalPerformanceData(staffId);
      
      // 2. Fetch upcoming tasks
      const upcomingTasks = await this.getUpcomingTasks(staffId, lookaheadDays);
      
      // 3. Call AI prediction service
      const prediction = await this.callAIPerformancePrediction(
        staffId,
        historicalData,
        upcomingTasks,
      );
      
      return prediction;
      
    } catch (error) {
      this.logger.error(`AI performance prediction failed: ${error.message}`);
      return this.fallbackPerformancePrediction(staffId);
    }
  }

  /**
   * AI-powered shift swap optimization
   */
  async optimizeShiftSwaps(
    swapRequests: any[],
    department?: string,
  ): Promise<any> {
    try {
      // 1. Prepare data for AI
      const staffProfiles = await this.prepareStaffProfiles(department);
      const currentSchedule = await this.getCurrentSchedule(department);
      
      // 2. Call AI optimization
      const optimizedSwaps = await this.callAIShiftSwapOptimization(
        swapRequests,
        staffProfiles,
        currentSchedule,
      );
      
      // 3. Validate and apply optimizations
      const validatedSwaps = await this.validateSwapOptimizations(optimizedSwaps);
      
      return validatedSwaps;
      
    } catch (error) {
      this.logger.error(`AI shift swap optimization failed: ${error.message}`);
      return { swaps: swapRequests, optimized: false };
    }
  }

  /**
   * AI-powered vacation planning
   */
  async optimizeVacationPlanning(
    staffId: string,
    preferredDates: { start: Date; end: Date },
    constraints?: any,
  ): Promise<any> {
    try {
      // 1. Analyze team coverage during requested period
      const teamAnalysis = await this.analyzeTeamCoverage(
        preferredDates.start,
        preferredDates.end,
        staffId,
      );
      
      // 2. Find optimal alternative dates using AI
      const optimalDates = await this.findOptimalVacationDates(
        staffId,
        preferredDates,
        constraints,
      );
      
      // 3. Generate recommendations
      const recommendations = this.generateVacationRecommendations(
        teamAnalysis,
        optimalDates,
      );
      
      return {
        original_request: preferredDates,
        optimal_dates: optimalDates,
        team_impact: teamAnalysis,
        recommendations,
      };
      
    } catch (error) {
      this.logger.error(`AI vacation planning failed: ${error.message}`);
      return { error: 'AI service unavailable', dates: preferredDates };
    }
  }

  /**
   * AI-powered skill gap analysis
   */
  async analyzeSkillGaps(department?: string): Promise<any> {
    try {
      // 1. Analyze current skills vs required skills
      const gapAnalysis = await this.performSkillGapAnalysis(department);
      
      // 2. Generate training recommendations using AI
      const trainingPlan = await this.generateAITrainingPlan(gapAnalysis);
      
      // 3. Calculate business impact
      const businessImpact = this.calculateSkillGapImpact(gapAnalysis);
      
      return {
        gaps: gapAnalysis,
        training_plan: trainingPlan,
        business_impact: businessImpact,
        priority_level: this.calculatePriorityLevel(gapAnalysis),
      };
      
    } catch (error) {
      this.logger.error(`AI skill gap analysis failed: ${error.message}`);
      return { error: 'AI service unavailable' };
    }
  }

  // ========== PRIVATE METHODS ==========

  private async prepareStaffProfiles(department?: string): Promise<AIStaffProfile[]> {
    const whereClause = department ? { department, isActive: true } : { isActive: true };
    
    const staff = await this.prisma.staff.findMany({
      where: whereClause,
      include: {
        user: true,
        availabilities: true,
        tasks: {
          where: {
            status: { in: ['pending', 'in_progress'] },
          },
        },
        shifts: {
          where: {
            startTime: {
              gte: moment().startOf('week').toDate(),
              lte: moment().endOf('week').toDate(),
            },
          },
        },
        performanceReviews: {
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return staff.map(s => ({
      staff_id: s.id,
      name: `${s.user.firstName} ${s.user.lastName}`,
      department: s.department,
      skills: s.skills || [],
      experience_level: this.calculateExperienceLevel(s.hireDate),
      preferred_shift: this.determinePreferredShift(s.availabilities),
      max_hours_per_week: s.maxHoursPerWeek || 38,
      hourly_rate: s.hourlyRate || 15,
      performance_score: this.calculatePerformanceScore(s.performanceReviews),
      current_workload: this.calculateCurrentWorkload(s.shifts, s.tasks),
      fatigue_level: this.calculateFatigueLevel(s.shifts),
    }));
  }

  private async prepareShiftRequirements(
    startDate: Date,
    endDate: Date,
    department?: string,
  ): Promise<AIShiftRequirement[]> {
    const whereClause: any = {
      startTime: { gte: startDate },
      endTime: { lte: endDate },
      status: 'scheduled',
    };

    if (department) {
      whereClause.staff = { department };
    }

    const schedules = await this.prisma.schedule.findMany({
      where: whereClause,
      include: {
        staff: {
          include: {
            user: true,
          },
        },
      },
    });

    // Group by time slots and location
    const groupedShifts = this.groupSchedules(schedules);

    return groupedShifts.map((shift, index) => ({
      shift_id: `shift-${index}`,
      department: shift.department,
      required_skills: this.determineRequiredSkills(shift.type, shift.department),
      start_time: shift.startTime.toISOString(),
      end_time: shift.endTime.toISOString(),
      duration_hours: moment(shift.endTime).diff(moment(shift.startTime), 'hours', true),
      min_staff: this.determineMinStaff(shift.type, shift.department),
      optimal_staff: this.determineOptimalStaff(shift.type, shift.department),
      priority: this.determinePriority(shift.type),
      location: shift.location || 'Main Studio',
      complexity_score: this.calculateComplexityScore(shift.type, shift.department),
    }));
  }

  private prepareAustrianConstraints(): any {
    return {
      max_hours_per_week: 38, // Austrian standard
      min_rest_between_shifts: 11, // Austrian law
      max_consecutive_days: 6,
      max_overtime_per_week: 10,
      min_staff_per_shift: {
        yoga: 2,
        spa: 3,
        reception: 1,
        cleaning: 1,
      },
      skill_match_threshold: 0.7,
      fairness_weight: 0.4,
    };
  }

  private async callAIScheduleOptimization(
    staffProfiles: AIStaffProfile[],
    shiftRequirements: AIShiftRequirement[],
    constraints: any,
    optimizationType: string,
  ): Promise<AIOptimizationResult> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.aiServiceUrl}/ai/staff/optimize-schedule`, {
          staff_data: staffProfiles,
          shift_data: shiftRequirements,
          constraints,
          optimization_type: optimizationType,
        }),
      );

      return response.data;
    } catch (error) {
      this.logger.warn('AI service call failed, using fallback');
      throw error;
    }
  }

  private async callAIWorkloadBalancing(
    staffProfiles: AIStaffProfile[],
    currentAssignments: any[],
    timePeriod: string,
  ): Promise<WorkloadBalancingResult> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.aiServiceUrl}/ai/staff/balance-workload`, {
          staff_data: staffProfiles,
          current_assignments: currentAssignments,
          time_period: timePeriod,
        }),
      );

      return response.data;
    } catch (error) {
      this.logger.warn('AI workload balancing service call failed');
      throw error;
    }
  }

  private async callAIPerformancePrediction(
    staffId: string,
    historicalData: any,
    upcomingTasks: any[],
  ): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.aiServiceUrl}/ai/staff/predict-performance/${staffId}`, {
          historical_data: historicalData,
          upcoming_tasks: upcomingTasks,
        }),
      );

      return response.data;
    } catch (error) {
      this.logger.warn('AI performance prediction service call failed');
      throw error;
    }
  }

  private async callAIShiftSwapOptimization(
    swapRequests: any[],
    staffProfiles: AIStaffProfile[],
    currentSchedule: any,
  ): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.aiServiceUrl}/ai/staff/optimize-shift-swaps`, {
          swap_requests: swapRequests,
          staff_data: staffProfiles,
          current_schedule: currentSchedule,
        }),
      );

      return response.data;
    } catch (error) {
      this.logger.warn('AI shift swap optimization service call failed');
      throw error;
    }
  }

  private async applyAIRecommendations(
    aiResult: AIOptimizationResult,
    staffProfiles: AIStaffProfile[],
    shiftRequirements: AIShiftRequirement[],
  ): Promise<void> {
    // Apply AI recommendations to the database
    for (const assignment of aiResult.assignments) {
      if (assignment.fallback) continue;

      const staff = staffProfiles[assignment.staff_index];
      const shift = shiftRequirements[assignment.shift_index];

      try {
        // Create or update schedule in database
        await this.prisma.schedule.upsert({
          where: {
            // Use unique identifier if exists
            id: shift.shift_id || `ai-${Date.now()}-${assignment.staff_index}`,
          },
          update: {
            staffId: staff.staff_id,
            startTime: new Date(shift.start_time),
            endTime: new Date(shift.end_time),
            status: 'scheduled',
            type: 'ai_optimized',
            location: shift.location,
            metadata: {
              ai_optimization: {
                optimization_id: aiResult.optimization_id,
                suitability_score: assignment.suitability,
                assignment_cost: assignment.assignment_cost,
                generated_at: aiResult.generated_at,
              },
            },
          },
          create: {
            id: shift.shift_id || `ai-${Date.now()}-${assignment.staff_index}`,
            staffId: staff.staff_id,
            startTime: new Date(shift.start_time),
            endTime: new Date(shift.end_time),
            status: 'scheduled',
            type: 'ai_optimized',
            location: shift.location,
            createdBy: 'ai_scheduler',
            metadata: {
              ai_optimization: {
                optimization_id: aiResult.optimization_id,
                suitability_score: assignment.suitability,
                assignment_cost: assignment.assignment_cost,
                generated_at: aiResult.generated_at,
              },
            },
          },
        });
      } catch (error) {
        this.logger.error(`Failed to apply AI recommendation: ${error.message}`);
      }
    }

    // Log optimization results
    await this.prisma.aiOptimizationLog.create({
      data: {
        optimizationId: aiResult.optimization_id,
        type: 'schedule_optimization',
        status: aiResult.status,
        metrics: aiResult.metrics,
        constraintsViolations: aiResult.constraints_violations,
        recommendations: aiResult.recommendations,
        inputData: {
          staff_count: staffProfiles.length,
          shift_count: shiftRequirements.length,
        },
        outputData: {
          assignments_count: aiResult.assignments.length,
        },
      },
    });
  }

  // ========== HELPER METHODS ==========

  private calculateExperienceLevel(hireDate: Date): string {
    const years = moment().diff(moment(hireDate), 'years');
    
    if (years < 1) return 'beginner';
    if (years < 3) return 'intermediate';
    if (years < 5) return 'advanced';
    return 'expert';
  }

  private determinePreferredShift(availabilities: any[]): string {
    if (!availabilities || availabilities.length === 0) {
      return 'flexible';
    }

    // Analyze availability patterns
    const morningCount = availabilities.filter(a => 
      parseInt(a.startTime?.split(':')[0] || '0') < 12
    ).length;
    
    const afternoonCount = availabilities.filter(a => {
      const hour = parseInt(a.startTime?.split(':')[0] || '0');
      return hour >= 12 && hour < 18;
    }).length;
    
    const eveningCount = availabilities.filter(a => {
      const hour = parseInt(a.startTime?.split(':')[0] || '0');
      return hour >= 18;
    }).length;

    const maxCount = Math.max(morningCount, afternoonCount, eveningCount);
    
    if (maxCount === morningCount) return 'morning';
    if (maxCount === afternoonCount) return 'afternoon';
    if (maxCount === eveningCount) return 'evening';
    
    return 'flexible';
  }

  private calculatePerformanceScore(reviews: any[]): number {
    if (!reviews || reviews.length === 0) return 0.7; // Default neutral score
    
    const averageRating = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
    return averageRating / 5; // Normalize to 0-1
  }

  private calculateCurrentWorkload(shifts: any[], tasks: any[]): number {
    const shiftHours = shifts.reduce((total, shift) => {
      const duration = moment(shift.endTime).diff(moment(shift.startTime), 'hours', true);
      return total + duration;
    }, 0);

    const taskHours = tasks.reduce((total, task) => {
      return total + (task.estimatedHours || 0);
    }, 0);

    return shiftHours + (taskHours * 0.5); // Tasks count as half weight
  }

  private calculateFatigueLevel(shifts: any[]): number {
    if (!shifts || shifts.length === 0) return 0;

    // Calculate fatigue based on recent work intensity
    const recentShifts = shifts.filter(s => 
      moment(s.startTime).isAfter(moment().subtract(7, 'days'))
    );

    if (recentShifts.length === 0) return 0;

    const totalHours = recentShifts.reduce((total, shift) => {
      const duration = moment(shift.endTime).diff(moment(shift.startTime), 'hours', true);
      return total + duration;
    }, 0);

    const consecutiveDays = this.calculateConsecutiveDays(recentShifts);
    
    // Normalize to 0-1 scale
    const hourFatigue = Math.min(totalHours / 50, 1); // 50 hours in a week is max
    const consecutiveFatigue = Math.min(consecutiveDays / 7, 1);
    
    return (hourFatigue * 0.6 + consecutiveFatigue * 0.4);
  }

  private calculateConsecutiveDays(shifts: any[]): number {
    if (shifts.length === 0) return 0;

    const dates = shifts.map(s => moment(s.startTime).format('YYYY-MM-DD'));
    const uniqueDates = [...new Set(dates)].sort();
    
    let maxConsecutive = 1;
    let currentConsecutive = 1;

    for (let i = 1; i < uniqueDates.length; i++) {
      const prevDate = moment(uniqueDates[i - 1]);
      const currDate = moment(uniqueDates[i]);
      
      if (currDate.diff(prevDate, 'days') === 1) {
        currentConsecutive++;
        maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
      } else {
        currentConsecutive = 1;
      }
    }

    return maxConsecutive;
  }

  private groupSchedules(schedules: any[]): any[] {
    // Group schedules by time slots (within 2 hours) and location
    const groups: any[] = [];
    
    for (const schedule of schedules) {
      const existingGroup = groups.find(g => 
        Math.abs(moment(g.startTime).diff(moment(schedule.startTime), 'hours')) <= 2 &&
        g.location === schedule.location &&
        g.type === schedule.type
      );

      if (existingGroup) {
        existingGroup.count = (existingGroup.count || 1) + 1;
        existingGroup.staffIds = [...new Set([...(existingGroup.staffIds || []), schedule.staffId])];
      } else {
        groups.push({
          ...schedule,
          count: 1,
          staffIds: [schedule.staffId],
        });
      }
    }

    return groups;
  }

  private determineRequiredSkills(type: string, department: string): string[] {
    const skillMap: Record<string, string[]> = {
      yoga: ['Vinyasa', 'Hatha', 'Meditation', 'Anatomy'],
      spa: ['Massage', 'Aromatherapy', 'Skincare', 'Relaxation'],
      reception: ['Customer Service', 'Communication', 'Organization', 'Multi-tasking'],
      cleaning: ['Attention to Detail', 'Time Management', 'Cleaning Techniques'],
    };

    return skillMap[department.toLowerCase()] || ['General'];
  }

  private determineMinStaff(type: string, department: string): number {
    const minStaffMap: Record<string, number> = {
      yoga: 2,
      spa: 3,
      reception: 1,
      cleaning: 1,
    };

    return minStaffMap[department.toLowerCase()] || 1;
  }

  private determineOptimalStaff(type: string, department: string): number {
    const optimalStaffMap: Record<string, number> = {
      yoga: 3,
      spa: 4,
      reception: 2,
      cleaning: 2,
    };

    return optimalStaffMap[department.toLowerCase()] || 2;
  }

  private determinePriority(type: string): string {
    const priorityMap: Record<string, string> = {
      'morning_shift': 'high',
      'peak_hours': 'critical',
      'training': 'medium',
      'meeting': 'low',
    };

    return priorityMap[type] || 'medium';
  }

  private calculateComplexityScore(type: string, department: string): number {
    const complexityMap: Record<string, number> = {
      yoga: 0.7,
      spa: 0.8,
      reception: 0.6,
      cleaning: 0.4,
    };

    return complexityMap[department.toLowerCase()] || 0.5;
  }

  // ========== FALLBACK METHODS ==========

  private fallbackOptimization(
    startDate: Date,
    endDate: Date,
    department?: string,
  ): AIOptimizationResult {
    this.logger.log('Using fallback optimization algorithm');
    
    // Simple round-robin fallback
    return {
      optimization_id: `fallback-${Date.now()}`,
      status: 'partial',
      assignments: [],
      metrics: {
        coverage_percentage: 0,
        avg_suitability_score: 0,
        workload_fairness: 0,
        skill_utilization_percentage: 0,
        preference_satisfaction: 0,
        total_assignments: 0,
        unassigned_shifts: 0,
        avg_hours_per_staff: 0,
        workload_std_dev: 0,
      },
      constraints_violations: ['AI service unavailable'],
      recommendations: ['Use manual scheduling until AI service is restored'],
      generated_at: new Date().toISOString(),
    };
  }

  private fallbackWorkloadBalance(department?: string): WorkloadBalancingResult {
    return {
      balance_id: `fallback-${Date.now()}`,
      staff_distribution: {},
      imbalance_score: 1.0,
      redistribution_plan: [],
      predicted_burnout_risk: {},
      improvement_suggestions: ['AI service unavailable - use manual workload monitoring'],
    };
  }

  private fallbackPerformancePrediction(staffId: string): any {
    return {
      staff_id: staffId,
      predicted_performance: {
        next_week: 0.5,
        next_month: 0.5,
        trend: 'unknown',
      },
      risk_assessment: {
        burnout_risk: 'unknown',
        attrition_risk: 'unknown',
      },
      confidence_score: 0.1,
      recommendations: ['AI service unavailable - use manual assessment'],
      fallback: true,
    };
  }

  // ========== DATABASE QUERIES ==========

  private async getCurrentAssignments(department?: string): Promise<any[]> {
    const whereClause: any = {
      status: { in: ['scheduled', 'in_progress'] },
      startTime: { gte: moment().startOf('week').toDate() },
    };

    if (department) {
      whereClause.staff = { department };
    }

    const schedules = await this.prisma.schedule.findMany({
      where: whereClause,
      include: {
        staff: {
          select: {
            id: true,
            userId: true,
            department: true,
          },
        },
      },
    });

    return schedules.map(s => ({
      staff_id: s.staffId,
      schedule_id: s.id,
      start_time: s.startTime,
      end_time: s.endTime,
      duration_hours: moment(s.endTime).diff(moment(s.startTime), 'hours', true),
      type: s.type,
      priority_score: this.determinePriorityScore(s.type),
    }));
  }

  private async getHistoricalPerformanceData(staffId: string): Promise<any> {
    const [reviews, completedTasks, attendance] = await Promise.all([
      this.prisma.performanceReview.findMany({
        where: { staffId },
        orderBy: { createdAt: '