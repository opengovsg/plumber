import { z } from 'zod'

import type { SilverTable } from '../silver-table'

// Duplicates made before PLU-1033 shipped in v1.101.0 on 3 Nov 2026 carry no marker.
// A pipe from before this time with no marker could be manual or a copy, so its path stays null.
export const DUPLICATE_TRACKED_FROM = new Date('2026-11-03T16:00:00.000Z')

const flowStageRowSchema = z.object({
  flow_id: z.string(),
  owner_user_id: z.string().nullable(),
  creation_path: z.enum(['duplicate', 'template', 'ai', 'manual']).nullable(),
  template_id: z.string().nullable(),
  created_at: z.date(),
  tested_at: z.date().nullable(),
  published_at: z.date().nullable(),
  is_active: z.boolean(),
  flowed_at: z.date().nullable(),
  deleted_at: z.date().nullable(),
  created_by_ai: z.boolean(),
  ai_trace_id: z.string().nullable(),
})

export type FlowStageRow = z.infer<typeof flowStageRowSchema>

// tested_at and flowed_at stay null until execution_daily exists.
// published_at is the current publish only. First publish comes from the publish events.
// A duplicate drops templateConfig and aiBuilderConfig, so the duplicate check needs no precedence over them.
const FLOW_STAGE_SQL = `
  SELECT
    f.id AS flow_id,
    f.user_id AS owner_user_id,
    CASE
      WHEN f.config ->> 'duplicatedFromFlowId' IS NOT NULL THEN 'duplicate'
      WHEN f.config -> 'templateConfig' ->> 'templateId' IS NOT NULL THEN 'template'
      WHEN jsonb_typeof(f.config -> 'aiBuilderConfig') = 'object' THEN 'ai'
      WHEN f.created_at >= ? THEN 'manual'
    END AS creation_path,
    f.config -> 'templateConfig' ->> 'templateId' AS template_id,
    f.created_at,
    NULL::timestamptz AS tested_at,
    f.published_at,
    coalesce(f.active, false) AS is_active,
    NULL::timestamptz AS flowed_at,
    f.deleted_at,
    coalesce(jsonb_typeof(f.config -> 'aiBuilderConfig') = 'object', false) AS created_by_ai,
    f.config -> 'aiBuilderConfig' ->> 'traceId' AS ai_trace_id
  FROM flows f
  ORDER BY f.created_at, f.id
`

export const flowStageTable: SilverTable<FlowStageRow> = {
  name: 'flow_stage',
  columns: {
    flow_id: 'STRING',
    owner_user_id: 'STRING',
    creation_path: 'STRING',
    template_id: 'STRING',
    created_at: 'TIMESTAMP',
    tested_at: 'TIMESTAMP',
    published_at: 'TIMESTAMP',
    is_active: 'BOOLEAN',
    flowed_at: 'TIMESTAMP',
    deleted_at: 'TIMESTAMP',
    created_by_ai: 'BOOLEAN',
    ai_trace_id: 'STRING',
  },
  fetchRows: async (db) => {
    const result = await db.raw(FLOW_STAGE_SQL, [DUPLICATE_TRACKED_FROM])
    return z.array(flowStageRowSchema).parse(result.rows)
  },
}
