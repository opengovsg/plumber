/**
 * Toolbox placement rules, applied together.
 *
 * On the if-then V2 model, a pipe decides every toolbox action from the same
 * layout:
 *
 * 1. An If block can be added anywhere except inside another If block.
 * 2. Repeat for each can be added only as the last step, only once, and not
 *    inside an If block.
 * 3. Delay cannot be added inside a Repeat body. Adding it on the Repeat step
 *    itself counts as inside that body.
 * 4. A launcher may say the new step lands inside an If block, or after the
 *    whole block, when the anchor step alone would say otherwise.
 *
 * Inside an If block means strictly after that if-then and up to its end
 * marker. An earlier If block consumes that range, so a Repeat inside it does
 * not start its own body. A Repeat that is not inside an earlier block owns
 * every later step.
 *
 * These are the answers from getIfThenV2Selectability. A failing case means
 * those answers drifted. Confirm with the user before loosening an assertion.
 */
import type { IStep } from '@plumber/types'
import { describe, expect, it } from 'vitest'

import { TOOLBOX_ACTIONS } from '@/helpers/toolbox'

import {
  FOR_EACH_INSIDE_BLOCK_REASON,
  getIfThenV2Selectability,
  IF_THEN_INSIDE_BLOCK_REASON,
  LAST_STEP_ONLY_REASON,
} from '../useIsAppSelectable'

const GROUPING_ACTIONS = new Set(['toolbox-ifThen', 'toolbox-forEach'])
const MAX_STEPS = 4
const PLACEMENTS = [
  undefined,
  'inside-if-then-block',
  'after-if-then-block',
] as const

type Kind = 'plain' | 'delay' | 'forEach' | 'onlyContinueIf' | 'ifThen'

type Choice = {
  kind: Kind
  endOffset: number
}

type Fixture = {
  id: string
  kind: Kind
  endIndex: number
}

function choicesAt(index: number, stepCount: number): Choice[] {
  const choices: Choice[] = [
    { kind: 'plain', endOffset: 0 },
    { kind: 'delay', endOffset: 0 },
    { kind: 'forEach', endOffset: 0 },
    { kind: 'onlyContinueIf', endOffset: 0 },
  ]
  for (let endOffset = 0; endOffset < stepCount - index; endOffset += 1) {
    choices.push({ kind: 'ifThen', endOffset })
  }
  return choices
}

function buildFlow(choices: Choice[]): Fixture[] {
  return choices.map((choice, index) => ({
    id: `s${index}`,
    kind: choice.kind,
    endIndex: index + choice.endOffset,
  }))
}

function toStep(fixture: Fixture): IStep {
  if (fixture.kind === 'ifThen') {
    return {
      id: fixture.id,
      appKey: 'toolbox',
      key: 'ifThen',
      config: { endStepId: `s${fixture.endIndex}` },
    } as IStep
  }
  if (fixture.kind === 'forEach' || fixture.kind === 'onlyContinueIf') {
    return {
      id: fixture.id,
      appKey: 'toolbox',
      key: fixture.kind,
    } as IStep
  }
  if (fixture.kind === 'delay') {
    return { id: fixture.id, appKey: 'delay', key: 'delay' } as IStep
  }
  return {
    id: fixture.id,
    appKey: 'postman',
    key: 'sendTransactionalEmail',
  } as IStep
}

function isIfThen(step: Fixture): boolean {
  return step.kind === 'ifThen'
}

function isForEach(step: Fixture): boolean {
  return step.kind === 'forEach'
}

function insideIfThen(steps: Fixture[], anchorIndex: number): boolean {
  const walk = (from: number, to: number): boolean => {
    let index = from
    while (index < to) {
      const step = steps[index]
      if (isIfThen(step)) {
        if (anchorIndex > index && anchorIndex <= step.endIndex) {
          return true
        }
        index = step.endIndex + 1
        continue
      }
      if (isForEach(step)) {
        return walk(index + 1, to)
      }
      index += 1
    }
    return false
  }
  return walk(0, steps.length)
}

function insideForEachBody(
  steps: Fixture[],
  anchor: Fixture | undefined,
): boolean {
  if (!anchor) {
    return false
  }
  if (isForEach(anchor)) {
    return true
  }
  const anchorIndex = steps.findIndex((step) => step.id === anchor.id)
  let index = 0
  while (index < steps.length) {
    const step = steps[index]
    if (isIfThen(step)) {
      index = step.endIndex + 1
      continue
    }
    if (isForEach(step)) {
      return anchorIndex > index
    }
    index += 1
  }
  return false
}

function expectedAnswers(
  steps: Fixture[],
  anchor: Fixture | undefined,
  isLastStep: boolean,
  placement: (typeof PLACEMENTS)[number],
) {
  const anchorIndex = anchor
    ? steps.findIndex((step) => step.id === anchor.id)
    : -1
  const insideBlock = placement
    ? placement === 'inside-if-then-block'
    : anchor
      ? insideIfThen(steps, anchorIndex)
      : false
  const hasForEach = steps.some(isForEach)

  return {
    [TOOLBOX_ACTIONS.IfThen]: {
      isSelectable: !insideBlock,
      disabledReason: IF_THEN_INSIDE_BLOCK_REASON,
    },
    [TOOLBOX_ACTIONS.ForEach]: {
      isSelectable: isLastStep && !hasForEach && !insideBlock,
      disabledReason: insideBlock
        ? FOR_EACH_INSIDE_BLOCK_REASON
        : LAST_STEP_ONLY_REASON,
    },
    delay: {
      isSelectable: !insideForEachBody(steps, anchor),
      disabledReason: LAST_STEP_ONLY_REASON,
    },
  }
}

function describeCase(
  steps: Fixture[],
  anchor: Fixture | undefined,
  isLastStep: boolean,
  placement: (typeof PLACEMENTS)[number],
): string {
  const layout = steps
    .map((step) =>
      isIfThen(step)
        ? `${step.id}:ifThen->s${step.endIndex}`
        : `${step.id}:${step.kind}`,
    )
    .join(', ')
  return `steps [${layout}] anchor ${anchor?.id ?? 'none'} last ${isLastStep} placement ${placement ?? 'from the anchor'}`
}

function checkLayouts(maxSteps: number): number {
  let checked = 0
  for (let stepCount = 1; stepCount <= maxSteps; stepCount += 1) {
    const alphabets = Array.from({ length: stepCount }, (_, index) =>
      choicesAt(index, stepCount),
    )
    const digits = Array.from({ length: stepCount }, () => 0)
    const total = alphabets.reduce(
      (product, alphabet) => product * alphabet.length,
      1,
    )

    for (let index = 0; index < total; index += 1) {
      const flow = buildFlow(
        digits.map((digit, place) => alphabets[place][digit]),
      )
      const actionSteps = flow.map(toStep)
      const anchors: Array<Fixture | undefined> = [undefined, ...flow]

      for (const anchor of anchors) {
        for (const isLastStep of [true, false]) {
          for (const placement of PLACEMENTS) {
            const actual = getIfThenV2Selectability({
              isLastStep,
              anchorPlacement: placement,
              anchorStep: anchor ? toStep(anchor) : undefined,
              actionSteps,
              groupingActions: GROUPING_ACTIONS,
            })
            const expected = expectedAnswers(
              flow,
              anchor,
              isLastStep,
              placement,
            )
            if (
              actual[TOOLBOX_ACTIONS.IfThen].isSelectable !==
                expected[TOOLBOX_ACTIONS.IfThen].isSelectable ||
              actual[TOOLBOX_ACTIONS.IfThen].disabledReason !==
                expected[TOOLBOX_ACTIONS.IfThen].disabledReason ||
              actual[TOOLBOX_ACTIONS.ForEach].isSelectable !==
                expected[TOOLBOX_ACTIONS.ForEach].isSelectable ||
              actual[TOOLBOX_ACTIONS.ForEach].disabledReason !==
                expected[TOOLBOX_ACTIONS.ForEach].disabledReason ||
              actual.delay.isSelectable !== expected.delay.isSelectable ||
              actual.delay.disabledReason !== expected.delay.disabledReason
            ) {
              throw new Error(
                `Toolbox rules disagreed. ${describeCase(flow, anchor, isLastStep, placement)}. Got ${JSON.stringify(
                  {
                    ifThen: actual[TOOLBOX_ACTIONS.IfThen],
                    forEach: actual[TOOLBOX_ACTIONS.ForEach],
                    delay: actual.delay,
                  },
                )}. Expected ${JSON.stringify(expected)}.`,
              )
            }
            checked += 1
          }
        }
      }

      for (let place = stepCount - 1; place >= 0; place -= 1) {
        digits[place] += 1
        if (digits[place] < alphabets[place].length) {
          break
        }
        digits[place] = 0
      }
    }
  }
  return checked
}

describe('toolbox placement rules together', () => {
  it('applies If, Repeat, and Delay rules together on every pipe of up to 4 steps', () => {
    expect(checkLayouts(MAX_STEPS)).toBeGreaterThan(0)
  }, 120_000)
})
