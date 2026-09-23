-- Grafana: query format Table. Stat panel (one row, many fields).
-- Quoted aliases use spaces so Stat titles wrap.
-- Percent (0-100) on the qoq pct columns. Those can be negative.
-- Percentage-point change on the qoq pp columns, not a ratio.
-- Calendar quarters in SGT. Q1 Jan-Mar, Q2 Apr-Jun, Q3 Jul-Sep, Q4 Oct-Dec.
-- Grafana's time picker is ignored. Current window is quarter-to-date, so
-- count QoQ compares a partial quarter to a full previous quarter.
-- Birth-cohort stats for current QTD, plus change versus the previous full
-- quarter. Values shown are quarter-to-date.
--
-- PERFORMANCE:
--  * LATERAL ... LIMIT 1 stops at the first live execution per cohort pipe.
--  * classified is MATERIALIZED because stats reads it many times.
--  * first_flow runs only for owners of a flowed AI Builder pipe in either
--    window. MIN(...) GROUP BY replaces DISTINCT ON.
WITH sgt AS (
  SELECT date_trunc('quarter', now() AT TIME ZONE 'Asia/Singapore') AS curr_quarter_naive
),
params AS (
  SELECT
    (curr_quarter_naive - interval '3 months') AT TIME ZONE 'Asia/Singapore' AS prev_q_start,
    curr_quarter_naive AT TIME ZONE 'Asia/Singapore' AS current_q_start,
    now() AS current_qtd_end
  FROM sgt
),
pipes AS (
  SELECT
    f.id,
    f.user_id,
    f.archived_execution_count,
    (f.created_at >= prm.current_q_start) AS is_qtd,
    CASE
      WHEN COALESCE(f.config, '{}'::jsonb) ? 'aiBuilderConfig' THEN 'ai_builder'
      WHEN COALESCE(f.config, '{}'::jsonb) ? 'templateConfig' THEN 'template'
      ELSE 'manual_editor'
    END AS cohort
  FROM flows f
  CROSS JOIN params prm
  WHERE f.created_at >= prm.prev_q_start
    AND f.created_at < prm.current_qtd_end
),
classified AS MATERIALIZED (
  SELECT
    p.id,
    p.user_id,
    p.cohort,
    p.is_qtd,
    (
      p.archived_execution_count > 0
      OR lv.has_live IS NOT NULL
    ) AS ever_flowed
  FROM pipes p
  LEFT JOIN LATERAL (
    SELECT 1 AS has_live
    FROM executions e
    WHERE e.flow_id = p.id
      AND e.test_run = false
    LIMIT 1
  ) lv ON true
),
owners_flowed AS (
  SELECT DISTINCT user_id
  FROM classified
  WHERE cohort = 'ai_builder'
    AND ever_flowed
),
first_flow AS (
  SELECT f.user_id, MIN(e.created_at) AS first_flowed_at
  FROM owners_flowed o
  JOIN flows f ON f.user_id = o.user_id
  JOIN executions e
    ON e.flow_id = f.id
   AND e.test_run = false
  GROUP BY f.user_id
),
stats AS MATERIALIZED (
  SELECT
    COUNT(*) FILTER (WHERE c.is_qtd AND c.cohort = 'ai_builder')
      AS ai_created_qtd,
    COUNT(*) FILTER (WHERE NOT c.is_qtd AND c.cohort = 'ai_builder')
      AS ai_created_prev,
    COUNT(*) FILTER (
      WHERE c.is_qtd AND c.cohort = 'ai_builder' AND c.ever_flowed
    ) AS ai_flowed_qtd,
    COUNT(*) FILTER (
      WHERE NOT c.is_qtd AND c.cohort = 'ai_builder' AND c.ever_flowed
    ) AS ai_flowed_prev,
    COUNT(DISTINCT c.user_id) FILTER (
      WHERE c.is_qtd AND c.cohort = 'ai_builder'
    ) AS ai_users_qtd,
    COUNT(DISTINCT c.user_id) FILTER (
      WHERE NOT c.is_qtd AND c.cohort = 'ai_builder'
    ) AS ai_users_prev,
    COUNT(DISTINCT c.user_id) FILTER (
      WHERE c.is_qtd AND c.cohort = 'ai_builder' AND c.ever_flowed
    ) AS ai_users_flowed_qtd,
    COUNT(DISTINCT c.user_id) FILTER (
      WHERE NOT c.is_qtd AND c.cohort = 'ai_builder' AND c.ever_flowed
    ) AS ai_users_flowed_prev,
    COUNT(DISTINCT c.user_id) FILTER (
      WHERE c.is_qtd
        AND c.cohort = 'ai_builder'
        AND c.ever_flowed
        AND ff.first_flowed_at >= prm.current_q_start
        AND ff.first_flowed_at < prm.current_qtd_end
    ) AS ai_first_ever_qtd,
    COUNT(DISTINCT c.user_id) FILTER (
      WHERE NOT c.is_qtd
        AND c.cohort = 'ai_builder'
        AND c.ever_flowed
        AND ff.first_flowed_at >= prm.prev_q_start
        AND ff.first_flowed_at < prm.current_q_start
    ) AS ai_first_ever_prev,
    COUNT(*) FILTER (WHERE c.is_qtd) AS all_created_qtd,
    COUNT(*) FILTER (WHERE NOT c.is_qtd) AS all_created_prev,
    COUNT(*) FILTER (WHERE c.is_qtd AND c.ever_flowed) AS all_flowed_qtd,
    COUNT(*) FILTER (WHERE NOT c.is_qtd AND c.ever_flowed) AS all_flowed_prev,
    COUNT(*) FILTER (WHERE c.is_qtd AND c.cohort = 'manual_editor')
      AS manual_created_qtd,
    COUNT(*) FILTER (WHERE NOT c.is_qtd AND c.cohort = 'manual_editor')
      AS manual_created_prev,
    COUNT(*) FILTER (
      WHERE c.is_qtd AND c.cohort = 'manual_editor' AND c.ever_flowed
    ) AS manual_flowed_qtd,
    COUNT(*) FILTER (
      WHERE NOT c.is_qtd AND c.cohort = 'manual_editor' AND c.ever_flowed
    ) AS manual_flowed_prev
  FROM classified c
  CROSS JOIN params prm
  LEFT JOIN first_flow ff ON ff.user_id = c.user_id
)
SELECT
  to_char(
    prm.current_q_start AT TIME ZONE 'Asia/Singapore',
    '"Q"Q YYYY'
  ) || ' to ' || to_char(
    prm.current_qtd_end AT TIME ZONE 'Asia/Singapore',
    'DD Mon'
  ) || ' vs ' || to_char(
    prm.prev_q_start AT TIME ZONE 'Asia/Singapore',
    '"Q"Q YYYY'
  ) AS "window",
  s.ai_created_qtd AS "ai builder pipes created",
  ROUND(
    100.0 * (s.ai_created_qtd - s.ai_created_prev)
      / NULLIF(s.ai_created_prev, 0),
    1
  ) AS "ai builder pipes created qoq pct",
  s.ai_flowed_qtd AS "ai builder pipes flowed",
  ROUND(
    100.0 * (s.ai_flowed_qtd - s.ai_flowed_prev)
      / NULLIF(s.ai_flowed_prev, 0),
    1
  ) AS "ai builder pipes flowed qoq pct",
  ROUND(
    100.0 * s.ai_flowed_qtd / NULLIF(s.ai_created_qtd, 0),
    1
  ) AS "ai builder pipes flowed pct",
  ROUND(
    100.0 * s.ai_flowed_qtd / NULLIF(s.ai_created_qtd, 0)
      - 100.0 * s.ai_flowed_prev / NULLIF(s.ai_created_prev, 0),
    1
  ) AS "ai builder pipes flowed pct qoq pp",
  s.ai_users_qtd AS "users who created ai builder pipes",
  ROUND(
    100.0 * (s.ai_users_qtd - s.ai_users_prev)
      / NULLIF(s.ai_users_prev, 0),
    1
  ) AS "users who created ai builder pipes qoq pct",
  s.ai_users_flowed_qtd AS "users who created ai builder pipes that flowed",
  ROUND(
    100.0 * (s.ai_users_flowed_qtd - s.ai_users_flowed_prev)
      / NULLIF(s.ai_users_flowed_prev, 0),
    1
  ) AS "users who created ai builder pipes that flowed qoq pct",
  s.ai_first_ever_qtd AS "ai builder users with first ever flow",
  ROUND(
    100.0 * (s.ai_first_ever_qtd - s.ai_first_ever_prev)
      / NULLIF(s.ai_first_ever_prev, 0),
    1
  ) AS "ai builder users with first ever flow qoq pct",
  ROUND(
    100.0 * s.ai_created_qtd / NULLIF(s.all_created_qtd, 0),
    1
  ) AS "ai builder share of new pipes",
  ROUND(
    100.0 * s.ai_created_qtd / NULLIF(s.all_created_qtd, 0)
      - 100.0 * s.ai_created_prev / NULLIF(s.all_created_prev, 0),
    1
  ) AS "ai builder share of new pipes qoq pp",
  ROUND(
    100.0 * s.ai_flowed_qtd / NULLIF(s.all_flowed_qtd, 0),
    1
  ) AS "ai builder share of flowed pipes",
  ROUND(
    100.0 * s.ai_flowed_qtd / NULLIF(s.all_flowed_qtd, 0)
      - 100.0 * s.ai_flowed_prev / NULLIF(s.all_flowed_prev, 0),
    1
  ) AS "ai builder share of flowed pipes qoq pp",
  s.manual_created_qtd AS "manual editor pipes created",
  ROUND(
    100.0 * (s.manual_created_qtd - s.manual_created_prev)
      / NULLIF(s.manual_created_prev, 0),
    1
  ) AS "manual editor pipes created qoq pct",
  s.manual_flowed_qtd AS "manual editor pipes flowed",
  ROUND(
    100.0 * (s.manual_flowed_qtd - s.manual_flowed_prev)
      / NULLIF(s.manual_flowed_prev, 0),
    1
  ) AS "manual editor pipes flowed qoq pct",
  ROUND(
    100.0 * s.manual_flowed_qtd / NULLIF(s.manual_created_qtd, 0),
    1
  ) AS "manual editor pipes flowed pct",
  ROUND(
    100.0 * s.manual_flowed_qtd / NULLIF(s.manual_created_qtd, 0)
      - 100.0 * s.manual_flowed_prev / NULLIF(s.manual_created_prev, 0),
    1
  ) AS "manual editor pipes flowed pct qoq pp"
FROM stats s
CROSS JOIN params prm;
