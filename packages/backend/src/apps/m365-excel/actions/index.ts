import type { IRawAction } from '@plumber/types'

const testAction: IRawAction = {
  name: 'Test Action',
  key: 'testAction',
  description: 'To make excel show up in app list; real actions in later PR.',
  arguments: [
    {
      key: 'fileId',
      label: 'Excel File',
      required: true,
      description: 'File to edit',
      type: 'dropdown' as const,
      variables: false,
      source: {
        type: 'query' as const,
        name: 'getDynamicData' as const,
        arguments: [
          {
            name: 'key',
            value: 'listFiles',
          },
        ],
      },
    },
    {
      key: 'worksheetId',
      label: 'Worksheet',
      required: true,
      description: 'Worksheet to edit',
      type: 'dropdown' as const,
      variables: false,
      source: {
        type: 'query' as const,
        name: 'getDynamicData' as const,
        arguments: [
          {
            name: 'key',
            value: 'listWorksheets',
          },
          {
            name: 'parameters.fileId',
            value: '{parameters.fileId}',
          },
        ],
      },
    },
  ],

  async run($) {
    $.setActionItem({ raw: { success: true } })
  },
}

export default [testAction]
