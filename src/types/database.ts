export type TruckStatus = 'Available' | 'On Trip' | 'Maintenance';
export type DriverStatus = 'Available' | 'On Trip' | 'Off Duty';
export type TripStatus = 'Planned' | 'Ongoing' | 'Completed';
export type ExpenseType = 'Fuel' | 'Tolls' | 'Police/Bribes' | 'Food' | 'Other';

export interface DelayLog {
  id: string;
  trip_id: string;
  reason: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  location?: string;
  duration_minutes?: number;
  timestamp: string; // ISO 8601
}

export interface Truck {
  id: string;
  license_plate: string;
  model: string;
  status: TruckStatus;
  year?: number;
  capacity_tons?: number;
  current_mileage?: number;
  created_at: string;
  updated_at: string;
}

export type TruckServiceType = 'Service' | 'Spare Part';

export interface TruckServiceRecord {
  id: string;
  truck_id: string;
  record_type: TruckServiceType;
  item_name: string;
  price: number;
  mechanic_name: string;
  service_location: string;
  timestamp: string;
  created_at: string;
}

export interface Driver {
  id: string;
  full_name: string;
  license_number: string;
  phone: string;
  status: DriverStatus;
  experience_years?: number;
  created_at: string;
  updated_at: string;
}

export interface Trip {
  id: string;
  truck_id: string;
  driver_id: string;
  status: TripStatus;
  origin: string;
  destination: string;
  scheduled_start: string; // ISO 8601
  scheduled_end: string;   // ISO 8601
  budget_allocated: number; // Planned trip budget estimate, not invoiced revenue
  driver_pay: number;      // Driver compensation for this trip instance
  cargo_type?: string;
  notes?: string;
  delay_logs: DelayLog[]; // Dynamic delay reasons with timestamps
  final_profit_loss?: number;       // Legacy field: budget estimate minus final trip costs; not accounting profit
  total_expenses_cost?: number;     // Final Total Expenses
  total_spare_parts_cost?: number;  // Final Total Spare Parts Cost
  financial_flag?: 'Profitable' | 'Loss'; // Legacy persisted flag for positive/negative budget variance
  completed_at?: string;            // ISO 8601 when completed
  created_at: string;
  updated_at: string;
}

export interface InitialExpenseInput {
  expense_type: ExpenseType;
  amount: number;
  description: string;
}

export interface InitialSparePartInput {
  part_name: string;
  price: number;
  description?: string;
}

export interface CreateTripPayload {
  truck_id: string;
  driver_id: string;
  origin: string;
  destination: string;
  scheduled_start: string;
  scheduled_end: string;
  budget_allocated: number;
  driver_pay: number;
  cargo_type?: string;
  notes?: string;
  initial_expenses?: InitialExpenseInput[];
  initial_spare_parts?: InitialSparePartInput[];
}

export interface Expense {
  id: string;
  trip_id: string;
  expense_type: ExpenseType;
  amount: number;
  description: string;
  timestamp: string; // ISO 8601
  created_at: string;
}

export interface SparePart {
  id: string;
  trip_id: string;
  part_name: string;
  price: number;
  description: string;
  timestamp: string; // ISO 8601 - when maintenance was needed during trip
  replaced_by?: string;
  created_at: string;
}

export interface Invoice {
  id: string;
  trip_id?: string;
  driver_id?: string; // TEXT to match app_users.user_id
  invoice_number: string;
  amount: number;
  issued_at: string;
  due_at: string;
  reason?: string;
  created_at: string;
  voided_at?: string;
  void_reason?: string;
}

export type PaymentMethod = 'Cash' | 'Bank transfer' | 'Mobile money' | 'Cheque' | 'Other';

export interface Payment {
  id: string;
  invoice_id: string;
  amount: number;
  method: PaymentMethod;
  paid_at: string;
  reference?: string;
  notes?: string;
  created_at: string;
  reversed_at?: string;
  reversal_reason?: string;
}

export type AuditEntityType =
  | 'trip'
  | 'expense'
  | 'spare part'
  | 'truck service'
  | 'invoice'
  | 'payment'
  | 'audit settings'
  | 'database'
  | 'truck'
  | 'driver'
  | 'team member';

export interface AuditLog {
  id: string;
  actor: string;
  action: string;
  entity_type: AuditEntityType;
  entity_id: string;
  related_trip_id?: string;
  summary: string;
  details?: string;
  timestamp: string;
}

// Joined View Models for UI and analytics
export interface EnrichedTrip extends Trip {
  truck?: Truck;
  driver?: Driver;
  expenses: Expense[];
  spare_parts: SparePart[];
  total_expenses: number;
  total_spare_parts: number;
  total_spent: number;
  remaining_budget: number;
  budget_utilization_pct: number;
  is_over_budget: boolean;
  profit_loss: number;
  financial_flag?: 'Profitable' | 'Loss';
}

export interface DatabaseStats {
  totalTrucks: number;
  availableTrucks: number;
  onTripTrucks: number;
  maintenanceTrucks: number;
  totalDrivers: number;
  availableDrivers: number;
  totalTrips: number;
  ongoingTrips: number;
  completedTrips: number;
  plannedTrips: number;
  totalBudgetAllocated: number;
  totalActualExpenses: number;
  totalSparePartsCost: number;
  budgetLessExpensesAndParts: number;
  totalFinalizedBudgetVariance: number;
  withinBudgetTripsCount: number;
  overBudgetTripsCount: number;
}
