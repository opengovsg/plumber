// @vitest-environment jsdom
import type { IApp, ITemplateStep } from '@plumber/types'
import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'

import ThemeProvider from '@/components/ThemeProvider'

import TemplateBody from '../TemplateBody'

const apps = [
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

describe('TemplatePreviewList', () => {
  it('renders CONTINUE IF as a header without a body', () => {
    const container = render([
      { position: 1, appKey: 'postman', eventKey: 'sendTransactionalEmail' },
      { position: 2, appKey: 'toolbox', eventKey: 'onlyContinueIf' },
      {
        position: 3,
        appKey: 'postman',
        eventKey: 'sendTransactionalEmail',
        config: { stepName: 'After' },
      },
    ])
    const block = container.querySelector('[aria-label="Continue if block 2"]')
    expect(block?.textContent).toContain('CONTINUE IF')
    expect(block?.children).toHaveLength(1)
    expect(block?.textContent).not.toContain('After')
  })

  it('shows the sample link below the step name', () => {
    const container = render([
      {
        position: 1,
        appKey: 'postman',
        eventKey: 'sendTransactionalEmail',
        sampleUrl: 'https://form.gov.sg/abc',
        sampleUrlDescription: 'View sample form',
        config: { stepName: 'Collect form' },
      },
    ])
    const link = container.querySelector('a[href="https://form.gov.sg/abc"]')
    expect(link?.textContent).toBe('View sample form')
    expect(link?.previousElementSibling?.textContent).toContain(
      '1. Collect form',
    )
  })
})
