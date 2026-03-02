import { startActiveObservation } from '@langfuse/tracing'
import { generateObject } from 'ai'
import z from 'zod/v3'
import { fromZodError } from 'zod-validation-error'

import appConfig from '@/config/app'
import {
  AI_BUILDER_PROMPT_CONFIG_FEATURE_FLAG,
  AI_BUILDER_PROMPT_CONFIG_FEATURE_FLAG_FALLBACK,
} from '@/config/flags'
import { BadUserInputError, ForbiddenError } from '@/errors/graphql-errors'
import { getLdFlagValue } from '@/helpers/launch-darkly'
import { model, MODEL_TYPE } from '@/helpers/pair'
import { getPrompt } from '@/helpers/pair/get-prompt'

import { MutationResolvers } from '../../__generated__/types.generated'

import { REFINE_FORM_INPUT_SCHEMA } from './schemas/input.zod'

const refineFormInput: MutationResolvers['refineFormInput'] = async (
  _parent,
  params,
  context,
) => {
  if (!context.currentUser) {
    throw new ForbiddenError('Not authorised!')
  }

  try {
    const validatedInput = REFINE_FORM_INPUT_SCHEMA.parse(params.input)
    const { prompt: userPrompt, sessionId } = validatedInput

    const promptConfig = await getLdFlagValue(
      AI_BUILDER_PROMPT_CONFIG_FEATURE_FLAG,
      context.currentUser.email,
      AI_BUILDER_PROMPT_CONFIG_FEATURE_FLAG_FALLBACK,
    )
    const { refineFormInputPrompt, version } = promptConfig
    const prompt = await getPrompt(refineFormInputPrompt, version)
    const { prompt: systemPrompt } = prompt

    const result = await startActiveObservation(
      'refine-form-input',
      async (trace) => {
        trace.updateTrace({
          userId: context.currentUser.email,
          environment: appConfig.appEnv,
          tags: ['ai-builder', 'form', 'refine-form-input'],
          sessionId: sessionId ?? '',
        })

        trace.update({
          input: {
            prompt: userPrompt,
          },
        })

        const generation = trace.startObservation(
          'refine-form-input',
          {
            model: MODEL_TYPE,
            input: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
          },
          { asType: 'generation' },
        )

        generation.update({ prompt })

        const { object } = await generateObject({
          model,
          schema: z.object({
            status: z.boolean(),
            suggestion: z.string(),
          }),
          system: systemPrompt,
          prompt: userPrompt,
          experimental_telemetry: {
            isEnabled: true,
            functionId: 'refine-form-input',
          },
        })

        trace.update({ output: object })

        generation.update({ output: object }).end()

        return object
      },
    )

    return result
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new BadUserInputError(fromZodError(error).details[0].message)
    }

    throw new Error('Encountered an error, please try again.')
  }
}

export default refineFormInput
