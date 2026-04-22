import { startActiveObservation } from '@langfuse/tracing'
import { generateObject } from 'ai'
import z from 'zod/v3'
import { fromZodError } from 'zod-validation-error'

import appConfig from '@/config/app'
import {
  AI_BUILDER_FEATURE_FLAG,
  AI_BUILDER_FEATURE_FLAG_FALLBACK,
} from '@/config/flags'
import { BadUserInputError, ForbiddenError } from '@/errors/graphql-errors'
import { langfuseClient } from '@/helpers/langfuse'
import { getLdFlagValue } from '@/helpers/launch-darkly'
import logger from '@/helpers/logger'
import { model, MODEL_TYPE } from '@/helpers/pair'
import JSONObject from '@/types/interfaces/json-object'

import { MutationResolvers } from '../../__generated__/types.generated'

import { Action, ACTIONS_SCHEMA } from './schemas/actions.zod'
import { INPUT_SCHEMA } from './schemas/input.zod'
import { TRIGGER_SCHEMA } from './schemas/triggers.zod'

const generateAiSteps: MutationResolvers['generateAiSteps'] = async (
  _parent,
  params,
  context,
) => {
  const aiBuilderFlag = await getLdFlagValue(
    AI_BUILDER_FEATURE_FLAG,
    context.currentUser.email,
    AI_BUILDER_FEATURE_FLAG_FALLBACK,
  )

  if (!aiBuilderFlag.enabled) {
    throw new ForbiddenError('You do not have permissions to use AI Builder!')
  }

  const { generateStepsPromptName: promptName, version } = aiBuilderFlag.config
  let traceId

  try {
    const validatedInput = INPUT_SCHEMA.parse(params.input)
    const { prompt: userPrompt, sessionId } = validatedInput

    if (!context.currentUser) {
      throw new ForbiddenError('Not authorised!')
    }

    // NOTE: we get the entire prompt object so that we can pass it to generation.update
    // to link the generation to the prompt in Rome (Langfuse)
    const prompt = await langfuseClient.prompt.get(promptName, {
      label: version,
    })
    const { prompt: systemPrompt } = prompt

    const result = await startActiveObservation(
      'generate-steps',
      async (trace) => {
        const tags = ['ai-builder', 'generate-steps']

        traceId = trace.traceId
        trace.updateTrace({
          userId: context.currentUser.email,
          environment: appConfig.appEnv,
          tags,
          sessionId: sessionId ?? '',
        })

        trace.update({
          input: {
            prompt: userPrompt,
          },
        })

        const generation = trace.startObservation(
          'generate-steps',
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
            trigger: TRIGGER_SCHEMA,
            actions: ACTIONS_SCHEMA,
            name: z.string().max(64).default('Build with AI'),
          }),
          system: systemPrompt,
          prompt: userPrompt,
          experimental_telemetry: {
            isEnabled: true,
            functionId: 'generate-steps',
            metadata: {
              name: 'generate-steps',
              sessionId: sessionId || 'unknown',
              userId: context.currentUser.email,
              environment: appConfig.appEnv,
              promptName,
              promptVersion: version,
              langfusePrompt: prompt.toJSON(),
              tags: ['ai-builder', 'generate-steps'],
            },
          },
        })

        trace.update({
          output: {
            trigger: object.trigger,
            actions: object.actions,
          },
        })

        generation.update({ output: object }).end()

        return object
      },
    )

    return {
      ...result,
      actions: (result.actions as Action[]).map((action: Action) => ({
        ...action,
        config: {
          ...action.config,
          templateConfig: {}, // add this by default so it does not complain
        },
      })),
      traceId,
    } as JSONObject
  } catch (error) {
    logger.error('Error generating ai steps', {
      error,
      user: context.currentUser.email,
    })

    if (error instanceof z.ZodError) {
      throw new BadUserInputError(fromZodError(error).details[0].message)
    }

    throw new Error('Encountered an error, please try again.')
  }
}

export default generateAiSteps
