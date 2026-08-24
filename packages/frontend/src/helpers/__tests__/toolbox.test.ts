import { IStep } from '@plumber/types'
import { describe, expect, it } from 'vitest'

import {
  extractBranchesWithSteps,
  isOnlyContinueIfStep,
} from '@/helpers/toolbox'

function makeStep(overrides: Partial<IStep> = {}): IStep {
  return {
    id: 'step-1',
    type: 'action',
    position: 2,
    appKey: 'toolbox',
    key: 'onlyContinueIf',
    parameters: {},
    config: {},
    ...overrides,
  } as IStep
}

function makeIfThenV1Step(overrides: Partial<IStep> = {}): IStep {
  return makeStep({
    key: 'ifThen',
    parameters: { depth: '0', branchName: 'Branch 1' },
    ...overrides,
  })
}

function makeIfThenV2Step(id: string, endStepId: string = id): IStep {
  return makeStep({
    id,
    key: 'ifThen',
    parameters: { branchName: 'data == 1', conditions: [] },
    config: { endStepId },
  })
}

describe('isOnlyContinueIfStep', () => {
  it('is true for a toolbox "Only continue if" step', () => {
    expect(isOnlyContinueIfStep(makeStep())).toBe(true)
  })

  it('is false for an if-then step', () => {
    expect(isOnlyContinueIfStep(makeStep({ key: 'ifThen' }))).toBe(false)
  })

  it('is false for a for-each step', () => {
    expect(isOnlyContinueIfStep(makeStep({ key: 'forEach' }))).toBe(false)
  })

  it('is false for a non-toolbox step with the same key', () => {
    expect(isOnlyContinueIfStep(makeStep({ appKey: 'formsg' }))).toBe(false)
  })
})

describe('extractBranchesWithSteps', () => {
  it('splits off a same-depth if-then V1 branch', () => {
    const forEachStep = makeStep({ id: 'for-each', key: 'forEach' })
    const plainStep = makeStep({ id: 'plain', position: 3 })
    const ifThenStep = makeIfThenV1Step({ id: 'if-then-v1', position: 4 })
    const childStep = makeStep({ id: 'child', position: 5 })

    expect(
      extractBranchesWithSteps(
        [forEachStep, plainStep, ifThenStep, childStep],
        0,
      ),
    ).toEqual([
      [forEachStep, plainStep],
      [ifThenStep, childStep],
    ])
  })

  // A V2 if-then never sets parameters.depth (config.endStepId carries its
  // extent instead), so it always parses to NaN depth — the same shape as a
  // just-chosen, not-yet-configured if-then, which this function folds into
  // the current branch rather than splitting. Without checking the marker, a
  // V2 if-then nested in a for-each body never gets split off, so it renders
  // as a plain step instead of its block UI.
  it('splits off an if-then V2 step despite its unset parameters.depth', () => {
    const forEachStep = makeStep({ id: 'for-each', key: 'forEach' })
    const plainStep = makeStep({ id: 'plain', position: 3 })
    const ifThenStep = makeIfThenV2Step('if-then-v2')

    expect(
      extractBranchesWithSteps([forEachStep, plainStep, ifThenStep], 0),
    ).toEqual([[forEachStep, plainStep], [ifThenStep]])
  })

  it('splits off each if-then V2 step in a sequence of blocks', () => {
    const forEachStep = makeStep({ id: 'for-each', key: 'forEach' })
    const firstIfThen = makeIfThenV2Step('if-then-1')
    const secondIfThen = makeIfThenV2Step('if-then-2')

    expect(
      extractBranchesWithSteps([forEachStep, firstIfThen, secondIfThen], 0),
    ).toEqual([[forEachStep], [firstIfThen], [secondIfThen]])
  })

  it('still folds a just-chosen, unconfigured if-then into the current branch', () => {
    const forEachStep = makeStep({ id: 'for-each', key: 'forEach' })
    const freshIfThenStep = makeStep({
      id: 'fresh-if-then',
      key: 'ifThen',
      parameters: {},
      config: {},
    })

    expect(extractBranchesWithSteps([forEachStep, freshIfThenStep], 0)).toEqual(
      [[forEachStep, freshIfThenStep]],
    )
  })
})
