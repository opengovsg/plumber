// @vitest-environment jsdom
import type { IStep } from '@plumber/types'

import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { buildPreviewItems, type PreviewStep } from '../helpers/previewItems'
import PreviewItems from '../PreviewItems'

const mocks = vi.hoisted(() => ({
  output: {} as Record<string, unknown>,
  completedStepIds: new Set<string>(),
  stepParametersByStepId: {} as Record<string, Record<string, unknown>>,
}))

vi.mock('@/pages/AiBuilder/AiBuilderContext', () => ({
  useAiBuilderContext: () => ({
    output: mocks.output,
    isMobile: false,
    allApps: [],
    steps: [],
    variableLabelsByPath: new Map(),
  }),
}))
vi.mock('@/pages/AiBuilder/StepConfigContext', () => ({
  useStepConfigContext: () => ({
    stepParametersByStepId: mocks.stepParametersByStepId,
    completedStepIds: mocks.completedStepIds,
  }),
}))
vi.mock('../StepParameterRows', () => ({
  default: ({ stepId }: { stepId: string }) => (
    <div data-testid="block-params" data-step={stepId} />
  ),
}))
vi.mock('../Step', () => ({
  default: ({ step }: { step: IStep }) => (
    <div data-testid="step" data-step={step.id} />
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

function attrs(selector: string, attribute: string): string[] {
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
    mocks.stepParametersByStepId = {}
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('draws If and Repeat as headers, and only the inner steps as cards', () => {
    render([
      step('loop', 'toolbox', 'forEach'),
      { ...step('if', 'toolbox', 'ifThen'), endStepId: 'b' },
      step('b', 'slack', 'sendMessageToChannel'),
      step('c', 'postman', 'sendTransactionalEmail'),
    ])

    expect(attrs('[data-testid="block"]', 'data-badge')).toEqual([
      'REPEAT',
      'IF',
    ])
    expect(attrs('[data-testid="step"]', 'data-step')).toEqual(['b', 'c'])
  })

  it("toggles a tested block's parameters from its header", () => {
    mocks.output = { pipeId: 'pipe-1' }
    mocks.completedStepIds = new Set(['if'])
    mocks.stepParametersByStepId = { if: { branchName: 'Department is HR' } }

    render(
      [
        { ...step('if', 'toolbox', 'ifThen'), endStepId: 'b' },
        step('b', 'slack', 'sendMessageToChannel'),
      ],
      'b',
    )

    expect(
      container.querySelectorAll('[data-testid="block-chevron"]'),
    ).toHaveLength(1)
    expect(container.querySelector('[data-testid="block-params"]')).toBeNull()

    const header = container.querySelector<HTMLElement>(
      '[data-testid="block-header"]',
    )
    act(() => header?.click())
    expect(attrs('[data-testid="block-params"]', 'data-step')).toEqual(['if'])

    act(() => header?.click())
    expect(container.querySelector('[data-testid="block-params"]')).toBeNull()
  })

  it("keeps the active block's parameters open", () => {
    mocks.output = { pipeId: 'pipe-1' }
    mocks.stepParametersByStepId = { loop: { items: '{{step.x.rows}}' } }

    render(
      [step('loop', 'toolbox', 'forEach'), step('b', 'slack', 'sendMessage')],
      'loop',
    )

    expect(attrs('[data-testid="block-params"]', 'data-step')).toEqual(['loop'])
    expect(container.querySelector('[data-testid="block-chevron"]')).toBeNull()
  })
})
