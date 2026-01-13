import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { Booking } from './booking.entity';

@Entity('recurring_bookings')
export class RecurringBooking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({ nullable: true })
  classId: string;

  @Column({ nullable: true })
  sessionId: string;

  @Column({ nullable: true })
  productId: string;

  @Column()
  firstOccurrence: Date;

  @Column()
  duration: number; // minutes

  @Column({ type: 'varchar' })
  recurrenceType: string; // DAILY, WEEKLY, BIWEEKLY, MONTHLY, CUSTOM

  @Column({ nullable: true })
  repeatEvery: number;

  @Column('simple-array', { nullable: true })
  daysOfWeek: string[];

  @Column({ nullable: true, type: 'text' })
  customRule: string;

  @Column({ nullable: true })
  endDate: Date;

  @Column({ nullable: true })
  occurrenceCount: number;

  @Column('simple-array', { nullable: true })
  excludeDates: string[];

  @Column({ default: 1 })
  participants: number;

  @Column('simple-array', { nullable: true })
  participantNames: string[];

  @Column('simple-array', { nullable: true })
  guestEmails: string[];

  @Column({ type: 'varchar', default: 'ACTIVE' })
  status: string; // ACTIVE, PAUSED, CANCELLED, COMPLETED

  @Column({ nullable: true })
  pauseUntil: Date;

  @Column('simple-array', { nullable: true })
  skipOccurrences: string[];

  @Column({ nullable: true })
  cancellationReason: string;

  @Column({ nullable: true })
  notes: string;

  @Column({ nullable: true })
  specialRequests: string;

  @Column({ type: 'varchar', default: 'WEB' })
  source: string;

  @Column({ default: 0 })
  generatedCount: number;

  @Column({ default: 0 })
  cancelledCount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  basePrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0.0 })
  discount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  totalAmount: number;

  @Column({ type: 'varchar', default: 'USD' })
  currency: string;

  @Column({ nullable: true })
  paymentPlanId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @OneToMany(() => Booking, (booking) => booking.recurringBooking)
  bookings: Booking[];
}