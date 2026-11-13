import { raw } from 'objection'

import Step from '@/models/step'

// IMPORTANT: each write edits config in one jsonb expression. A read-then-write
// would erase config saved during the slow FormSG call.
const removeMarker = () => raw(`config - 'aiBuilderConnectionConflict'`)

export async function recordConnectionConflict(
  stepId: string,
  connectionId: string,
  traceId?: string,
): Promise<void> {
  await Step.query()
    .findById(stepId)
    .patch({
      config: raw(
        `jsonb_set(config, '{aiBuilderConnectionConflict}', ?::jsonb, true)`,
        [JSON.stringify({ connectionId, ...(traceId && { traceId }) })],
      ),
    })
    .throwIfNotFound()
}

export async function clearConnectionConflict(
  stepId: string,
  patch: { connectionId?: string } = {},
): Promise<void> {
  await Step.query()
    .findById(stepId)
    .patch({ ...patch, config: removeMarker() })
    .throwIfNotFound()
}

/**
 * Leaves a marker for another connection in place. It may come from a newer
 * update_step_parameters call that landed during the override.
 */
export async function clearMatchingConnectionConflict(
  stepId: string,
  connectionId: string,
): Promise<void> {
  await Step.query()
    .findById(stepId)
    .whereRaw(
      `steps.config -> 'aiBuilderConnectionConflict' ->> 'connectionId' = ?`,
      [connectionId],
    )
    .patch({ config: removeMarker() })
}
