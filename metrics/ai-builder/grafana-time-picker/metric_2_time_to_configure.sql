-- Grafana: query format Table. Stat / table panel.
-- Quoted aliases use spaces so Grafana titles wrap.
-- Time picker filters pipes by flows.created_at.
-- First success may fall after the selected range. That is elapsed time for the cohort.
--
-- PERFORMANCE: the first success is read with ORDER BY created_at LIMIT 1 inside a
-- correlated LATERAL, so it stops at the first matching row per pipe instead of
-- aggregating every live execution. Keep MATERIALIZED and the LATERAL.
WITH params AS (
  SELECT
    $__timeFrom()::timestamptz AS period_start,
    $__timeTo()::timestamptz AS period_end
),
pipes AS MATERIALIZED (
  SELECT
    f.id,
    f.created_at,
    CASE
      WHEN COALESCE(f.config, '{}'::jsonb) ? 'aiBuilderConfig' THEN 'ai_builder'
      WHEN COALESCE(f.config, '{}'::jsonb) ? 'templateConfig' THEN 'template'
      ELSE 'manual_editor'
    END AS cohort
  FROM flows f
  CROSS JOIN params p
  WHERE f.created_at >= p.period_start
    AND f.created_at <= p.period_end
),
durations AS (
  SELECT
    p.cohort,
    EXTRACT(EPOCH FROM (fs.first_success_at - p.created_at)) / 3600.0 AS hours_to_success
  FROM pipes p
  CROSS JOIN LATERAL (
    SELECT e.created_at AS first_success_at
    FROM executions e
    WHERE e.flow_id = p.id
      AND e.test_run = false
      AND e.status = 'success'
    ORDER BY e.created_at
    LIMIT 1
  ) fs
  WHERE fs.first_success_at >= p.created_at
)
SELECT
  cohort,
  COUNT(*) AS "pipes with successful flow",
  ROUND(AVG(hours_to_success)::numeric, 3) AS "avg hours",
  ROUND(
    (PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY hours_to_success))::numeric,
    3
  ) AS "median hours",
  ROUND(MIN(hours_to_success)::numeric, 5) AS "min hours",
  ROUND(MAX(hours_to_success)::numeric, 1) AS "max hours",
  ROUND(
    (PERCENTILE_CONT(0.1) WITHIN GROUP (ORDER BY hours_to_success))::numeric,
    3
  ) AS "p10 hours",
  ROUND(
    (PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY hours_to_success))::numeric,
    1
  ) AS "p90 hours"
FROM durations
GROUP BY cohort
ORDER BY cohort;
