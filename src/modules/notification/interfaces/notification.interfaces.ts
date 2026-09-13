import { IsInt, IsPositive } from 'class-validator';

export interface NotificationPayload {
  id: number;
  user_id: number;
  title: string;
  description: string | null;
  is_read: boolean;
  is_active: boolean;
  scheduled_at: Date | null;
  reference: string | null;
  created_at: Date;
}

export class MarkReadPayload {
  @IsInt()
  @IsPositive()
  notification_id!: number;
}

export class SubscribePayload {
  @IsInt()
  @IsPositive()
  user_id!: number;
}
