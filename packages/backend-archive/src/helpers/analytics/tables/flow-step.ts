import type { Knex } from 'knex'
import { z } from 'zod'

import type { SgtDayWindow } from '../sgt-day'
import type { SilverChangeTable } from '../silver-change-tables'

// One page per file. A full copy of 705k steps peaked at 1.2 GB in one file, against the task's 2 GB.
export const FLOW_STEP_PAGE_SIZE = 50_000

const FIRST_UUID = '00000000-0000-0000-0000-000000000000'

const flowStepSqlRowSchema = z.object({
  step_id: z.string(),
  flow_id: z.string(),
  position: z.number().int(),
  app_key: z.string().nullable(),
  action_key: z.string().nullable(),
  step_type: z.string(),
  connection_id: z.string().nullable(),
  status: z.string(),
  created_at: z.date(),
  updated_at: z.date(),
  deleted_at: z.date().nullable(),
  updated_by_user_id: z.string().nullable(),
  created_by_ai: z.boolean(),
  updated_by_ai: z.boolean(),
  resource_value: z.string().nullable(),
})

type FlowStepSqlRow = z.infer<typeof flowStepSqlRowSchema>

export type FlowStepRow = Omit<FlowStepSqlRow, 'resource_value'> & {
  resource_id: string | null
}

const TEMPLATE_PLACEHOLDER = 'plumber-template-variable'

/**
 * Takes the object a step points at from the parameter the editor fills with a dropdown.
 *
 * A templated value is per-run data, not a resource. A custom API keeps only its host, since a path can hold an id.
 */
export function toResourceId(
  appKey: string | null,
  value: string | null,
): string | null {
  if (!value) {
    return null
  }
  if (appKey !== 'custom-api') {
    return value.includes('{{') ? null : value
  }
  // A templated path is common, so only a templated host makes the URL per-run data.
  try {
    const host = new URL(value.replace(/\{\{[^}]*\}\}/g, TEMPLATE_PLACEHOLDER))
      .hostname
    return host && !host.includes(TEMPLATE_PLACEHOLDER) ? host : null
  } catch {
    return null
  }
}

// IMPORTANT: FormSG keeps its form id in the encrypted connection data. connection_id identifies the form instead.
// Pages follow flow_id, so a search by pipe reads few row groups. A step without a pipe is left out.
const FLOW_STEP_SQL = `
  SELECT
    s.id AS step_id,
    s.flow_id,
    s.position,
    s.app_key,
    s.key AS action_key,
    s.type AS step_type,
    s.connection_id,
    s.status,
    s.created_at,
    s.updated_at,
    s.deleted_at,
    s.updated_by AS updated_by_user_id,
    coalesce(
      s.config -> 'aiBuilderConfig' @> '[{"tool": "create_pipe"}]'
        OR s.config -> 'aiBuilderConfig' @> '[{"tool": "create_step"}]',
      false
    ) AS created_by_ai,
    coalesce(
      s.config -> 'aiBuilderConfig' @> '[{"tool": "update_step_parameters"}]',
      false
    ) AS updated_by_ai,
    CASE
      WHEN s.app_key = 'tiles' THEN s.parameters ->> 'tableId'
      WHEN s.app_key = 'm365-excel' THEN s.parameters ->> 'fileId'
      WHEN s.app_key = 'lettersg' THEN s.parameters ->> 'templateId'
      WHEN s.app_key = 'databricks' THEN s.parameters ->> 'tableName'
      WHEN s.app_key = 'slack' THEN s.parameters ->> 'channel'
      WHEN s.app_key = 'telegram-bot' THEN s.parameters ->> 'chatId'
      WHEN s.app_key = 'custom-api' THEN s.parameters ->> 'url'
      WHEN s.app_key = 'gathersg' AND s.key = 'createCase'
        THEN s.parameters ->> 'caseType'
    END AS resource_value
  FROM steps s
  WHERE s.flow_id IS NOT NULL
    AND (s.flow_id, s.id) > (?::uuid, ?::uuid)
    AND (?::timestamptz IS NULL OR s.updated_at >= ?)
    AND (?::timestamptz IS NULL OR s.updated_at < ?)
  ORDER BY s.flow_id, s.id
  LIMIT ?
`

export async function* fetchFlowStepPages(
  db: Knex,
  window: SgtDayWindow | null,
  pageSize = FLOW_STEP_PAGE_SIZE,
): AsyncGenerator<FlowStepRow[]> {
  const start = window?.start ?? null
  const end = window?.end ?? null
  let after = { flowId: FIRST_UUID, stepId: FIRST_UUID }
  for (;;) {
    const result = await db.raw(FLOW_STEP_SQL, [
      after.flowId,
      after.stepId,
      start,
      start,
      end,
      end,
      pageSize,
    ])
    const page = z.array(flowStepSqlRowSchema).parse(result.rows)
    if (page.length > 0) {
      yield page.map(({ resource_value, ...row }) => ({
        ...row,
        resource_id: toResourceId(row.app_key, resource_value),
      }))
    }
    if (page.length < pageSize) {
      return
    }
    const last = page[page.length - 1]
    after = { flowId: last.flow_id, stepId: last.step_id }
  }
}

/**
 * Steps whose updated_at falls on the day, soft deletes included. A step's current state is its row with the latest day, then updated_at.
 *
 * IMPORTANT: a migration or script that writes steps directly skips updated_at. Re-baseline with --full after one.
 */
export const flowStepTable: SilverChangeTable<FlowStepRow> = {
  name: 'flow_step',
  columns: {
    flow_id: 'STRING',
    step_id: 'STRING',
    position: 'INT64',
    app_key: 'STRING',
    action_key: 'STRING',
    step_type: 'STRING',
    resource_id: 'STRING',
    connection_id: 'STRING',
    status: 'STRING',
    created_at: 'TIMESTAMP',
    updated_at: 'TIMESTAMP',
    deleted_at: 'TIMESTAMP',
    updated_by_user_id: 'STRING',
    created_by_ai: 'BOOLEAN',
    updated_by_ai: 'BOOLEAN',
  },
  fetchPages: (db, window) => fetchFlowStepPages(db, window),
}
