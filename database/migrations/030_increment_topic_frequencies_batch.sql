-- Batch RPC to increment topic frequencies in one round-trip

CREATE OR REPLACE FUNCTION increment_topic_frequencies_batch(p_updates JSONB)
RETURNS VOID AS $$
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN SELECT * FROM jsonb_to_recordset(p_updates)
        AS x(category TEXT, increment INT)
    LOOP
        UPDATE topic_frequencies
        SET count_30d = count_30d + rec.increment,
            last_updated = NOW()
        WHERE topic_frequencies.category = rec.category;

        IF NOT FOUND THEN
            INSERT INTO topic_frequencies (category, count_30d, last_updated)
            VALUES (rec.category, rec.increment, NOW())
            ON CONFLICT (category) DO UPDATE
            SET count_30d = topic_frequencies.count_30d + rec.increment,
                last_updated = NOW();
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION increment_topic_frequencies_batch(JSONB) IS
    'Batch increment topic frequencies; p_updates: [{"category": "drama", "increment": 3}, ...]';
