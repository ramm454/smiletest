import { PartialType } from '@nestjs/mapped-types';
import { CreateBookingDto } from './create-booking.dto';
import { IsEnum, IsOptional } from 'class-validator';

export class UpdateBookingDto extends PartialType(CreateBookingDto) {
  @IsOptional()
  @IsEnum(['PENDING', 'CONFIRMED', 'CANCELLED', 'NO_SHOW', 'COMPLETED', 'RESCHEDULED'])
  status?: string;

  @IsOptional()
  @IsEnum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED'])
  paymentStatus?: string;
}