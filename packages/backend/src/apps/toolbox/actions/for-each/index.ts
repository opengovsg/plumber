import { IRawAction } from '@plumber/types'

import StepError from '@/errors/step'

import getDataOutMetadata from './get-data-out-metadata'
import { inputSchema } from './schema'

const action: IRawAction = {
  name: 'For each item',
  key: 'forEach',
  description: 'Repeat actions for each item',
  groupsLaterSteps: true,
  arguments: [
    {
      label: 'Choose items',
      description:
        'Supported items include rows in Tiles/M365 Excel and FormSG checkboxes',
      key: 'items',
      type: 'string' as const,
      required: true,
      variables: true,
      variableTypes: ['array', 'table'],
    },
  ],

  getDataOutMetadata,

  async run($) {
    const { items: rawItems } = $.step.parameters
    const parsedResult = inputSchema.safeParse(rawItems)

    if (parsedResult.success === false) {
      throw new StepError(
        'Invalid input list',
        'Select a valid input list',
        $.step.position,
        $.app.name,
      )
    }

    const { type, items } = parsedResult.data
    $.setActionItem({
      raw: {
        iterations: type === 'checkbox' ? items.length : items.rows.length,
      },
    })
  },
}

export default action
