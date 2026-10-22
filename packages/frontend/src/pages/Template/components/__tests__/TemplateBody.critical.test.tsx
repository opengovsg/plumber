// @vitest-environment jsdom
// Business rule: update it so that the modal preview respects topology.
import type { IApp, ITemplateStep } from '@plumber/types'

import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'

import ThemeProvider from '@/components/ThemeProvider'

import TemplateBody from '../TemplateBody'

const apps: IApp[] = [
  {
    name: 'Toolbox',
    key: 'toolbox',
    actions: [],
    apiBaseUrl: '',
    primaryColor: '000000',
  },
  {
    name: 'Postman',
    key: 'postman',
    actions: [{ key: 'sendTransactionalEmail', name: 'Send email' }],
    apiBaseUrl: '',
    primaryColor: '000000',
  },
] as IApp[]

let root: Root

function render(steps: ITemplateStep[]): HTMLElement {
  const container = document.createElement('div')
  root = createRoot(container)
  flushSync(() => {
    root.render(
      <ThemeProvider>
        <TemplateBody templateSteps={steps} apps={apps} />
      </ThemeProvider>,
    )
  })
  return container
}

afterEach(() => {
  root?.unmount()
})

describe('template modal preview', () => {
  it('renders only block members inside the If container', () => {
    const container = render([
      { position: 1, appKey: 'postman', eventKey: 'sendTransactionalEmail' },
      {
        position: 2,
        appKey: 'toolbox',
        eventKey: 'ifThen',
        parameters: { branchName: 'High amount' },
        config: { endStepId: '<<step_id_3>>' },
      },
      {
        position: 3,
        appKey: 'postman',
        eventKey: 'sendTransactionalEmail',
        config: { stepName: 'Inside' },
      },
      {
        position: 4,
        appKey: 'postman',
        eventKey: 'sendTransactionalEmail',
        config: { stepName: 'Outside' },
      },
    ])
    const block = container.querySelector('[aria-label="If block 2"]')
    expect(block?.textContent).toContain('High amount')
    expect(block?.textContent).toContain('Inside')
    expect(block?.textContent).not.toContain('Outside')
    expect(container.textContent).toContain('Outside')
  })

  it('renders an If container inside Repeat', () => {
    const container = render([
      { position: 1, appKey: 'postman', eventKey: 'sendTransactionalEmail' },
      { position: 2, appKey: 'toolbox', eventKey: 'forEach' },
      {
        position: 3,
        appKey: 'toolbox',
        eventKey: 'ifThen',
        config: { endStepId: '<<step_id_4>>' },
      },
      { position: 4, appKey: 'toolbox', eventKey: 'onlyContinueIf' },
      {
        position: 5,
        appKey: 'postman',
        eventKey: 'sendTransactionalEmail',
        config: { stepName: 'After condition' },
      },
    ])
    const repeat = container.querySelector('[aria-label="Repeat block 2"]')
    const conditional = repeat?.querySelector('[aria-label="If block 3"]')
    expect(conditional?.getAttribute('aria-label')).toBe('If block 3')
    expect(conditional?.textContent).not.toContain('After condition')
    expect(repeat?.textContent).toContain('After condition')
  })

  it('labels rejection steps separately from the normal sequence', () => {
    const container = render([
      { position: 1, appKey: 'formsg', eventKey: 'newSubmission' },
      { position: 2, appKey: 'formsg', eventKey: 'mrfSubmission' },
      {
        position: 3,
        appKey: 'postman',
        eventKey: 'sendTransactionalEmail',
        config: {
          stepName: 'Notify rejection',
          approval: { branch: 'reject', stepId: '<<step_id_2>>' },
        },
      },
      {
        position: 4,
        appKey: 'postman',
        eventKey: 'sendTransactionalEmail',
        config: { stepName: 'Normal continuation' },
      },
    ])
    const rejection = container.querySelector(
      '[aria-label="Rejection branch 2"]',
    )
    expect(rejection?.textContent).toContain('If rejected')
    expect(rejection?.textContent).toContain('Notify rejection')
    expect(rejection?.textContent).not.toContain('Normal continuation')
    expect(container.textContent).toContain('Normal continuation')
  })

  it('shows an empty block without swallowing the next step', () => {
    const container = render([
      {
        position: 1,
        appKey: 'toolbox',
        eventKey: 'ifThen',
        config: { endStepId: '<<step_id_1>>' },
      },
      {
        position: 2,
        appKey: 'postman',
        eventKey: 'sendTransactionalEmail',
        config: { stepName: 'Next' },
      },
    ])
    const block = container.querySelector('[aria-label="If block 1"]')
    expect(block?.textContent).toContain('No steps in this block')
    expect(block?.textContent).not.toContain('Next')
    expect(container.textContent).toContain('Next')
  })
})
