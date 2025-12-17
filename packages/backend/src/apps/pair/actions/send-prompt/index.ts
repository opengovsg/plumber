import { IRawAction } from '@plumber/types'

import TurndownService from 'turndown'
import { fromZodError } from 'zod-validation-error'

import StepError, { GenericSolution } from '@/errors/step'

import {
  DEFAULT_PROMPT_VALUES,
  DEFAULT_RESPONSE_FIELDS_VALUES,
} from '../../common/constants'
import generateObject from '../../common/generate-object'
import { generateSchemaFromFields } from '../../common/generate-schema'

import getDataOutMetadata from './get-data-out-metadata'
import { schema } from './schema'

const turndownService = new TurndownService()

const action: IRawAction = {
  name: 'Ask Pair',
  key: 'sendPrompt',
  description:
    'Enter a custom prompt to summarise, categorise or analyse data with Pair',
  arguments: [
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
      defaultValue: {
        fieldKey: 'promptType',
        options: DEFAULT_PROMPT_VALUES,
      },
    },
    {
      label: 'How do you want the response?',
      key: 'responseFields',
      type: 'multirow-multicol' as const,
      required: true,
      hiddenIf: {
        fieldKey: 'promptType',
        op: 'is_empty',
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
      defaultValue: {
        fieldKey: 'promptType',
        options: DEFAULT_RESPONSE_FIELDS_VALUES,
      },
    },
  ],

  getDataOutMetadata,

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

    const { prompt, responseFields } = validatedParameters.data

    /**
     * As the prompt is entered using the Tiptap editor, it is stored as HTML.
     * We convert it to markdown as LLMs interpret markdown much better than HTML.
     *
     * NOTE: we also don't convert to markdown directly on the Tiptap editor as
     * it involves more work to convert the markdown back to HTML for displaying
     * in the editor.
     */
    const convertedPrompt = turndownService.turndown(prompt)

    const dynamicSchema = generateSchemaFromFields(responseFields)

    const response = await generateObject(convertedPrompt, dynamicSchema, {
      userId: $.user.email,
      flowId: $.flow.id,
      stepId: $.step.id,
      executionId: $.execution.id,
      tags: ['pair', 'action', 'generate-text'],
    })

    $.setActionItem({
      raw: { ...response },
    })
  },
}

export default action
