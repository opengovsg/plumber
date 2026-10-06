// @vitest-environment jsdom
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import Step from '../Step'

const mocks = vi.hoisted(() => ({
  approvalBranches: {} as Record<string, 'approve' | 'reject'>,
  setApprovalBranch: vi.fn(),
}))

vi.mock('@/pages/AiBuilder/AiBuilderContext', () => ({
  useAiBuilderContext: () => ({
    allApps: [],
    steps: [],
    approvalBranches: mocks.approvalBranches,
    setApprovalBranch: mocks.setApprovalBranch,
  }),
}))
vi.mock('@/components/FlowStep/components/StepAppIcon', () => ({
  default: () => null,
}))
vi.mock('@/components/FlowStep/components/StepNameAndDemo', () => ({
  default: () => null,
}))
vi.mock('../StepParameterRows', () => ({ default: () => null }))

const step = {
  id: 'approval-step',
  appKey: 'formsg',
  key: 'mrfSubmission',
  type: 'action',
  position: 2,
  parameters: { mrf: { approvalField: 'field-1' } },
} as never

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

function render(): void {
  act(() => {
    root.render(<Step step={step} isLastStep />)
  })
}

function tab(label: string): HTMLElement {
  const found = Array.from(container.querySelectorAll('[role="tab"]')).find(
    (element) => element.textContent === label,
  )
  if (!found) {
    throw new Error(`No tab labelled ${label}`)
  }
  return found as HTMLElement
}

describe('Step approval tabs', () => {
  beforeEach(() => {
    ;(
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true
    mocks.approvalBranches = {}
    mocks.setApprovalBranch.mockClear()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('shows no tabs for a step that is not an approval step', () => {
    render()

    expect(container.querySelector('[role="tab"]')).toBeNull()
  })

  it('shows the approve and reject tabs for an approval step', () => {
    mocks.approvalBranches = { 'approval-step': 'approve' }
    render()

    expect(tab('If approved').getAttribute('aria-selected')).toBe('true')
    expect(tab('If rejected').getAttribute('aria-selected')).toBe('false')
  })

  it('selects the reject path when the user clicks "If rejected"', () => {
    mocks.approvalBranches = { 'approval-step': 'approve' }
    render()

    act(() => tab('If rejected').click())

    expect(mocks.setApprovalBranch).toHaveBeenCalledWith(
      'approval-step',
      'reject',
    )
  })
})
