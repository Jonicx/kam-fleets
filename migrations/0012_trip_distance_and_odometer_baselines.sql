SET LOCAL app.bypass_locks = 'on';

ALTER TABLE trucks
    ADD COLUMN IF NOT EXISTS total_distance_traveled INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS odometer_baseline_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS odometer_baseline_mileage INTEGER;

ALTER TABLE drivers
    ADD COLUMN IF NOT EXISTS total_distance_traveled INTEGER NOT NULL DEFAULT 0;

ALTER TABLE trips
    ADD COLUMN IF NOT EXISTS distance_traveled INTEGER,
    ADD COLUMN IF NOT EXISTS odometer_repair_required BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE trucks
SET odometer_baseline_date = COALESCE(odometer_baseline_date, CURRENT_TIMESTAMP),
    odometer_baseline_mileage = COALESCE(odometer_baseline_mileage, current_mileage, 0);

UPDATE trips
SET distance_traveled = end_mileage - start_mileage,
    odometer_repair_required = FALSE
WHERE status = 'Completed'
  AND distance_traveled IS NULL
  AND start_mileage IS NOT NULL
  AND end_mileage IS NOT NULL
  AND end_mileage > start_mileage;

UPDATE trips
SET distance_traveled = NULL,
    odometer_repair_required = TRUE
WHERE status = 'Completed'
  AND (distance_traveled IS NULL OR distance_traveled <= 0);

UPDATE trucks AS truck
SET total_distance_traveled = (
    SELECT COALESCE(SUM(trip.distance_traveled), 0)
    FROM trips AS trip
    WHERE trip.truck_id = truck.id
      AND trip.status = 'Completed'
      AND trip.distance_traveled > 0
);

UPDATE drivers AS driver
SET total_distance_traveled = (
    SELECT COALESCE(SUM(trip.distance_traveled), 0)
    FROM trips AS trip
    WHERE trip.driver_id = driver.id
      AND trip.status = 'Completed'
      AND trip.distance_traveled > 0
);

DO $migration$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_trucks_total_distance_nonnegative') THEN
        ALTER TABLE trucks ADD CONSTRAINT chk_trucks_total_distance_nonnegative
            CHECK (total_distance_traveled >= 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_trucks_odometer_baseline_nonnegative') THEN
        ALTER TABLE trucks ADD CONSTRAINT chk_trucks_odometer_baseline_nonnegative
            CHECK (odometer_baseline_mileage IS NULL OR odometer_baseline_mileage >= 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_drivers_total_distance_nonnegative') THEN
        ALTER TABLE drivers ADD CONSTRAINT chk_drivers_total_distance_nonnegative
            CHECK (total_distance_traveled >= 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_trips_distance_positive_or_null') THEN
        ALTER TABLE trips ADD CONSTRAINT chk_trips_distance_positive_or_null
            CHECK (distance_traveled IS NULL OR distance_traveled > 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_completed_trip_distance_or_repair') THEN
        ALTER TABLE trips ADD CONSTRAINT chk_completed_trip_distance_or_repair
            CHECK (status <> 'Completed' OR distance_traveled > 0 OR odometer_repair_required);
    END IF;
END;
$migration$;
