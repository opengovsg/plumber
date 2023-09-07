import type Context from '@/types/express/context'

import { type LoginWithSgidParams, type LoginWithSgidResult } from './common'
import { processInitialStep } from './initial-step'
import { processSpecificEmployment } from './specific-employment'

export default async function loginWithSgid(
  _parent: unknown,
  params: LoginWithSgidParams,
  context: Context,
): Promise<LoginWithSgidResult> {
  switch (params.input.type) {
    case 'INITIAL_STEP':
      if (!params.input.initialStep) {
        throw new Error('Missing params')
      }
      return await processInitialStep(params.input.initialStep, context)

    case 'SPECIFIC_EMPLOYMENT':
      if (!params.input.specificEmployment) {
        throw new Error('Missing params')
      }
      return await processSpecificEmployment(
        params.input.specificEmployment,
        context,
      )

    default:
      throw new Error(`Invalid type: ${params.input.type}`)
  }
}
