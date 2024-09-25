import type { IGlobalVariable, IRawAction } from '@plumber/types'

import StepError from '@/errors/step'
import Step from '@/models/step'

import conditionIsTrue from '../../common/condition-is-true'
import getConditionArgs from '../../common/get-condition-args'

async function getNextBranchStepId($: IGlobalVariable) {
  const flowSteps = await Step.query()
    .where('flow_id', $.flow.id)
    .orderBy('position', 'asc')
    .throwIfNotFound()

  // search for immediate branch before current step
  const currBranchStep = flowSteps
    .slice(0, $.step.position)
    .reverse()
    .find((step) => step.appKey === 'toolbox' && step.key === 'ifThen')

  // no branches so no next branch step to skip to
  if (!currBranchStep) {
    return null
  }

  const currDepth = parseInt(currBranchStep.parameters?.depth as string)
  if (isNaN(currDepth)) {
    throw new Error(
      `Branch depth for current branch step ${currBranchStep.id} is not defined.`,
    )
  }

  // search for next branch after current step
  const nextBranchStep = flowSteps.slice($.step.position).find((step) => {
    if (!(step.appKey === 'toolbox' && step.key === 'ifThen')) {
      return false
    }

    const nextBranchDepth = parseInt(step.parameters?.depth as string)
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
  name: 'Only continue if',
  key: 'onlyContinueIf',
  description: 'Only runs later actions if specified conditions are met',
  arguments: getConditionArgs({ usePlaceholders: false }),

  async run($) {
    let result
    try {
      result = conditionIsTrue($.step.parameters)
    } catch (err) {
      throw new StepError(
        err.message,
        'Click on set up action and check that one of valid options in the condition dropdown is being selected.',
        $.step.position,
        $.app.name,
      )
    }
    $.setActionItem({
      raw: { result },
    })

    // only check for next branch step to jump to if result is false
    if (!result) {
      const nextBranchStepId = await getNextBranchStepId($)
      return nextBranchStepId
        ? {
            nextStep: {
              command: 'jump-to-step',
              stepId: nextBranchStepId as string,
            },
          }
        : { nextStep: { command: 'stop-execution' } }
    }
  },
}

export default action
