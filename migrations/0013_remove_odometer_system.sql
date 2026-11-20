SET LOCAL app.bypass_locks = 'on';

-- Drop odometer-related constraints
ALTER TABLE trips DROP CONSTRAINT IF EXISTS chk_completed_trip_distance_or_repair;
ALTER TABLE trucks DROP CONSTRAINT IF EXISTS chk_trucks_odometer_baseline_nonnegative;

-- Drop odometer columns from trucks
ALTER TABLE trucks
    DROP COLUMN IF EXISTS current_mileage,
    DROP COLUMN IF EXISTS odometer_baseline_date,
    DROP COLUMN IF EXISTS odometer_baseline_mileage;

-- Drop odometer columns from trips
ALTER TABLE trips
    DROP COLUMN IF EXISTS start_mileage,
    DROP COLUMN IF EXISTS end_mileage,
    DROP COLUMN IF EXISTS odometer_repair_required;
