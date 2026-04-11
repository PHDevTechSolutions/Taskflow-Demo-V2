-- Create RPC function to update history timestamps without triggering date_updated
CREATE OR REPLACE FUNCTION update_history_time_preserve_updated(
    record_id INTEGER,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE
)
RETURNS TABLE(id INTEGER) AS $$
DECLARE
    original_date_updated TIMESTAMP WITH TIME ZONE;
    trigger_disabled BOOLEAN;
BEGIN
    -- Get the original date_updated value
    SELECT date_updated INTO original_date_updated
    FROM history
    WHERE id = record_id;
    
    -- Check if record exists
    IF original_date_updated IS NULL THEN
        RAISE EXCEPTION 'Record not found';
    END IF;
    
    -- Temporarily disable triggers for this session
    SET session_replication_role = replica;
    
    -- Update the record without triggers
    UPDATE history 
    SET 
        start_date = start_date,
        end_date = end_date,
        date_updated = original_date_updated
    WHERE id = record_id
    RETURNING id;
    
    -- Re-enable triggers
    SET session_replication_role = DEFAULT;
    
    RETURN QUERY SELECT record_id AS id;
EXCEPTION
    WHEN OTHERS THEN
        -- Make sure triggers are re-enabled even on error
        SET session_replication_role = DEFAULT;
        RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
