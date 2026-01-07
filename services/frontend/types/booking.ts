export interface Booking {
  id: string;
  userId: string;
  serviceType: string;
  className: string;
  dateTime: string;
  participants: number;
  status: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}