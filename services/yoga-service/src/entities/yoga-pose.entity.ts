import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('yoga_poses')
export class YogaPose {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  sanskritName: string;

  @Column()
  category: string; // standing, sitting, inversion, balancing, etc.

  @Column()
  difficulty: string; // beginner, intermediate, advanced

  @Column('text', { array: true })
  benefits: string[];

  @Column('text', { array: true, nullable: true })
  contraindications: string[];

  @Column('text', { nullable: true })
  instructions: string;

  @Column({ nullable: true })
  duration: number; // Suggested hold time in seconds

  @Column({ nullable: true })
  imageUrl: string;

  @Column({ nullable: true })
  videoUrl: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}