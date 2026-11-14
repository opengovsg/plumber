/**
 * Toolbox if-then rules.
 *
 * A pipe must respect these when an if-then end marker is saved or published.
 *
 * 1. The marked step is a toolbox if-then in this pipe.
 * 2. The end step is in this pipe.
 * 3. The end step is at or after the if-then.
 * 4. No MRF submission sits inside the block. The inside is every step after
 *    the if-then, up to and including the end step.
 * 5. Every step inside the block is on the same MRF rejection branch as the
 *    if-then.
 * 6. The block does not overlap another if-then block whose end marker
 *    resolves. A dangling end marker on that other block is not an overlap.
 * 7. An empty block, whose end marker is the if-then itself, may be saved.
 *    Publish rejects it.
 * 8. Publish checks only if-then steps that carry an endStepId key.
 *
 * These rules are the checks in checkEndStepWrite and validateFlowBlocks.
 * A failing case here means those checks drifted. Confirm with the user
 * before loosening an assertion.
 */
import type { IStepConfig } from '@plumber/types'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import logger from '@/helpers/logger'

import { BLOCK_END_STEP_ID } from '../../common/constants'
import {
  validateEndStepWrite,
  validateFlowBlocks,
} from '../../common/validate-end-step'

vi.mock('@/models/step', () => ({
  default: {},
}))

const FLOW_ID = 'flow-invariant'
const MAX_STEPS = 4
const MISSING_END_ID = 'missing'
const BRANCH_IDS = [null, 'branch-a', 'branch-b'] as const

type BranchId = (typeof BRANCH_IDS)[number]
type Kind = 'plain' | 'mrf' | 'ifThenV1' | 'ifThenV2'

type Choice = {
  kind: Kind
  endIndex: number
  branch: BranchId
}

type Fixture = {
  id: string
  appKey: string
  key: string
  position: number
  config: IStepConfig
}

function choicesFor(stepCount: number): Choice[] {
  const choices: Choice[] = []
  for (const branch of BRANCH_IDS) {
    choices.push({ kind: 'plain', endIndex: 0, branch })
    choices.push({ kind: 'mrf', endIndex: 0, branch })
    choices.push({ kind: 'ifThenV1', endIndex: 0, branch })
    for (let endIndex = 0; endIndex <= stepCount; endIndex += 1) {
      choices.push({ kind: 'ifThenV2', endIndex, branch })
    }
  }
  return choices
}

function branchConfig(branch: BranchId): IStepConfig {
  if (branch === null) {
    return {}
  }
  return { approval: { branch: 'reject', stepId: branch } }
}

function buildFlow(choices: Choice[]): Fixture[] {
  return choices.map((choice, index) => {
    const config = branchConfig(choice.branch)
    if (choice.kind === 'ifThenV2') {
      config[BLOCK_END_STEP_ID] =
        choice.endIndex === choices.length
          ? MISSING_END_ID
          : `s${choice.endIndex}`
    }
    const appKey =
      choice.kind === 'mrf'
        ? 'formsg'
        : choice.kind === 'plain'
          ? 'postman'
          : 'toolbox'
    const key =
      choice.kind === 'mrf'
        ? 'mrfSubmission'
        : choice.kind === 'plain'
          ? 'sendTransactionalEmail'
          : 'ifThen'
    return {
      id: `s${index}`,
      appKey,
      key,
      position: index + 1,
      config,
    }
  })
}

function isIfThen(step: Fixture): boolean {
  return step.appKey === 'toolbox' && step.key === 'ifThen'
}

function isIfThenV2(step: Fixture): boolean {
  return isIfThen(step) && Object.hasOwn(step.config, BLOCK_END_STEP_ID)
}

function isMrf(step: Fixture): boolean {
  return step.appKey === 'formsg' && step.key === 'mrfSubmission'
}

function branchId(step: Fixture): string | null {
  return step.config.approval?.stepId ?? null
}

function rangesOverlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number,
): boolean {
  return startA <= endB && startB <= endA
}

function writeAllowed(
  flow: Fixture[],
  ifThenStepId: string,
  endStepId: string,
): boolean {
  const ifThenStep = flow.find((step) => step.id === ifThenStepId)
  if (!ifThenStep || !isIfThen(ifThenStep)) {
    return false
  }
  const endStep = flow.find((step) => step.id === endStepId)
  if (!endStep || endStep.position < ifThenStep.position) {
    return false
  }

  const ifThenBranch = branchId(ifThenStep)
  for (const step of flow) {
    if (
      step.position <= ifThenStep.position ||
      step.position > endStep.position
    ) {
      continue
    }
    if (isMrf(step) || branchId(step) !== ifThenBranch) {
      return false
    }
  }

  for (const other of flow) {
    if (other.id === ifThenStep.id || !isIfThenV2(other)) {
      continue
    }
    const otherEnd = flow.find(
      (step) => step.id === other.config[BLOCK_END_STEP_ID],
    )
    if (!otherEnd) {
      continue
    }
    if (
      rangesOverlap(
        ifThenStep.position,
        endStep.position,
        other.position,
        otherEnd.position,
      )
    ) {
      return false
    }
  }

  return true
}

function publishAllowed(flow: Fixture[]): boolean {
  for (const step of flow) {
    if (!isIfThenV2(step)) {
      continue
    }
    const endStepId = String(step.config[BLOCK_END_STEP_ID] ?? '')
    if (endStepId === step.id || !writeAllowed(flow, step.id, endStepId)) {
      return false
    }
  }
  return true
}

function describeFlow(flow: Fixture[]): string {
  return flow
    .map((step) => {
      const end = isIfThenV2(step)
        ? ` end=${step.config[BLOCK_END_STEP_ID]}`
        : ''
      const branch = branchId(step) ? ` branch=${branchId(step)}` : ''
      return `${step.id}:${step.key}@${step.position}${end}${branch}`
    })
    .join(', ')
}

function decisionMatches(
  run: () => void,
  allowed: boolean,
  detail: string,
): void {
  let rejected = false
  try {
    run()
  } catch {
    rejected = true
  }
  if (rejected === allowed) {
    throw new Error(
      allowed
        ? `Rejected a block the toolbox rules allow. ${detail}`
        : `Accepted a block the toolbox rules forbid. ${detail}`,
    )
  }
}

function checkPipes(maxSteps: number): { writes: number; publishes: number } {
  let writes = 0
  let publishes = 0
  for (let stepCount = 1; stepCount <= maxSteps; stepCount += 1) {
    const alphabet = choicesFor(stepCount)
    const radix = alphabet.length
    const digits = Array.from({ length: stepCount }, () => 0)
    const total = radix ** stepCount
    for (let index = 0; index < total; index += 1) {
      const flow = buildFlow(digits.map((digit) => alphabet[digit]))
      publishes += 1
      decisionMatches(
        () => validateFlowBlocks(flow, FLOW_ID),
        publishAllowed(flow),
        `publish [${describeFlow(flow)}]`,
      )
      for (const step of flow) {
        if (!isIfThenV2(step)) {
          continue
        }
        const endStepId = String(step.config[BLOCK_END_STEP_ID])
        writes += 1
        decisionMatches(
          () =>
            validateEndStepWrite({
              flowSteps: flow,
              ifThenStepId: step.id,
              endStepId,
              flowId: FLOW_ID,
            }),
          writeAllowed(flow, step.id, endStepId),
          `write ${step.id} end=${endStepId} [${describeFlow(flow)}]`,
        )
      }
      for (let place = stepCount - 1; place >= 0; place -= 1) {
        digits[place] += 1
        if (digits[place] < radix) {
          break
        }
        digits[place] = 0
      }
    }
  }
  return { writes, publishes }
}

describe('toolbox if-then block rules', () => {
  beforeAll(() => {
    vi.spyOn(logger, 'error').mockImplementation(() => undefined)
    vi.spyOn(logger, 'warn').mockImplementation(() => undefined)
  })

  it('accepts only pipes that respect the if-then block rules, up to 4 steps', () => {
    const { writes, publishes } = checkPipes(MAX_STEPS)
    expect(writes).toBeGreaterThan(0)
    expect(publishes).toBeGreaterThan(0)
  }, 120_000)
})
