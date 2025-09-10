import { IRawAction } from '@plumber/types'

import { ZodError } from 'zod'

import {
  isCheckboxItems,
  MultipleRowObject,
  processItems,
} from '@/apps/toolbox/common/get-for-each-variables'
import { BadUserInputError } from '@/errors/graphql-errors'
import StepError from '@/errors/step'
import Step from '@/models/step'

import {
  FOR_EACH_INPUT_SOURCE,
  FOR_EACH_ITERATION_KEY,
  FOR_EACH_TABLE_SOURCES,
} from '../../common/constants'

import getDataOutMetadata from './get-data-out-metadata'
import { inputSchema, parameterSchema } from './schema'

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
  validateStepParameters: (parameters: Step['parameters']) => {
    const parsedParameters = parameterSchema.safeParse(parameters)
    if (parsedParameters.success === false) {
      throw new BadUserInputError(
        (parsedParameters.error as ZodError).errors[0].message,
      )
    }
  },

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
      const output: {
        iteration: string
        iterations: number
        items: any[]
        inputSource: string
        item?: string
      } = {
        iteration: FOR_EACH_ITERATION_KEY,
        iterations: 0,
        items: [],
        inputSource: '',
      }
      if (
        inputSource === FOR_EACH_INPUT_SOURCE.STRING_ARRAY &&
        Array.isArray(items) &&
        isCheckboxItems(items)
      ) {
        output.iterations = items.length
        output.items = items
        output.inputSource = FOR_EACH_INPUT_SOURCE.STRING_ARRAY
        // NOTE: this is specifically for checkboxes
        // table data is handled differently in processItems
        output['item'] = `items.${FOR_EACH_ITERATION_KEY}`
      } else if (FOR_EACH_TABLE_SOURCES.includes(inputSource)) {
        const processedItems = processItems(items as MultipleRowObject)
        output.iterations = iterations
        output.items = processedItems
        output.inputSource = inputSource
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
