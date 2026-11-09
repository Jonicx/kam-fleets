ALTER TABLE trips
    ADD COLUMN IF NOT EXISTS start_mileage INTEGER,
    ADD COLUMN IF NOT EXISTS end_mileage INTEGER;

ALTER TABLE trips
    ADD CONSTRAINT chk_trips_mileage_nonnegative
        CHECK (
            (start_mileage IS NULL OR start_mileage >= 0)
            AND (end_mileage IS NULL OR end_mileage >= 0)
            AND (
                start_mileage IS NULL
                OR end_mileage IS NULL
                OR end_mileage >= start_mileage
            )
        );
