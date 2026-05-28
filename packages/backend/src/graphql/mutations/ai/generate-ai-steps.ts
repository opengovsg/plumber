import z from 'zod/v3'

import { BadUserInputError, ForbiddenError } from '@/errors/graphql-errors'
import { getAiBuilderFlag } from '@/helpers/ai/get-ai-builder-flag'
import {
  formatWorkflowError,
  parseWorkflowMetadata,
  WorkflowData,
} from '@/helpers/ai/parse-workflow-metadata'
import { getAllLdFlags, getRestrictedAppKeys } from '@/helpers/launch-darkly'
import logger from '@/helpers/logger'
import JSONObject from '@/types/interfaces/json-object'

import { MutationResolvers } from '../../__generated__/types.generated'

import { getActionsSchema } from './schemas/actions.zod'
import { INPUT_SCHEMA } from './schemas/input.zod'
import { getTriggerSchema } from './schemas/triggers.zod'

const generateAiSteps: MutationResolvers['generateAiSteps'] = async (
  _parent,
  params,
  context,
) => {
  const allLdFlags = await getAllLdFlags(context.currentUser.email)
  const aiBuilderFlag = getAiBuilderFlag(allLdFlags)

  if (!aiBuilderFlag.enabled) {
    throw new ForbiddenError('You do not have permissions to use AI Builder!')
  }

  const restrictedApps = getRestrictedAppKeys(allLdFlags)
  const triggerSchema = getTriggerSchema(restrictedApps)
  const actionsSchema = getActionsSchema(restrictedApps)

  let workflowData: WorkflowData | undefined

  try {
    const validatedInput = INPUT_SCHEMA.parse(params.input)
    const { prompt: userPrompt, traceId } = validatedInput

    if (!context.currentUser) {
      throw new ForbiddenError('Not authorised!')
    }

    workflowData = parseWorkflowMetadata(userPrompt)

    const schema = z.object({
      trigger: triggerSchema,
      actions: actionsSchema,
      name: z.string().max(64).default('Build with AI'),
    })

    const result = schema.parse(workflowData)

    return {
      ...result,
      actions: result.actions.map((action) => ({
        ...action,
        config: {
          ...action.config,
          templateConfig: {},
        },
      })),
      traceId,
    } as JSONObject
  } catch (error) {
    if (error instanceof BadUserInputError || error instanceof ForbiddenError) {
      throw error
    }

    if (error instanceof z.ZodError) {
      const message = formatWorkflowError(error, workflowData)
      logger.error('Error generating ai steps', {
        error,
        message,
        user: context.currentUser.email,
      })
      throw new BadUserInputError(message)
    }

    logger.error('Error generating ai steps', {
      error,
      user: context.currentUser.email,
    })

    throw new Error('Encountered an error, please try again.')
  }
}

export default generateAiSteps
