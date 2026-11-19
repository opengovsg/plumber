import { BaseFlow } from '@plumber/backend-models'
import { z } from 'zod'

import type { SilverTable } from '../silver-table'
import { FIRST_APPROVED_TRANSFER, flowCreatorSql } from './flow-creator'

// Duplicates made before PLU-1033 shipped in v1.101.0 on 3 Nov 2026 carry no marker.
// A pipe from before this time with no marker could be manual or a copy, so its path stays null.
export const DUPLICATE_TRACKED_FROM = new Date('2026-11-03T16:00:00.000Z')

const flowStageRowSchema = z.object({
  flow_id: z.string(),
  owner_user_id: z.string().nullable(),
  creator_user_id: z.string().nullable(),
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

// A duplicate drops templateConfig and aiBuilderConfig, so the duplicate check needs no precedence over them.
const CREATION_PATH_SQL = `
  CASE
    WHEN flows.config ->> 'duplicatedFromFlowId' IS NOT NULL THEN 'duplicate'
    WHEN flows.config -> 'templateConfig' ->> 'templateId' IS NOT NULL THEN 'template'
    WHEN jsonb_typeof(flows.config -> 'aiBuilderConfig') = 'object' THEN 'ai'
    WHEN flows.created_at >= ? THEN 'manual'
  END AS creation_path
`

type FlowWithStage = BaseFlow & {
  creatorUserId: string | null
  creationPath: string | null
  templateId: string | null
  createdByAi: boolean
  aiTraceId: string | null
}

// tested_at and flowed_at stay null until execution_daily exists.
// published_at is the current publish only. First publish comes from the publish events.
export function toFlowStageRow(flow: FlowWithStage): unknown {
  return {
    flow_id: flow.id,
    owner_user_id: flow.userId,
    creator_user_id: flow.creatorUserId,
    creation_path: flow.creationPath,
    template_id: flow.templateId,
    created_at: flow.createdAt,
    tested_at: null,
    published_at: flow.publishedAt ?? null,
    is_active: flow.active ?? false,
    flowed_at: null,
    deleted_at: flow.deletedAt,
    created_by_ai: flow.createdByAi,
    ai_trace_id: flow.aiTraceId,
  }
}

export const flowStageTable: SilverTable<FlowStageRow> = {
  name: 'flow_stage',
  columns: {
    flow_id: 'STRING',
    owner_user_id: 'STRING',
    creator_user_id: 'STRING',
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
    const flows = await BaseFlow.query(db)
      .withSoftDeleted()
      .select(
        'flows.id',
        'flows.user_id',
        'flows.created_at',
        'flows.published_at',
        'flows.active',
        'flows.deleted_at',
        db.raw(`${flowCreatorSql('flows')} AS creator_user_id`),
        db.raw(CREATION_PATH_SQL, [DUPLICATE_TRACKED_FROM]),
        db.raw(
          "flows.config -> 'templateConfig' ->> 'templateId' AS template_id",
        ),
        db.raw(
          "coalesce(jsonb_typeof(flows.config -> 'aiBuilderConfig') = 'object', false) AS created_by_ai",
        ),
        db.raw(
          "flows.config -> 'aiBuilderConfig' ->> 'traceId' AS ai_trace_id",
        ),
      )
      .leftJoin(
        db.raw(FIRST_APPROVED_TRANSFER),
        'first_transfer.flow_id',
        'flows.id',
      )
      .orderBy(['flows.created_at', 'flows.id'])
      .castTo<FlowWithStage[]>()
    return z.array(flowStageRowSchema).parse(flows.map(toFlowStageRow))
  },
}
