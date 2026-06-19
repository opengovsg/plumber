import { IRawAction } from '@plumber/types'

import { generateObject } from 'ai'
import z from 'zod/v3'
import { fromZodError } from 'zod-validation-error'

import appConfig from '@/config/app'
import StepError, { GenericSolution } from '@/errors/step'
import logger from '@/helpers/logger'
import { engineProvider } from '@/helpers/pair'

import getDataOutMetadata from '../../common/get-data-out-metadata'
import { getImageContent } from '../../common/get-image-content'

import { schema } from './schema'

const model = engineProvider.chat(appConfig.pair.foundry.imageModel)

const action: IRawAction = {
  name: 'Process an image',
  key: 'processImage',
  description: 'Extract information from an image or PDF',
  linkToGuide: 'https://guide.plumber.gov.sg/user-guides/actions/pair',
  arguments: [
    {
      label: 'Image',
      description: 'Select an image from a previous step',
      key: 'image',
      type: 'attachment' as const,
      required: true,
      variableTypes: ['file'],
      // TODO(kevinkim-ogp): restrict the supported file types
      maxFiles: 1,
      disableUpload: true,
    },
    {
      label: 'What do you want to extract?',
      description: 'Use these as variables in later steps',
      key: 'responseFields',
      type: 'multirow-multicol' as const,
      required: true,
      addRowButtonText: 'Add another',
      subFields: [
        {
          key: 'description',
          label: 'What to look for',
          placeholder: 'Whether the image contains a handwritten signature',
          type: 'string',
          required: true,
          customStyle: { flex: 3 },
        },
        {
          key: 'fieldName',
          label: 'Output name',
          placeholder: 'Signature present',
          type: 'string',
          required: true,
          customStyle: { flex: 1 },
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
        error?.message
          ? `Failed to process image: ${error.message}`
          : 'Failed to process image',
        'Please try again.',
        error,
      )
    }
  },
}

export default action
