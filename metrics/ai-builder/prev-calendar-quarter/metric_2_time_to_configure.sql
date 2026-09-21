-- Grafana: query format Table. Stat / table panel.
-- Window is always the previous calendar quarter in SGT.
-- Q1 Jan-Mar, Q2 Apr-Jun, Q3 Jul-Sep, Q4 Oct-Dec.
-- Half-open [period_start, period_end). Grafana's time picker is ignored.
-- Later stages use that cohort's current outcome, including after the quarter.
-- First success may fall after the quarter. That is elapsed time for the cohort.
--
-- PERFORMANCE: the first success is read with ORDER BY created_at LIMIT 1 inside a
-- correlated LATERAL, so it stops at the first matching row per pipe instead of
-- aggregating every live execution. Keep MATERIALIZED and the LATERAL.
WITH params AS (
  SELECT
    (
      date_trunc('quarter', now() AT TIME ZONE 'Asia/Singapore')
      - interval '3 months'
    ) AT TIME ZONE 'Asia/Singapore' AS period_start,
    (
      date_trunc('quarter', now() AT TIME ZONE 'Asia/Singapore')
    ) AT TIME ZONE 'Asia/Singapore' AS period_end
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
    AND f.created_at < p.period_end
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
  COUNT(*) AS pipes_with_successful_flow,
  ROUND(AVG(hours_to_success)::numeric, 3) AS avg_hours,
  ROUND(
    (PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY hours_to_success))::numeric,
    3
  ) AS median_hours,
  ROUND(MIN(hours_to_success)::numeric, 5) AS min_hours,
  ROUND(MAX(hours_to_success)::numeric, 1) AS max_hours,
  ROUND(
    (PERCENTILE_CONT(0.1) WITHIN GROUP (ORDER BY hours_to_success))::numeric,
    3
  ) AS p10_hours,
  ROUND(
    (PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY hours_to_success))::numeric,
    1
  ) AS p90_hours
FROM durations
GROUP BY cohort
ORDER BY cohort;
