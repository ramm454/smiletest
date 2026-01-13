import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne } from 'typeorm';
import { SequencePose } from './sequence-pose.entity';
import { Instructor } from './instructor.entity';

@Entity('class_sequences')
export class ClassSequence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column('text')
  description: string;

  @Column()
  type: string; // morning, evening, energizing, relaxing, etc.

  @Column()
  difficulty: string;

  @Column()
  totalDuration: number; // minutes

  @Column({ nullable: true })
  focusArea: string;

  @Column({ default: false })
  isTemplate: boolean;

  @Column({ nullable: true })
  instructorId: string;

  @ManyToOne(() => Instructor)
  instructor: Instructor;

  @OneToMany(() => SequencePose, sequencePose => sequencePose.sequence, { cascade: true })
  poses: SequencePose[];

  @Column({ default: 0 })
  usageCount: number;

  @Column({ default: 0 })
  averageRating: number;

  @Column({ default: true })
  isPublic: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('sequence_poses')
export class SequencePose {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  sequenceId: string;

  @Column()
  poseId: string;

  @Column()
  order: number;

  @Column()
  duration: number; // seconds

  @Column({ nullable: true })
  transitionInstructions: string;

  @Column({ nullable: true })
  breathPattern: string;

  @Column({ nullable: true })
  notes: string;

  @ManyToOne(() => ClassSequence, sequence => sequence.poses)
  sequence: ClassSequence;
}