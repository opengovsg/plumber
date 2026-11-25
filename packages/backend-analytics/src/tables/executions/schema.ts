import { z } from 'zod'

import type { ParquetColumns } from '../../silver-table'

const countSchema = z.coerce.number().int()

export const EXECUTION_EVENTS = [
  'started',
  'succeeded',
  'failed',
  'retry_succeeded',
] as const

export const executionDailyRowSchema = z.object({
  start_day: z.string(),
  event: z.enum(EXECUTION_EVENTS),
  flow_id: z.string(),
  owner_user_id: z.string().nullable(),
  test_run: z.boolean(),
  duration_bucket: z.string().nullable(),
  count: countSchema,
})

export type ExecutionDailyRow = z.infer<typeof executionDailyRowSchema>

export const executionStepDailyRowSchema = z.object({
  flow_id: z.string(),
  step_id: z.string().nullable(),
  owner_user_id: z.string().nullable(),
  app_key: z.string().nullable(),
  action_key: z.string().nullable(),
  test_run: z.boolean(),
  status: z.string().nullable(),
  error_kind: z.string().nullable(),
  retried: z.boolean(),
  count: countSchema,
})

export type ExecutionStepDailyRow = z.infer<typeof executionStepDailyRowSchema>

export const executionInflightRowSchema = z.object({
  flow_id: z.string(),
  owner_user_id: z.string().nullable(),
  last_app_key: z.string().nullable(),
  last_action_key: z.string().nullable(),
  last_step_status: z.string().nullable(),
  age_bucket: z.string(),
  count: countSchema,
})

export type ExecutionInflightRow = z.infer<typeof executionInflightRowSchema>

export const EXECUTION_DAILY_COLUMNS: ParquetColumns<ExecutionDailyRow> = {
  start_day: 'STRING',
  event: 'STRING',
  flow_id: 'STRING',
  owner_user_id: 'STRING',
  test_run: 'BOOLEAN',
  duration_bucket: 'STRING',
  count: 'INT64',
}

export const EXECUTION_STEP_DAILY_COLUMNS: ParquetColumns<ExecutionStepDailyRow> =
  {
    flow_id: 'STRING',
    step_id: 'STRING',
    owner_user_id: 'STRING',
    app_key: 'STRING',
    action_key: 'STRING',
    test_run: 'BOOLEAN',
    status: 'STRING',
    error_kind: 'STRING',
    retried: 'BOOLEAN',
    count: 'INT64',
  }

export const EXECUTION_INFLIGHT_COLUMNS: ParquetColumns<ExecutionInflightRow> =
  {
    flow_id: 'STRING',
    owner_user_id: 'STRING',
    last_app_key: 'STRING',
    last_action_key: 'STRING',
    last_step_status: 'STRING',
    age_bucket: 'STRING',
    count: 'INT64',
  }
