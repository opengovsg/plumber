import {
  IActionRunResult,
  IGlobalVariable,
  IJSONArray,
  IJSONObject,
} from '@plumber/types'

import defineAction from '@/helpers/define-action'
import Step from '@/models/step'

function evalCondition(parameters: IJSONObject): boolean {
  const { field, is, condition, text } = parameters

  let result: boolean
  switch (condition) {
    case 'equals':
      result = field === text
      break
    case 'gte':
      result = Number(field) >= Number(text)
      break
    case 'gt':
      result = Number(field) > Number(text)
      break
    case 'lte':
      result = Number(field) <= Number(text)
      break
    case 'lt':
      result = Number(field) < Number(text)
      break
    case 'contains':
      result = field.toString().includes(text.toString())
      break
    default:
      throw new Error(
        `Conditional logic block contains an unknown operator: ${condition}`,
      )
  }

  if (is === 'not') {
    result = !result
  }

  return result
}

function shouldTakeBranch($: IGlobalVariable): boolean {
  const conditions = $.step.parameters.conditions as IJSONArray
  return conditions.every((condition) =>
    evalCondition(condition as IJSONObject),
  )
}

export default defineAction({
  name: 'If... Then',
  key: 'ifThen',
  description: '',
  groupsLaterSteps: true,
  arguments: [
    {
      label: 'Branch Name',
      key: 'branchName',
      type: 'string' as const,
      required: true,
      variables: false,
      description: 'A name that describes this If... Then branch',
    },
    {
      // This is computed by the front-end when adding a step.
      key: 'depth',
      type: 'string' as const,
      label: 'FILE A BUG IF YOU SEE THIS',

      // Field is hidden
      required: false,
      variables: false,
    },
    {
      // Stores a cached IActionRunResult['nextStep'] for use if the branch is
      // skipped. This is computed when pipe is published.
      key: 'nextStepIfSkipped',
      type: 'string' as const,
      label: 'FILE A BUG IF YOU SEE THIS',

      // Field is hidden.
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
      subFields: [
        {
          placeholder: 'Field',
          key: 'field',
          type: 'string' as const,
          required: true,
          variables: true,
        },
        {
          placeholder: 'Is or Not',
          key: 'is',
          type: 'dropdown' as const,
          required: true,
          variables: false,
          options: [
            { label: 'Is', value: 'is' },
            { label: 'Not', value: 'not' },
          ],
        },
        {
          placeholder: 'Condition',
          key: 'condition',
          type: 'dropdown' as const,
          required: true,
          variables: false,
          options: [
            { label: '=', value: 'equals' },
            { label: '>=', value: 'gte' },
            { label: '>', value: 'gt' },
            { label: '<=', value: 'lte' },
            { label: '<', value: 'lt' },
            { label: 'contains', value: 'contains' },
          ],
        },
        {
          placeholder: 'Text',
          key: 'text',
          type: 'string' as const,
          required: true,
          variables: true,
        },
      ],
    },
  ],

  async testRun($) {
    const isBranchTaken = shouldTakeBranch($)
    $.setActionItem({
      raw: { isBranchTaken },
    })

    if (isBranchTaken) {
      return {}
    }

    // For test runs, nextStepIfSkipped is not populated yet, so we compute the
    // next step manually.
    const currStep = await Step.query()
      .findById($.step.id)
      .withGraphFetched({ flow: { steps: true } })
    const nextStepId = currStep.flow.steps
      .slice(currStep.position)
      .find(
        (step) =>
          step.appKey === 'plumber-toolbelt' &&
          step.type === 'action' &&
          step.key === 'ifThen' &&
          parseInt(step.parameters.depth as string) <=
            parseInt(currStep.parameters.depth as string),
      )?.id

    let nextStep: IActionRunResult['nextStep'] | null = null
    if (nextStepId) {
      nextStep = {
        command: 'jump-to-step',
        stepId: nextStepId,
      }
    } else {
      nextStep = { command: 'stop-execution' }
    }

    return {
      nextStep,
    }
  },

  async run($) {
    const isBranchTaken = shouldTakeBranch($)
    $.setActionItem({
      raw: { isBranchTaken },
    })

    if (isBranchTaken) {
      return {}
    }

    const nextStep = $.step.parameters
      .nextStepIfSkipped as IActionRunResult['nextStep']
    if (!nextStep) {
      // Abort instead of calling computeNextStep, which is O(n) with DB
      // queries. Invoking that function at scale risks starving our worker
      // nodes if we have lots of pipes with this problem.
      throw new Error(
        'nextStepIfSkipped is unset in a published pipe, which should not be possible.',
      )
    }

    return {
      nextStep,
    }
  },
})
