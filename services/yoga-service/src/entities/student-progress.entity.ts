import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('student_practice_logs')
@Index(['userId', 'practiceDate'])
export class StudentPracticeLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({ nullable: true })
  classId: string;

  @Column({ nullable: true })
  sequenceId: string;

  @Column()
  duration: number; // minutes

  @Column()
  practiceType: string; // yoga, meditation, pranayama

  @Column({ nullable: true })
  focusArea: string;

  @Column({ nullable: true })
  caloriesBurned: number;

  @Column({ nullable: true })
  heartRateAvg: number;

  @Column('text', { array: true, nullable: true })
  posesPracticed: string[];

  @Column('text', { nullable: true })
  notes: string;

  @Column()
  practiceDate: Date;

  @Column({ default: 0 })
  moodRating: number; // 1-5

  @Column({ default: 0 })
  energyLevel: number; // 1-5

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('student_goals')
export class StudentGoal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  goalType: string; // flexibility, strength, weight_loss, stress_reduction

  @Column('text')
  target: string;

  @Column({ nullable: true })
  targetDate: Date;

  @Column({ default: 0 })
  currentProgress: number;

  @Column({ default: 'active' })
  status: string; // active, completed, abandoned

  @Column('jsonb', { nullable: true })
  milestones: Array<{
    description: string;
    targetDate: Date;
    completed: boolean;
    completedDate?: Date;
  }>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('pose_progress')
@Index(['userId', 'poseId'])
export class PoseProgress {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  poseId: string;

  @Column({ default: 0 })
  practiceCount: number;

  @Column({ default: 0 })
  totalDuration: number; // seconds

  @Column({ default: 0 })
  comfortLevel: number; // 1-5

  @Column({ default: false })
  mastered: boolean;

  @Column({ nullable: true })
  masteredDate: Date;

  @Column('jsonb', { nullable: true })
  notes: Array<{
    date: Date;
    note: string;
    improvement: number;
  }>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}