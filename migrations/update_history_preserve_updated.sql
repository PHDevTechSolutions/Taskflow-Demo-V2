-- Create RPC function to update history record without changing date_updated
CREATE OR REPLACE FUNCTION update_history_preserve_updated(
    record_id INTEGER,
    update_data JSONB
)
RETURNS TABLE(id INTEGER) AS $$
DECLARE
    original_date_updated TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Get the original date_updated value
    SELECT date_updated INTO original_date_updated
    FROM history
    WHERE id = record_id;
    
    -- Dynamic update based on the JSON data provided
    EXECUTE format('
        UPDATE history 
        SET %s, date_updated = $1
        WHERE id = $2
        RETURNING id',
        (SELECT string_agg(key || ' = ' || quote_nullable(value), ', ')
         FROM jsonb_each_text(update_data))
    ) USING original_date_updated, record_id;
    
    RETURN QUERY SELECT record_id AS id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
