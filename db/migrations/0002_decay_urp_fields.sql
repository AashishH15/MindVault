-- Backfill URP decay fields for legacy/default decay JSON shapes.
-- This avoids silent data drift for nodes created with older defaults.

UPDATE nodes
SET decay = json_patch(
    json_replace(
        json_remove(json_remove(decay, '$.age_days'), '$.access_count_30d'),
        '$.access_count_90d', json_extract(decay, '$.access_count_90d')
    ),
    '{"access_count_30active":0,"access_count_90active":0,"today_touches":0,"access_history":[],"link_count":0}'
)
WHERE json_extract(decay, '$.access_count_30active') IS NULL;

