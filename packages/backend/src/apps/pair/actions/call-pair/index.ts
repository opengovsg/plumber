import { IRawAction } from '@plumber/types'

import { fromZodError } from 'zod-validation-error'

import generateText from '@/apps/pair/common/generateText'
import StepError, { GenericSolution } from '@/errors/step'

import { schema } from './schema'

const action: IRawAction = {
  name: 'Pair',
  key: 'callPair',
  description:
    'Enter a custom prompt to summarise, categorise or analyse data with Pair',
  arguments: [
    // TODO (kevinkim-ogp): each option should link to a different
    // default value for the prompt. update when the default value is provided
    {
      label: 'What would you like to do?',
      key: 'promptType',
      type: 'dropdown' as const,
      required: true,
      options: [
        { label: 'Analyse', value: 'analyse' },
        { label: 'Categorise', value: 'categorise' },
        { label: 'Summarise', value: 'summarise' },
        { label: 'Write', value: 'write' },
        {
          label: 'Custom prompt',
          value: 'custom',
          description: 'Do it yourself',
        },
      ],
      showOptionValue: false,
    },
    {
      label: 'Prompt',
      key: 'prompt',
      type: 'rich-text' as const,
      required: true,
      variables: true,
      customRteMenuOptions: [
        'Bold',
        'Italic',
        'Underline',
        'divider', // specify when to show a divider
        'Heading 1',
        'Heading 2',
        'Heading 3',
        'Heading 4',
        'Bullet List',
        'Ordered List',
        'divider',
        'Undo',
        'Redo',
      ],
      returnMarkdown: true,
    },
    {
      label: 'How do you want the response?',
      key: 'responseFormat',
      type: 'dropdown' as const,
      required: true,
      showOptionValue: false,
      options: [
        { label: 'A single text response', value: 'singleField' },
        {
          label: 'Separate fields (split into multiple outputs)',
          value: 'multipleFields',
        },
      ],
    },
    {
      label: 'Response fields',
      key: 'responseFields',
      type: 'multirow-multicol' as const,
      required: true,
      hiddenIf: {
        fieldKey: 'responseFormat',
        fieldValue: 'multipleFields',
        op: 'not_equals',
      },
      subFields: [
        {
          placeholder: 'Field name',
          key: 'fieldName',
          type: 'string' as const,
          required: true,
          variables: false,
        },
        {
          placeholder: 'Field type',
          key: 'fieldType',
          type: 'dropdown' as const,
          required: true,
          showOptionValue: false,
          options: [
            { label: 'Text', value: 'text' },
            { label: 'Number', value: 'number' },
            { label: 'Category', value: 'category' },
          ],
        },
        {
          placeholder: 'Categories (comma-separated)',
          key: 'fieldCategories',
          type: 'string' as const,
          variables: true,
          hiddenIf: {
            fieldKey: 'fieldType',
            fieldValue: 'category',
            op: 'not_equals',
          },
          customStyle: { flex: 3 },
        },
      ],
    },
  ],

  async run($) {
    const validatedParameters = schema.safeParse($.step.parameters)

    if (!validatedParameters.success) {
      const firstError = fromZodError(validatedParameters.error).details[0]
      throw new StepError(
        firstError.message,
        GenericSolution.ReconfigureInvalidField,
        $.step.position,
        $.app.name,
      )
    }

    const { prompt } = validatedParameters.data

    const response = await generateText(prompt, $)

    $.setActionItem({
      raw: { data: response },
    })
  },
}

export default action
