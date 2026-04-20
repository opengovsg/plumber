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
  name: 'Use Pair',
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
      label: 'Describe what you want Pair to do',
      key: 'prompt',
      type: 'rich-text' as const,
      required: true,
      variables: true,
      /**
       * TODO (kevinkim-ogp): monitor this feature to see if we
       * need to add the custom RTE menu options back.
       *
       * The initial release uses the RTE so users can still format
       * using keyboard shortcuts, but hides the menu bar to keep
       * this feature simple.
       */
      customRteMenuOptions: [],
      defaultValue: {
        fieldKey: 'promptType',
        options: DEFAULT_PROMPT_VALUES,
      },
    },
    {
      label: 'Define how you want Pair to structure what it extracts',
      description: 'Use these as variables in later steps',
      key: 'responseFields',
      type: 'multirow-multicol' as const,
      required: true,
      hiddenIf: {
        fieldKey: 'promptType',
        op: 'is_empty',
      },
      subFields: [
        {
          label: 'Type',
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
          label: 'Output name',
          placeholder: 'E.g., Priority level',
          key: 'fieldName',
          type: 'string' as const,
          required: true,
          variables: false,
        },
        {
          label: 'Categories',
          placeholder: 'Separated by commas',
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
