import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { CertificationEnrollment } from './certification-enrollment.entity';

@Entity('certifications')
export class Certification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column('text')
  description: string;

  @Column()
  type: string; // yoga_alliance, inhouse, international

  @Column()
  durationHours: number;

  @Column('text', { array: true })
  modules: string[];

  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  @Column('text', { nullable: true })
  prerequisites: string;

  @Column({ nullable: true })
  startDate: Date;

  @Column({ nullable: true })
  endDate: Date;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  certificationCode: string;

  @Column({ default: 0 })
  enrolledCount: number;

  @Column({ default: 0 })
  completedCount: number;

  @OneToMany(() => CertificationEnrollment, enrollment => enrollment.certification)
  enrollments: CertificationEnrollment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('certification_enrollments')
export class CertificationEnrollment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  certificationId: string;

  @Column()
  userId: string;

  @Column()
  instructorId: string;

  @Column({ default: 'pending' })
  status: string; // pending, active, completed, cancelled

  @Column({ nullable: true })
  enrolledDate: Date;

  @Column({ nullable: true })
  completedDate: Date;

  @Column('jsonb', { nullable: true })
  progress: Record<string, number>; // moduleId -> progress percentage

  @Column({ default: 0 })
  overallProgress: number;

  @Column({ nullable: true })
  certificateUrl: string;

  @ManyToOne(() => Certification, certification => certification.enrollments)
  certification: Certification;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}