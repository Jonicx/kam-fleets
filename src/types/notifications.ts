export type NotificationCategory =
  | 'pending_account'
  | 'missing_invoice'
  | 'delay'
  | 'budget_exceeded'
  | 'overdue_invoice';

export interface AdminNotification {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  entity_type: 'team_member' | 'trip' | 'invoice';
  entity_id: string;
  created_at: string;
  resolved_at: string | null;
  read_at: string | null;
}
