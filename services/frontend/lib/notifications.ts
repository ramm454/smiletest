const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

export interface Notification {
  id: string;
  type: 'email' | 'sms' | 'push' | 'whatsapp' | 'in_app';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  metadata?: any;
}

export interface NotificationPreferences {
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  whatsappEnabled: boolean;
  inAppEnabled: boolean;
  dndEnabled: boolean;
  dndStart: string;
  dndEnd: string;
  bookingAlerts: boolean;
  paymentAlerts: boolean;
  classReminders: boolean;
  promotional: boolean;
  systemAlerts: boolean;
}

export async function getNotifications(): Promise<{ notifications: Notification[]; unreadCount: number }> {
  const response = await fetch(`${API_BASE_URL}/notifications`);
  if (!response.ok) throw new Error('Failed to fetch notifications');
  return response.json();
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const response = await fetch(`${API_BASE_URL}/notifications/preferences`);
  if (!response.ok) throw new Error('Failed to fetch preferences');
  return response.json();
}

export async function updatePreferences(preferences: NotificationPreferences): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/notifications/preferences`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(preferences),
  });
  if (!response.ok) throw new Error('Failed to update preferences');
}

export async function markAsRead(notificationId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/notifications/${notificationId}/read`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Failed to mark as read');
}

export async function clearAllNotifications(): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/notifications/clear`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Failed to clear notifications');
}

export async function sendTestNotification(type: 'email' | 'sms' | 'push'): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/notifications/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type }),
  });
  if (!response.ok) throw new Error('Failed to send test notification');
}