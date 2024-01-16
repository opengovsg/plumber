import type {
  IGlobalVariable,
  IJSONObject,
  IRawAction,
  IStep,
} from '@plumber/types'

import StepError from '@/errors/step'
import Step from '@/models/step'

import toolboxApp from '../..'
import conditionIsTrue from '../../common/condition-is-true'
import getConditionArgs from '../../common/get-condition-args'

const ACTION_KEY = 'ifThen'

function shouldTakeBranch($: IGlobalVariable): boolean {
  const conditions = $.step.parameters.conditions as IJSONObject[]
  if (!Array.isArray(conditions)) {
    throw new Error('No conditions found')
  }
  return conditions.every((condition) => conditionIsTrue(condition))
}

async function getBranchStepIdToSkipTo(
  $: IGlobalVariable,
): Promise<IStep['id']> {
  const currDepth = parseInt($.step.parameters.depth as string)
  if (isNaN(currDepth)) {
    throw new Error(
      `Branch depth for initial branch step ${$.step.id} is not defined.`,
    )
  }

  // PERF-FIXME: Objectionjs does no caching, so this will almost always be
  // queried multiple times by the same worker during a test run. If it does
  // turn out to impact perf, we can LRU memoize this by executionId.
  const flowSteps = await Step.query()
    .where('flow_id', $.flow.id)
    .orderBy('position', 'asc')
    .throwIfNotFound()

  const nextBranchStep = flowSteps.slice($.step.position).find((step) => {
    if (!(step.appKey === toolboxApp.key && step.key === ACTION_KEY)) {
      return false
    }

    const nextBranchDepth = parseInt(step.parameters.depth as string)
    if (isNaN(nextBranchDepth)) {
      throw new Error(
        `Branch depth for future branch step ${$.step.id} is not defined.`,
      )
    }

    return nextBranchDepth <= currDepth
  })

  return nextBranchStep?.['id']
}

const action: IRawAction = {
  name: 'If-then',
  key: ACTION_KEY,
  description:
    'Creates different sub-pipes that will execute if specified conditions are met',
  groupsLaterSteps: true,
  arguments: [
    {
      label: 'Branch Name',
      key: 'branchName',
      type: 'string' as const,
      required: true,
      variables: false,
    },
    {
      // This is computed by the front-end when adding a step.
      key: 'depth',
      type: 'string' as const,
      label: 'FILE A BUG IF YOU SEE THIS',

      hidden: true,
      required: false,
      variables: false,
    },
    {
      label: 'Conditions',
      key: 'conditions',
      type: 'multirow' as const,
      required: true,
      description:
        'Every condition has to be satisfied for this branch to be taken.',
      subFields: getConditionArgs({ usePlaceholders: true }),
    },
  ],

  async run($) {
    let isConditionMet
    try {
      isConditionMet = shouldTakeBranch($)
    } catch (err) {
      throw new StepError(
        err.message,
        'Click on set up action and check that the condition has been configured properly.',
        $.step.position,
        $.app.name,
      )
    }
    $.setActionItem({
      raw: { isConditionMet },
    })

    if (isConditionMet) {
      return
    }

    const nextStepId = await getBranchStepIdToSkipTo($)
    return nextStepId
      ? {
          nextStep: {
            command: 'jump-to-step',
            stepId: nextStepId as string,
          },
        }
      : {
          nextStep: { command: 'stop-execution' },
        }
  },
}

export default action
