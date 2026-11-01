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

// Empty or free-text input is the user's variable choice, but a malformed table comes from a Plumber step.
function isEmptyOrNonJsonInput(rawItems: unknown, testRun: boolean): boolean {
  if (rawItems === undefined || rawItems === null) {
    return true
  }
  if (Array.isArray(rawItems)) {
    return testRun && rawItems.length === 0
  }
  if (typeof rawItems !== 'string') {
    return false
  }
  if (rawItems.trim() === '') {
    return true
  }
  try {
    JSON.parse(rawItems)
    return false
  } catch {
    return true
  }
}

const action: IRawAction = {
  name: 'Repeat for each item',
  key: 'forEach',
  description: 'Run the same actions for each item in your list',
  groupsLaterSteps: true,
  linkToGuide:
    'https://guide.plumber.gov.sg/user-guides/actions/for-each-item-coming-soon',
  arguments: [
    {
      label: 'Choose items',
      description:
        'Items you can choose from: Find multiple rows, Find multiple table rows, or checkboxes/table from your form.',
      key: 'items',
      type: 'string' as const,
      required: true,
      variables: true,
      variableTypes: ['array', 'table'],
      singleVariableSelection: true,
      noVariablesMessage:
        ' No variables available - add/check one of the following steps above: Find multiple rows, Find multiple table rows, or include a checkbox/table field in your FormSG.',
    },
  ],

  getDataOutMetadata,
  validateStepParameters: (parameters: Step['parameters']) => {
    const parsedParameters = parameterSchema.safeParse(parameters)
    if (parsedParameters.success === false) {
      throw new BadUserInputError(
        (parsedParameters.error as ZodError).issues[0].message,
      )
    }
  },

  async run($) {
    const { testRun } = $.execution
    const { items: rawItems } = $.step.parameters
    const parsedResult = inputSchema.safeParse({ data: rawItems, testRun })

    if (parsedResult.success === false) {
      throw new StepError({
        name: 'Invalid input list',
        solution: 'Select a valid input list',
        kind: isEmptyOrNonJsonInput(rawItems, testRun) ? 'config' : 'internal',
      })
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
      throw new StepError({
        name: 'Invalid input list',
        solution: 'Select a valid input list',
        kind: 'internal',
      })
    }
  },
}

export default action
