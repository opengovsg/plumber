// @vitest-environment jsdom
import type { IStep } from '@plumber/types'

import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { buildPreviewItems, type PreviewStep } from './helpers/previewItems'
import PreviewItems from './PreviewItems'

const mocks = vi.hoisted(() => ({
  output: {} as Record<string, unknown>,
  completedStepIds: new Set<string>(),
}))

vi.mock('@/pages/AiBuilder/AiBuilderContext', () => ({
  useAiBuilderContext: () => ({ output: mocks.output, isMobile: false }),
}))
vi.mock('@/pages/AiBuilder/StepConfigContext', () => ({
  useStepConfigContext: () => ({
    stepParametersByStepId: {},
    completedStepIds: mocks.completedStepIds,
  }),
}))
// The real cards pull in Chakra, app icons and step-name lookups. Stand-ins
// keep this test about the structure PreviewItems produces.
vi.mock('./Step', () => ({
  default: ({
    step,
    isNested,
    isLastStep,
    isActive,
  }: {
    step: IStep
    isNested?: boolean
    isLastStep?: boolean
    isActive?: boolean
  }) => (
    <div
      data-testid="step"
      data-step={step.id}
      data-nested={String(Boolean(isNested))}
      data-last={String(Boolean(isLastStep))}
      data-active={String(Boolean(isActive))}
    />
  ),
}))

function step(id: string, appKey: string, key: string): PreviewStep {
  return {
    id,
    appKey,
    key,
    type: 'action',
    position: 0,
    parameters: {},
  } as PreviewStep
}

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

function render(
  actionSteps: PreviewStep[],
  effectiveActiveStepId: string | null = null,
): void {
  act(() => {
    root.render(
      <PreviewItems
        items={buildPreviewItems(actionSteps)}
        isNested={false}
        effectiveActiveStepId={effectiveActiveStepId}
      />,
    )
  })
}

function attrsOf(selector: string, attribute: string): string[] {
  return Array.from(container.querySelectorAll(selector)).map(
    (element) => element.getAttribute(attribute) ?? '',
  )
}

describe('PreviewItems', () => {
  beforeEach(() => {
    ;(
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true
    mocks.output = {}
    mocks.completedStepIds = new Set()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('renders an If block between plain steps, with a connector after it', () => {
    render([
      step('a', 'postman', 'sendTransactionalEmail'),
      { ...step('if', 'toolbox', 'ifThen'), endStepId: 'b' },
      step('b', 'slack', 'sendMessageToChannel'),
      step('c', 'postman-sms', 'sendSms'),
    ])

    expect(attrsOf('[data-testid="block"]', 'data-badge')).toEqual(['IF'])
    // The If step is the block header, not a card. Only its child is inside.
    expect(attrsOf('[data-testid="step"]', 'data-step')).toEqual([
      'a',
      'b',
      'c',
    ])
    expect(attrsOf('[data-testid="step"]', 'data-nested')).toEqual([
      'false',
      'true',
      'false',
    ])
    expect(attrsOf('[data-testid="step"]', 'data-last')).toEqual([
      'false',
      'true',
      'true',
    ])
    // The block is followed by another item, so a connector separates them.
    const slot = container.querySelector('[data-testid="block-slot"]')
    expect(slot?.nextElementSibling).not.toBeNull()
    expect(slot?.nextElementSibling?.getAttribute('data-testid')).toBeNull()
  })

  it('nests an If block inside the for-each body', () => {
    render([
      step('loop', 'toolbox', 'forEach'),
      { ...step('if', 'toolbox', 'ifThen'), endStepId: 'b' },
      step('b', 'slack', 'sendMessageToChannel'),
      step('c', 'postman', 'sendTransactionalEmail'),
    ])

    expect(attrsOf('[data-testid="block"]', 'data-badge')).toEqual([
      'REPEAT',
      'IF',
    ])
    // The Repeat step is the block header. The email inside the If, then the
    // email after it, are the only cards.
    expect(attrsOf('[data-testid="step"]', 'data-step')).toEqual(['b', 'c'])
    expect(attrsOf('[data-testid="step"]', 'data-nested')).toEqual([
      'true',
      'true',
    ])
  })

  it('mutes a block in pipe mode until one of its steps is active or configured', () => {
    mocks.output = { pipeId: 'pipe-1' }
    mocks.completedStepIds = new Set(['a'])

    render(
      [
        step('a', 'postman', 'sendTransactionalEmail'),
        { ...step('if', 'toolbox', 'ifThen'), endStepId: 'b' },
        step('b', 'slack', 'sendMessageToChannel'),
        { ...step('if2', 'toolbox', 'ifThen'), endStepId: 'c' },
        step('c', 'postman-sms', 'sendSms'),
      ],
      'b',
    )

    expect(attrsOf('[data-testid="block"]', 'data-pending')).toEqual([
      'false',
      'true',
    ])
    expect(attrsOf('[data-testid="block"]', 'data-completed')).toEqual([
      'false',
      'false',
    ])
  })

  it('draws the tested check on an If or Repeat block whose own step completed', () => {
    mocks.output = { pipeId: 'pipe-1' }
    mocks.completedStepIds = new Set(['loop', 'if'])

    render([
      step('loop', 'toolbox', 'forEach'),
      { ...step('if', 'toolbox', 'ifThen'), endStepId: 'b' },
      step('b', 'slack', 'sendMessageToChannel'),
      { ...step('if2', 'toolbox', 'ifThen'), endStepId: 'c' },
      step('c', 'postman-sms', 'sendSms'),
    ])

    expect(attrsOf('[data-testid="block"]', 'data-completed')).toEqual([
      'true',
      'true',
      'false',
    ])
    expect(
      container.querySelectorAll('[data-testid="block-tested"]'),
    ).toHaveLength(2)
  })
})
