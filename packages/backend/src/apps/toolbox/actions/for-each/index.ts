import { IRawAction } from '@plumber/types'

import {
  isCheckboxItems,
  MultipleRowObject,
  processItems,
} from '@/apps/toolbox/common/get-for-each-variables'
import StepError from '@/errors/step'

import {
  FOR_EACH_INPUT_SOURCE,
  FOR_EACH_ITERATION_KEY,
} from '../../common/constants'

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
      singleVariableSelection: true,
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

    try {
      const { type, items } = parsedResult.data
      if (type === 'checkbox' && isCheckboxItems(items)) {
        $.setActionItem({
          raw: {
            iterations: items.length,
            items: items,
            inputSource: FOR_EACH_INPUT_SOURCE.CHECKBOX,
            // NOTE: this is specifically for checkboxes
            // table data is handled differently in processInput
            item: `items.${FOR_EACH_ITERATION_KEY}`,
          },
        })
        return
      } else if (type === 'table') {
        const { processedItems, iterations, inputSource } = processItems(
          items as MultipleRowObject,
        )

        $.setActionItem({
          raw: {
            iterations: iterations,
            items: processedItems,
            inputSource,
          },
        })
      }
    } catch (err) {
      console.error(err)
      throw new StepError(
        'Invalid input list',
        'Select a valid input list',
        $.step.position,
        $.app.name,
      )
    }
  },
}

export default action
