export interface ActionQueue {
  prefix: string
  name: string
}

/**
 * Hardcoded, because the reconciler must not load every app just to list their queues.
 *
 * Rejected ways to derive it:
 * - Import `@/queues/action`: it loads `@/apps`, which creates Redis clients on import. `entry-redis-clients.test.ts` forbids that.
 * - Move each app's queue settings to an import-free file: someone must still add each new file to an index, so it drifts like this list.
 * - `SCAN` Redis for `*:delayed` keys: each run walks every job key on the primary BullMQ uses.
 * - Workers register their queue names in Redis: removed queues stay registered forever.
 *
 * IMPORTANT: `__tests__/action-queues.test.ts` fails when this list drifts from `@/queues/action`.
 */
export const ACTION_QUEUES: ActionQueue[] = [
  { prefix: '{actionQ}', name: 'action' },
  { prefix: 'bull', name: '{app-actions-formsg}' },
  { prefix: 'bull', name: '{app-actions-gathersg}' },
  { prefix: 'bull', name: '{app-actions-m365-excel}' },
  { prefix: 'bull', name: '{app-actions-m365-excel-batch}' },
  { prefix: 'bull', name: '{app-actions-postman}' },
  { prefix: 'bull', name: '{app-actions-postman-sms}' },
  { prefix: 'bull', name: '{app-actions-slack}' },
  { prefix: 'bull', name: '{app-actions-telegram-bot}' },
  { prefix: 'bull', name: '{app-actions-tiles}' },
]
