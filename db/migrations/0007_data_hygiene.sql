-- 0007_data_hygiene
--
-- The registry currently holds one pre-migration test fixture
-- (object_key = 'test/valid-object.txt') that predates the object-key
-- standard. Tag it so it is excluded from reporting and grandfathered by
-- the key validator. This only updates metadata, so the object_key
-- trigger from 0002 does not fire.

UPDATE storage.assets
SET metadata = metadata || jsonb_build_object(
        'fixture', true,
        'key_layout', 'legacy',
        'note', 'pre-migration test fixture; not a real asset'
    )
WHERE object_key = 'test/valid-object.txt'
  AND metadata ->> 'fixture' IS DISTINCT FROM 'true';
