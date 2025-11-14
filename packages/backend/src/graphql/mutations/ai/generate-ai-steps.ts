import { startActiveObservation } from '@langfuse/tracing'
import { generateObject } from 'ai'
import z from 'zod/v3'
import { fromZodError } from 'zod-validation-error'

import appConfig from '@/config/app'
import { BadUserInputError, ForbiddenError } from '@/errors/graphql-errors'
import { langfuseClient } from '@/helpers/langfuse'
import { getLdFlagValue } from '@/helpers/launch-darkly'
import { model, MODEL_TYPE } from '@/helpers/pair'
import JSONObject from '@/types/interfaces/json-object'

import { MutationResolvers } from '../../__generated__/types.generated'

import { Action, ACTION_SCHEMA } from './schemas/actions.zod'
import { INPUT_SCHEMA } from './schemas/input.zod'
import { TRIGGER_SCHEMA } from './schemas/triggers.zod'

const generateAiSteps: MutationResolvers['generateAiSteps'] = async (
  _parent,
  params,
  context,
) => {
  const promptConfig = await getLdFlagValue(
    'ai-builder-prompt-config',
    context.currentUser.email,
    {
      objectPrompt: 'ai-builder/form',
      version: 'production',
    },
  )
  const { objectPrompt: promptName, version } = promptConfig

  try {
    const validatedInput = INPUT_SCHEMA.parse(params.input)
    const { trigger: triggerInput, actions: actionsInput } = validatedInput
    const userPrompt = `**trigger**:\n${triggerInput}\n\n**actions**:\n${actionsInput}`

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
      'generate-ai-steps',
      async (trace) => {
        trace.updateTrace({
          userId: context.currentUser.email,
          environment: appConfig.appEnv,
          tags: ['graphql', 'ai-steps', 'generate-object'],
        })

        trace.update({
          input: {
            prompt: userPrompt,
          },
        })

        const generation = trace.startObservation(
          'ai-stream-generation',
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
            actions: z.array(ACTION_SCHEMA),
          }),
          system: systemPrompt,
          prompt: userPrompt,
          experimental_telemetry: {
            isEnabled: true,
            functionId: 'generate-ai-steps',
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

    const { object } = { object: result }

    return {
      ...object,
      actions: (object.actions as Action[]).map((action: Action) => ({
        ...action,
        config: {
          ...action.config,
          templateConfig: {}, // add this by default so it does not complain
        },
      })),
    } as JSONObject
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new BadUserInputError(fromZodError(error).details[0].message)
    }

    throw new Error('Encountered an error, please try again.')
  }
}

export default generateAiSteps
