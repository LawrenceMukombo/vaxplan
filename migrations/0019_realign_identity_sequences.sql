-- Snapshot UPSERTs preserve explicit identity values and therefore do not
-- advance PostgreSQL sequences. Align every public serial/identity sequence so
-- subsequent audit, permission, role, and application inserts cannot reuse an
-- existing primary key.
DO $$
DECLARE
  sequence_row record;
  maximum_id bigint;
BEGIN
  FOR sequence_row IN
    SELECT
      table_namespace.nspname AS schema_name,
      table_class.relname AS table_name,
      table_attribute.attname AS column_name,
      pg_get_serial_sequence(
        format('%I.%I', table_namespace.nspname, table_class.relname),
        table_attribute.attname
      ) AS sequence_name
    FROM pg_class table_class
    JOIN pg_namespace table_namespace
      ON table_namespace.oid = table_class.relnamespace
    JOIN pg_attribute table_attribute
      ON table_attribute.attrelid = table_class.oid
    WHERE table_class.relkind IN ('r', 'p')
      AND table_namespace.nspname = 'public'
      AND table_attribute.attnum > 0
      AND NOT table_attribute.attisdropped
      AND pg_get_serial_sequence(
        format('%I.%I', table_namespace.nspname, table_class.relname),
        table_attribute.attname
      ) IS NOT NULL
  LOOP
    EXECUTE format(
      'SELECT max(%I) FROM %I.%I',
      sequence_row.column_name,
      sequence_row.schema_name,
      sequence_row.table_name
    ) INTO maximum_id;

    IF maximum_id IS NULL THEN
      EXECUTE format(
        'SELECT setval(%L::regclass, 1, false)',
        sequence_row.sequence_name
      );
    ELSE
      EXECUTE format(
        'SELECT setval(%L::regclass, %s, true)',
        sequence_row.sequence_name,
        maximum_id
      );
    END IF;
  END LOOP;
END $$;
