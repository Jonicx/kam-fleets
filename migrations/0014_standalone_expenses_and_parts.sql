ALTER TABLE expenses ALTER COLUMN trip_id DROP NOT NULL;
ALTER TABLE spare_parts ALTER COLUMN trip_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION lock_completed_trip() RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status = 'Completed' AND NOT app_locks_bypassed() THEN
        IF (to_jsonb(OLD) - ARRAY['final_profit_loss', 'total_expenses_cost', 'total_spare_parts_cost', 'financial_flag', 'updated_at'])
           IS DISTINCT FROM
           (to_jsonb(NEW) - ARRAY['final_profit_loss', 'total_expenses_cost', 'total_spare_parts_cost', 'financial_flag', 'updated_at']) THEN
            RAISE EXCEPTION 'Trip % is completed and locked', OLD.id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION lock_completed_trip_children() RETURNS TRIGGER AS $$
DECLARE
    target_trip UUID;
BEGIN
    IF app_locks_bypassed() THEN
        RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
    END IF;

    IF TG_OP <> 'DELETE' AND TG_TABLE_NAME IN ('expenses', 'spare_parts') THEN
        RETURN NEW;
    END IF;

    target_trip := CASE WHEN TG_OP = 'DELETE' THEN OLD.trip_id ELSE NEW.trip_id END;
    IF EXISTS (SELECT 1 FROM trips WHERE id = target_trip AND status = 'Completed') THEN
        RAISE EXCEPTION 'Trip % is completed; % records are locked', target_trip, TG_TABLE_NAME;
    END IF;
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;
