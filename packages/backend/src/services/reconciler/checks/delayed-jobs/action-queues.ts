export interface ActionQueue {
  prefix: string
  name: string
}

// `@/queues/action` derives this from `@/apps`, which creates Redis clients on import.
// IMPORTANT: `__tests__/action-queues.test.ts` fails when this list drifts from `@/queues/action`.
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
