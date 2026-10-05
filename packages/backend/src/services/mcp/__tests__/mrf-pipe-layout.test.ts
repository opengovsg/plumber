import { describe, expect, it } from 'vitest'

import type { ParsedMrfWorkflow } from '@/apps/formsg/common/types'

import type { McpStepInput } from '../create-flow-with-steps'
import { orderMrfPipeSteps, validateMrfPlacements } from '../mrf-pipe-layout'

const stage = (name: string, approvalField?: string) => ({
  defaultStepName: name,
  type: 'static' as const,
  fields: [] as string[],
  formWorkflowStepId: name,
  approvalField,
})

// Stage 1 is the trigger's stage, 2 is an approval, 3 is the last stage.
const workflow = {
  trigger: stage('Requestor'),
  actions: [stage('Approval', 'field-a'), stage('Final')],
} as unknown as ParsedMrfWorkflow

const trigger: McpStepInput = {
  appKey: 'formsg',
  key: 'newSubmission',
  type: 'trigger',
  position: 1,
}

function action(
  key: string,
  mrfStage: number,
  extra: Partial<McpStepInput> = {},
  appKey = 'postman',
): McpStepInput {
  return { appKey, key, type: 'action', position: 0, mrfStage, ...extra }
}

const forEach = (mrfStage: number, extra: Partial<McpStepInput> = {}) =>
  action('forEach', mrfStage, extra, 'toolbox')

const pipe = (...actions: McpStepInput[]) => [
  trigger,
  ...actions.map((a, i) => ({ ...a, position: i + 2 })),
]

describe('validateMrfPlacements', () => {
  it('accepts a For-each at the end of the last stage', () => {
    expect(() =>
      validateMrfPlacements(pipe(action('email', 3), forEach(3)), workflow),
    ).not.toThrow()
  })

  it('accepts a For-each at the end of a reject path on an earlier stage', () => {
    expect(() =>
      validateMrfPlacements(
        pipe(action('email', 3), forEach(2, { mrfBranch: 'reject' })),
        workflow,
      ),
    ).not.toThrow()
  })

  it('rejects an approve-path For-each on a stage that is not the last', () => {
    expect(() => validateMrfPlacements(pipe(forEach(2)), workflow)).toThrow(
      'only go on the last stage (3)',
    )
  })

  it('rejects a step listed after a For-each on the same path', () => {
    expect(() =>
      validateMrfPlacements(pipe(forEach(3), action('email', 3)), workflow),
    ).toThrow('last action on its path')
  })

  it('allows a step on another path after a For-each', () => {
    expect(() =>
      validateMrfPlacements(
        pipe(forEach(2, { mrfBranch: 'reject' }), action('email', 3)),
        workflow,
      ),
    ).not.toThrow()
  })

  it('rejects an action with no stage', () => {
    expect(() =>
      validateMrfPlacements(
        [trigger, { ...action('email', 2), mrfStage: undefined, position: 2 }],
        workflow,
      ),
    ).toThrow('needs mrf_stage')
  })

  it('rejects a reject path on a stage with no approval', () => {
    expect(() =>
      validateMrfPlacements(
        pipe(action('email', 3, { mrfBranch: 'reject' })),
        workflow,
      ),
    ).toThrow('not an approval stage')
  })

  it('rejects placement fields when the form is not MRF', () => {
    expect(() =>
      validateMrfPlacements(pipe(action('email', 2)), undefined),
    ).toThrow('only apply to an MRF form')
  })
})

describe('orderMrfPipeSteps', () => {
  const keys = (steps: McpStepInput[]) => steps.map((s) => s.key)

  it('orders by stage, with the approve path before the reject path', () => {
    const ordered = orderMrfPipeSteps(
      pipe(
        action('reject2', 2, { mrfBranch: 'reject' }),
        action('final', 3),
        action('approve2', 2),
      ),
    )

    expect(keys(ordered)).toEqual([
      'newSubmission',
      'approve2',
      'reject2',
      'final',
    ])
  })

  it('keeps the listed order inside the same stage and path', () => {
    const ordered = orderMrfPipeSteps(
      pipe(action('b', 2), action('a', 2), action('c', 2)),
    )

    expect(keys(ordered)).toEqual(['newSubmission', 'b', 'a', 'c'])
  })

  it('moves an If block with the steps inside it', () => {
    const ordered = orderMrfPipeSteps([
      trigger,
      action('later', 3, { position: 2 }),
      action('ifThen', 2, { position: 3, ifThenChildCount: 1 }, 'toolbox'),
      { ...action('inner', 0), mrfStage: undefined, position: 4 },
    ])

    expect(keys(ordered)).toEqual(['newSubmission', 'ifThen', 'inner', 'later'])
  })

  it('renumbers the positions of the ordered steps', () => {
    const ordered = orderMrfPipeSteps(
      pipe(action('final', 3), action('approve2', 2)),
    )

    expect(ordered.map((s) => s.position)).toEqual([1, 2, 3])
  })
})
