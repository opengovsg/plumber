import { IRawAction } from '@plumber/types'

import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { generateObject } from 'ai'
import z from 'zod/v3'
import { fromZodError } from 'zod-validation-error'

import appConfig from '@/config/app'
import StepError, { GenericSolution } from '@/errors/step'
import logger from '@/helpers/logger'

import { getImageContent } from '../../common/get-image-content'

import getDataOutMetadata from './get-data-out-metadata'
import { schema } from './schema'

const engineProvider = createOpenAICompatible({
  name: 'pair-engine',
  baseURL: 'https://engine.pair.gov.sg',
  apiKey: appConfig.pair.foundry.apiKey,
  supportsStructuredOutputs: true,
})
const model = engineProvider.chatModel(appConfig.pair.foundry.imageModel)

const action: IRawAction = {
  name: 'Process image',
  key: 'processImage',
  description: 'Process an image',
  arguments: [
    {
      label: 'Image',
      key: 'image',
      type: 'attachment' as const,
      required: true,
      variableTypes: ['file'],
      // TODO(kevinkim-ogp): restrict the supported file types
    },
    {
      label: 'Response field(s)',
      key: 'responseFields',
      type: 'multirow-multicol' as const,
      required: true,
      subFields: [
        {
          key: 'fieldName',
          placeholder: 'Field name',
          type: 'string',
          required: true,
          customStyle: { flex: 1 },
        },
        {
          key: 'description',
          placeholder: 'Description',
          type: 'string',
          required: true,
          customStyle: { flex: 3 },
        },
      ],
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
    const { image, responseFields } = validatedParameters.data

    try {
      const schemaShape: Record<string, z.ZodTypeAny> = {}
      for (const field of responseFields) {
        schemaShape[field.fieldName] = z.string().describe(field.description)
      }
      const responseSchema = z.object(schemaShape).strict()

      const content = await getImageContent(image[0])

      const { object } = await generateObject({
        model,
        schema: responseSchema,
        messages: [
          {
            role: 'user',
            content,
          },
        ],
        experimental_telemetry: {
          isEnabled: true,
          functionId: 'pair-action-process-image',
          metadata: {
            userId: $.user.email,
            executionId: $.execution.id,
            flowId: $.flow.id,
            stepId: $.step.id,
            tags: ['pair', 'action', 'process-image'],
          },
        },
      })

      $.setActionItem({
        raw: { ...object },
      })
    } catch (error) {
      logger.error('Failed to process image', {
        error,
        flowId: $.flow.id,
        executionId: $.execution.id,
        stepId: $.step.id,
        userId: $.user.email,
        s3Id: image[0],
      })

      throw new StepError(
        'Failed to process image',
        'Please try again.',
        $.step.position,
        $.app.name,
        error,
      )
    }
  },
}

export default action
