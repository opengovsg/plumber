import { IJSONObject, IRawAction } from '@plumber/types'
import { generateObject } from 'ai'
import z from 'zod'
import { fromZodError } from 'zod-validation-error'

import appConfig from '@/config/app'
import StepError, { GenericSolution } from '@/errors/step'
import logger from '@/helpers/logger'
import { engineProvider } from '@/helpers/pair'
import Step from '@/models/step'

import getDataOutMetadata from '../../common/get-data-out-metadata'
import { getImageContent } from '../../common/get-image-content'
import { hasProvidedImage, schema } from './schema'

const model = engineProvider.chat(appConfig.pair.foundry.imageModel)

const action: IRawAction = {
  name: 'Process image',
  key: 'processImage',
  description: 'Extract data or synthesise content from an image or PDF',
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
      label: 'What should Pair give you back? (use in later steps)',
      key: 'responseFields',
      type: 'multirow-multicol' as const,
      required: true,
      addRowButtonText: 'Add output',
      subFields: [
        {
          key: 'description',
          label: 'What to look for',
          placeholder:
            'e.g. Whether the image contains a handwritten signature',
          type: 'string',
          required: true,
          customStyle: { flex: 3, minWidth: 0, maxWidth: '75%' },
        },
        {
          key: 'fieldName',
          label: 'Output name',
          placeholder: 'e.g. Signature present',
          type: 'string',
          required: true,
          customStyle: { flex: 1 },
        },
      ],
    },
    {
      label: 'How should we handle a missing image/file?',
      key: 'continueIfNoFile',
      type: 'boolean-radio' as const,
      required: true,
      description:
        'This can happen when the file comes from an optional FormSG field that is left blank.',
      value: false,
      options: [
        {
          label: 'Continue without it',
          description:
            "This step's outputs will be blank, and the rest of your pipe still runs. Choose this if your later steps work with a blank value.",
          value: true,
        },
        {
          label: 'Stop and fail this execution',
          description:
            'This execution stops here and is marked as failed. Other executions are not affected. Choose this if your later steps need the file.',
          value: false,
        },
      ],
    },
  ],

  doesFileProcessing: (step: Step) => {
    return (
      Array.isArray(step.parameters.image) && step.parameters.image.length > 0
    )
  },

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
    const { image, responseFields, continueIfNoFile } = validatedParameters.data

    if (!hasProvidedImage(image) && continueIfNoFile) {
      $.setActionItem({
        raw: Object.fromEntries(
          responseFields.map((field) => [field.fieldName, '']),
        ) as IJSONObject,
      })
      return
    }

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
        raw: { ...object } as IJSONObject,
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
