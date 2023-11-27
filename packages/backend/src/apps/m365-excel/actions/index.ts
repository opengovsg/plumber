import type { IRawAction } from '@plumber/types'

const testAction: IRawAction = {
  name: 'Test Action',
  key: 'testAction',
  description: 'To make excel show up in app list; real actions in later PR.',
  arguments: [
    {
      label: 'Placeholder',
      key: 'data',
      type: 'string' as const,
      required: true,
      description: 'Beep boop',
      variables: true,
    },
  ],

  async run($) {
    $.setActionItem({ raw: { success: true } })
  },
}

export default [testAction]
