import { IRawAction } from '@plumber/types'

import StepError from '@/errors/step'

import getDataOutMetadata from './get-data-out-metadata'

const action: IRawAction = {
  name: 'For each',
  key: 'forEach',
  description: 'Repeat actions for each item',
  groupsLaterSteps: true,
  arguments: [
    {
      label: 'Choose items',
      description:
        'Supported items include rows in Tiles/M365 Excel and FormSG checkboxes',
      key: 'forEachInputList',
      type: 'string' as const,
      required: true,
      variables: true,
      variableTypes: ['array', 'multiple-row-object'],
    },
  ],

  getDataOutMetadata,

  async run($) {
    const { forEachInputList } = $.step.parameters as {
      forEachInputList: string
    }

    try {
      const isJsonString =
        forEachInputList.includes('[') || forEachInputList.includes('{')
      const inputList = isJsonString
        ? JSON.parse(forEachInputList)
        : forEachInputList.split(',').map((item) => item.trim())

      $.setActionItem({
        raw: {
          iterations: isJsonString ? inputList.rows.length : inputList.length,
        },
      })
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
