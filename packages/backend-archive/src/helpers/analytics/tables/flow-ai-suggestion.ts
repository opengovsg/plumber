import { z } from 'zod'

import type { SilverTable } from '../silver-table'

const flowAiSuggestionRowSchema = z.object({
  flow_id: z.string(),
  position: z.number().int(),
  app_key: z.string().nullable(),
  action_key: z.string().nullable(),
  ai_trace_id: z.string().nullable(),
})

export type FlowAiSuggestionRow = z.infer<typeof flowAiSuggestionRowSchema>

// Diffing these against flow_step shows how much users change what the AI Builder proposed.
// IMPORTANT: the browser builder saves suggestions only from #2576. An AI pipe with no rows here is unknown, not zero.
// The CASE guards jsonb_array_elements, which fails on a non-array value.
const FLOW_AI_SUGGESTION_SQL = `
  SELECT
    f.id AS flow_id,
    (s ->> 'position')::int AS position,
    s ->> 'appKey' AS app_key,
    s ->> 'key' AS action_key,
    f.config -> 'aiBuilderConfig' ->> 'traceId' AS ai_trace_id
  FROM flows f
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(f.config -> 'aiBuilderConfig' -> 'suggested') = 'array'
        THEN f.config -> 'aiBuilderConfig' -> 'suggested'
      ELSE '[]'::jsonb
    END
  ) AS s
  ORDER BY f.id, position
`

export const flowAiSuggestionTable: SilverTable<FlowAiSuggestionRow> = {
  name: 'flow_ai_suggestion',
  columns: {
    flow_id: 'STRING',
    position: 'INT64',
    app_key: 'STRING',
    action_key: 'STRING',
    ai_trace_id: 'STRING',
  },
  fetchRows: async (db) => {
    const result = await db.raw(FLOW_AI_SUGGESTION_SQL)
    return z.array(flowAiSuggestionRowSchema).parse(result.rows)
  },
}
