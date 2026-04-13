-- Function to update time by temporarily disabling triggers
CREATE OR REPLACE FUNCTION update_time_only(
    p_id INTEGER,
    p_start_date TIMESTAMP WITH TIME ZONE,
    p_end_date TIMESTAMP WITH TIME ZONE
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Disable all triggers on history table
    ALTER TABLE history DISABLE TRIGGER ALL;
    
    -- Update only the timestamp fields
    UPDATE history 
    SET start_date = p_start_date,
        end_date = p_end_date
    WHERE id = p_id;
    
    -- Re-enable all triggers
    ALTER TABLE history ENABLE TRIGGER ALL;
    
    RETURN FOUND;
EXCEPTION
    WHEN OTHERS THEN
        -- Make sure triggers are re-enabled even on error
        ALTER TABLE history ENABLE TRIGGER ALL;
        RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
