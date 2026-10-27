import { IDynamicData } from '@plumber/types'

import apps from '@/apps'
import { BadUserInputError } from '@/errors/graphql-errors'
import { loadAccessibleStep } from '@/services/access'
import {
  runStepDynamicData,
  shouldRunDynamicDataAsOwner,
} from '@/services/dynamic-data'

import type { QueryResolvers } from '../__generated__/types.generated'

const getDynamicData: QueryResolvers['getDynamicData'] = async (
  _parent,
  params,
  context,
) => {
  const { stepId, key: dynamicDataKey, parameters } = params

  const step = await loadAccessibleStep({
    user: context.currentUser,
    stepId,
    role: 'viewer',
    graph: {
      connection: true,
      flow: {
        user: true,
      },
    },
  })

  if (!step || !step.appKey) {
    return null
  }

  const app = apps[step.appKey]
  const connection = step.connection

  if (app.auth && !connection) {
    return null
  }

  const command = app.dynamicData.find(
    (data) => data.key === dynamicDataKey,
  ) as IDynamicData | undefined

  if (!command) {
    throw new BadUserInputError(`Dynamic data ${dynamicDataKey} not found`)
  }

  const result = await runStepDynamicData({
    user: context.currentUser,
    step,
    command,
    parameters,
    runAsOwner: shouldRunDynamicDataAsOwner(step),
  })

  if (result.ok === false) {
    throw new Error(JSON.stringify(result.error))
  }

  return result.data
}

export default getDynamicData
