import { IRawAction } from '@plumber/types'

import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { generateObject } from 'ai'
import z from 'zod/v3'
import { fromZodError } from 'zod-validation-error'

import appConfig from '@/config/app'
import StepError, { GenericSolution } from '@/errors/step'
import { getObjectFromS3Id } from '@/helpers/s3'

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
    const schemaShape: Record<string, z.ZodTypeAny> = {}
    for (const field of responseFields) {
      schemaShape[field.fieldName] = z.string().describe(field.description)
    }
    const responseSchema = z.object(schemaShape).strict()

    const S3Object = await getObjectFromS3Id(image[0])
    const base64Image = Buffer.from(S3Object.data).toString('base64')

    const { object } = await generateObject({
      model,
      schema: responseSchema,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              image: `data:image/jpeg;base64,${base64Image}`,
            },
            {
              type: 'text',
              text: 'Extract all the information from this file.',
            },
          ],
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
  },
}

export default action
