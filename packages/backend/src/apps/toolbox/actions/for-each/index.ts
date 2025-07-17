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
  isNew: true,
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
    const { testRun } = $.execution
    const { items: rawItems } = $.step.parameters
    const parsedResult = inputSchema.safeParse({ data: rawItems, testRun })

    if (parsedResult.success === false) {
      throw new StepError(
        'Invalid input list',
        'Select a valid input list',
        $.step.position,
        $.app.name,
      )
    }

    try {
      const { items, inputSource, iterations } = parsedResult.data
      let output: {
        iterations: number
        items: any[]
        inputSource: string
        item?: string
      } = {
        iterations: 0,
        items: [],
        inputSource: '',
      }
      if (
        inputSource === FOR_EACH_INPUT_SOURCE.STRING_ARRAY &&
        Array.isArray(items) &&
        isCheckboxItems(items)
      ) {
        output = {
          iterations: items.length,
          items: items,
          inputSource: FOR_EACH_INPUT_SOURCE.STRING_ARRAY,
          // NOTE: this is specifically for checkboxes
          // table data is handled differently in processItems
          item: `items.${FOR_EACH_ITERATION_KEY}`,
        }
      } else if (
        inputSource === FOR_EACH_INPUT_SOURCE.M365_EXCEL ||
        inputSource === FOR_EACH_INPUT_SOURCE.TILES
      ) {
        const processedItems = processItems(items as MultipleRowObject)

        output = {
          iterations: iterations,
          items: processedItems,
          inputSource,
        }
      }

      $.setActionItem({ raw: output })

      if (output?.iterations === 0) {
        return {
          nextStep: {
            command: 'stop-execution',
            stepId: $.step.id,
          },
        }
      }

      return {
        nextStep: {
          command: 'start-for-each',
          stepId: $.step.id,
        },
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
