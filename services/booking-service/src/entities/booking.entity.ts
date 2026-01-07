import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('bookings')
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({ nullable: true })
  classId: string;

  @Column({ nullable: true })
  sessionId: string;

  @Column({ type: 'varchar' })
  type: string; // 'yoga-class', 'live-session', etc.

  @Column()
  startTime: Date;

  @Column()
  endTime: Date;

  @Column({ default: 1 })
  participants: number;

  @Column({ type: 'varchar', default: 'confirmed' })
  status: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  totalAmount: number;

  @Column({ type: 'varchar', default: 'USD' })
  currency: string;

  @Column({ nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}