import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Booking } from './booking.entity';

@Entity('group_bookings')
export class GroupBooking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({ nullable: true })
  classId: string;

  @Column({ nullable: true })
  sessionId: string;

  @Column()
  startTime: Date;

  @Column()
  endTime: Date;

  @Column({ default: 'UTC' })
  timezone: string;

  @Column()
  groupName: string;

  @Column({ type: 'varchar', default: 'PER_PERSON' })
  pricingType: string; // FIXED, PER_PERSON, TIERED

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  groupPrice: number;

  @Column({ default: 2 })
  minParticipants: number;

  @Column({ nullable: true })
  maxParticipants: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  discountPercentage: number;

  @Column({ type: 'varchar', default: 'PENDING' })
  status: string; // PENDING, CONFIRMED, CANCELLED, PARTIAL, COMPLETED

  @Column({ type: 'varchar', default: 'WEB' })
  source: string;

  @Column({ nullable: true })
  notes: string;

  @Column({ nullable: true })
  specialRequests: string;

  @Column({ default: false })
  requireAllPayment: boolean;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  totalAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amountPaid: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amountDue: number;

  @Column({ default: 0 })
  confirmedMembers: number;

  @Column({ default: 0 })
  pendingMembers: number;

  @Column({ default: 0 })
  cancelledMembers: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  invitationToken: string;

  @Column({ nullable: true })
  invitationExpiresAt: Date;

  @Column({ nullable: true })
  reminderSentAt: Date;

  // Relations
  @OneToMany(() => GroupMember, (member) => member.groupBooking)
  members: GroupMember[];

  @OneToMany(() => Booking, (booking) => booking.groupBooking)
  bookings: Booking[];
}

@Entity('group_members')
export class GroupMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  groupBookingId: string;

  @Column()
  email: string;

  @Column({ nullable: true })
  firstName: string;

  @Column({ nullable: true })
  lastName: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  userId: string;

  @Column({ type: 'varchar', default: 'INVITED' })
  status: string; // INVITED, CONFIRMED, DECLINED, CANCELLED, WAITLIST

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amountPaid: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amountDue: number;

  @Column({ default: false })
  isPrimary: boolean;

  @Column({ nullable: true })
  invitationToken: string;

  @Column({ nullable: true })
  invitedAt: Date;

  @Column({ nullable: true })
  respondedAt: Date;

  @Column({ nullable: true })
  paymentCompletedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  bookingId: string;

  @ManyToOne(() => GroupBooking, (groupBooking) => groupBooking.members)
  @JoinColumn({ name: 'groupBookingId' })
  groupBooking: GroupBooking;

  @OneToOne(() => Booking, (booking) => booking.groupMember)
  @JoinColumn({ name: 'bookingId' })
  booking: Booking;
}