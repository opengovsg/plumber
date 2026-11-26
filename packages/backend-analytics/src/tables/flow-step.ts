import { BaseStep } from '@plumber/backend-models'
import { SETUP_GUIDE_APP_EVENTS } from '@plumber/shared'
import type { Knex } from 'knex'
import { z } from 'zod'

import type { SgtDayWindow } from '../sgt-day'
import type { SilverChangeTable } from '../silver-change-tables'
import { readActionCatalog, resourceParameters } from './action-catalog'

// One page per file. A full copy of 705k steps peaked at 1.2 GB in one file, against the task's 2 GB.
export const FLOW_STEP_PAGE_SIZE = 50_000

const FIRST_UUID = '00000000-0000-0000-0000-000000000000'

const flowStepRowSchema = z.object({
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
  ai_tools: z.string().nullable(),
  has_setup_guide_config: z.boolean(),
  shows_setup_guide: z.boolean(),
  has_step_name: z.boolean(),
  if_then_end_step_id: z.string().nullable(),
  approval_reject_step_id: z.string().nullable(),
  parameters_version: z.number().int(),
  resource_id: z.string().nullable(),
})

export type FlowStepRow = z.infer<typeof flowStepRowSchema>

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

// Raw selects on top of BaseStep's columns. A model cannot express these JSON reads.
// pg returns timestamps as Date, while the model types them as strings.
interface StepWithFacts extends Omit<
  BaseStep,
  'createdAt' | 'updatedAt' | 'deletedAt'
> {
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
  aiTools: string | null
  hasSetupGuideConfig: boolean
  showsSetupGuide: boolean
  hasStepName: boolean
  ifThenEndStepId: string | null
  approvalRejectStepId: string | null
  // The raw JSON value, so an object or array never reaches resource_id as text.
  resourceValue: unknown
}

const AI_TOOLS_SQL = `(
  SELECT string_agg(DISTINCT entry ->> 'tool', ',' ORDER BY entry ->> 'tool')
  FROM jsonb_array_elements(
    CASE jsonb_typeof(steps.config -> 'aiBuilderConfig')
      WHEN 'array' THEN steps.config -> 'aiBuilderConfig'
      ELSE '[]'::jsonb
    END
  ) AS entry
  WHERE entry ->> 'tool' IS NOT NULL
) AS ai_tools`

const HAS_SETUP_GUIDE_CONFIG_SQL = `coalesce(
  jsonb_exists_any(steps.config -> 'templateConfig', array['appEventKey', 'customTemplate']),
  false
) AS has_setup_guide_config`

// The editor's rule in FlowStep: a custom guide, or a known app-event that still matches the step, on a pipe made from a template.
const SHOWS_SETUP_GUIDE_SQL = `coalesce(
  coalesce(steps.config -> 'templateConfig' ->> 'customTemplate', '') <> ''
  OR (
    steps.config -> 'templateConfig' ->> 'appEventKey' = steps.app_key || '_' || steps.key
    AND steps.config -> 'templateConfig' ->> 'appEventKey' = ANY(?::text[])
    AND jsonb_typeof(flows.config -> 'templateConfig') = 'object'
  ),
  false
) AS shows_setup_guide`

// IMPORTANT: FormSG keeps its form id in the encrypted connection data. connection_id identifies the form instead.
// Pages follow flow_id, so a search by pipe reads few row groups. A step without a pipe is left out.
// ai_tools stays raw, so a new AI builder tool needs no re-export. Views decide what counts as created or edited by AI.
// templateConfig is cleared when a step is first tested, so has_setup_guide_config marks a step not yet set up.
function fetchStepPage(
  db: Knex,
  window: SgtDayWindow | null,
  after: { flowId: string; stepId: string },
  pageSize: number,
  parameterJson: string,
) {
  const query = BaseStep.query(db)
    .withSoftDeleted()
    .select(
      'steps.id',
      'steps.flow_id',
      'steps.position',
      'steps.app_key',
      'steps.key',
      'steps.type',
      'steps.connection_id',
      'steps.status',
      'steps.created_at',
      'steps.updated_at',
      'steps.deleted_at',
      'steps.updated_by',
      'steps.version',
      db.raw(AI_TOOLS_SQL),
      db.raw(HAS_SETUP_GUIDE_CONFIG_SQL),
      db.raw(SHOWS_SETUP_GUIDE_SQL, [[...SETUP_GUIDE_APP_EVENTS]]),
      db.raw(
        "coalesce(steps.config ->> 'stepName', '') <> '' AS has_step_name",
      ),
      db.raw("steps.config ->> 'endStepId' AS if_then_end_step_id"),
      db.raw(
        "steps.config -> 'approval' ->> 'stepId' AS approval_reject_step_id",
      ),
      db.raw(
        "steps.parameters -> (?::jsonb ->> (steps.app_key || '.' || steps.key)) AS resource_value",
        [parameterJson],
      ),
    )
    .leftJoin('flows', 'flows.id', 'steps.flow_id')
    .whereNotNull('steps.flow_id')
    .whereRaw('(steps.flow_id, steps.id) > (?::uuid, ?::uuid)', [
      after.flowId,
      after.stepId,
    ])
    .orderBy(['steps.flow_id', 'steps.id'])
    .limit(pageSize)
  if (window) {
    query
      .where('steps.updated_at', '>=', window.start)
      .where('steps.updated_at', '<', window.end)
  }
  return query.castTo<StepWithFacts[]>()
}

function toFlowStepRow(step: StepWithFacts): FlowStepRow {
  return {
    step_id: step.id,
    flow_id: step.flowId,
    position: step.position,
    app_key: step.appKey ?? null,
    action_key: step.key ?? null,
    step_type: step.type,
    resource_id: toResourceId(
      step.appKey ?? null,
      typeof step.resourceValue === 'string' ? step.resourceValue : null,
    ),
    connection_id: step.connectionId ?? null,
    status: step.status,
    created_at: step.createdAt,
    updated_at: step.updatedAt,
    deleted_at: step.deletedAt,
    updated_by_user_id: step.updatedBy ?? null,
    ai_tools: step.aiTools,
    has_setup_guide_config: step.hasSetupGuideConfig,
    shows_setup_guide: step.showsSetupGuide,
    has_step_name: step.hasStepName,
    if_then_end_step_id: step.ifThenEndStepId,
    approval_reject_step_id: step.approvalRejectStepId,
    parameters_version: step.version,
  }
}

// The action catalog names which argument holds each app-action's resource.
export async function* fetchFlowStepPages(
  db: Knex,
  window: SgtDayWindow | null,
  pageSize = FLOW_STEP_PAGE_SIZE,
  parameterByAction: Record<string, string> = resourceParameters(
    readActionCatalog(),
  ),
): AsyncGenerator<FlowStepRow[]> {
  const parameterJson = JSON.stringify(parameterByAction)
  let after = { flowId: FIRST_UUID, stepId: FIRST_UUID }
  for (;;) {
    const page = await fetchStepPage(db, window, after, pageSize, parameterJson)
    if (page.length > 0) {
      yield z.array(flowStepRowSchema).parse(page.map(toFlowStepRow))
    }
    if (page.length < pageSize) {
      return
    }
    const last = page[page.length - 1]
    after = { flowId: last.flowId, stepId: last.id }
  }
}

/**
 * Steps whose updated_at falls on the day, soft deletes included. A step's current state is its row with the latest day, then updated_at.
 *
 * IMPORTANT: a migration or script that writes steps directly skips updated_at. Re-baseline with --full after one.
 * Each row is the step at export time, so edits between exports are lost. The backend-analytics README lists the known gaps.
 */
export const flowStepTable: SilverChangeTable<FlowStepRow> = {
  name: 'flow_step',
  // IMPORTANT: a bump makes the next run write a full copy, about 705k rows synced to PostHog once.
  version: 1,
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
    ai_tools: 'STRING',
    has_setup_guide_config: 'BOOLEAN',
    shows_setup_guide: 'BOOLEAN',
    has_step_name: 'BOOLEAN',
    if_then_end_step_id: 'STRING',
    approval_reject_step_id: 'STRING',
    parameters_version: 'INT64',
  },
  fetchPages: (db, window) => fetchFlowStepPages(db, window),
}
