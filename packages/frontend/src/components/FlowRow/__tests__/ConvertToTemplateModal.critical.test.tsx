// @vitest-environment jsdom
// Business rule: the title should be the title of the pipe and the description should be auto-genearted via a vercel ai gateway call based off the steps content.
import type { IFlow } from '@plumber/types'

import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createTemplate: vi.fn(),
  fetch: vi.fn(),
  close: vi.fn(),
}))
vi.mock('@apollo/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@apollo/client')>()),
  useMutation: () => [mocks.createTemplate, { loading: false }],
}))
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => vi.fn(),
}))

import ThemeProvider from '@/components/ThemeProvider'

import ConvertToTemplateModal from '../ConvertToTemplateModal'
import FlowContextMenu from '../FlowContextMenu'

const flow = { id: 'flow-id', name: 'Original pipe title' }
let root: Root
let container: HTMLDivElement
const tick = () => new Promise((resolve) => setTimeout(resolve, 5))

async function mount(menu = false) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  flushSync(() =>
    root.render(
      <ThemeProvider>
        {menu ? (
          <FlowContextMenu flow={flow as IFlow} />
        ) : (
          <ConvertToTemplateModal flow={flow} onClose={mocks.close} />
        )}
      </ThemeProvider>,
    ),
  )
  await tick()
}

function edit(id: string, value: string) {
  const input = document.getElementById(id) as
    | HTMLInputElement
    | HTMLTextAreaElement
  const prototype =
    input.tagName === 'INPUT'
      ? HTMLInputElement.prototype
      : HTMLTextAreaElement.prototype
  Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

function save() {
  document
    .querySelector('form')!
    .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
}

describe('convert to template modal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', mocks.fetch)
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ description: 'Generated workflow description' }),
    })
    mocks.createTemplate.mockResolvedValue({
      data: { createTemplateFromFlow: { id: 'template-id' } },
    })
  })
  afterEach(() => {
    root?.unmount()
    container?.remove()
    vi.unstubAllGlobals()
  })

  it('prefills the pipe title and loads an editable generated description', async () => {
    await mount()
    expect(
      (document.getElementById('template-title') as HTMLInputElement).value,
    ).toBe(flow.name)
    expect(
      (document.getElementById('template-description') as HTMLTextAreaElement)
        .value,
    ).toBe('Generated workflow description')
    expect(mocks.fetch).toHaveBeenCalledWith(
      '/api/template-description',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ flowId: flow.id }),
      }),
    )
    expect(mocks.createTemplate).not.toHaveBeenCalled()
  })

  it('saves the edited title and description only when submitted', async () => {
    await mount()
    edit('template-title', 'Edited title')
    edit('template-description', 'Edited description')
    await tick()
    save()
    await tick()
    expect(mocks.createTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: {
          input: {
            flowId: flow.id,
            name: 'Edited title',
            description: 'Edited description',
          },
        },
      }),
    )
    expect(mocks.close).toHaveBeenCalledOnce()
  })

  it('does not overwrite manual edits when generation finishes later', async () => {
    let resolve: (value: unknown) => void
    mocks.fetch.mockReturnValue(
      new Promise((done) => {
        resolve = done
      }),
    )
    await mount()
    edit('template-description', 'Manual draft')
    await tick()
    resolve!({ ok: true, json: async () => ({ description: 'Late AI draft' }) })
    await tick()
    expect(
      (document.getElementById('template-description') as HTMLTextAreaElement)
        .value,
    ).toBe('Manual draft')
  })

  it('allows a manual description after generation fails', async () => {
    mocks.fetch.mockResolvedValue({ ok: false })
    await mount()
    expect(document.body.textContent).toContain('You can enter one manually')
    edit('template-description', 'Manual fallback')
    await tick()
    save()
    await tick()
    expect(mocks.createTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: {
          input: {
            flowId: flow.id,
            name: flow.name,
            description: 'Manual fallback',
          },
        },
      }),
    )
  })

  it('rejects a whitespace-only title', async () => {
    await mount()
    edit('template-title', '   ')
    await tick()
    save()
    await tick()
    expect(mocks.createTemplate).not.toHaveBeenCalled()
  })

  it('aborts pending generation when the modal unmounts', async () => {
    mocks.fetch.mockReturnValue(new Promise(() => {}))
    await mount()
    const signal = mocks.fetch.mock.calls[0][1].signal as AbortSignal
    root.unmount()
    expect(signal.aborted).toBe(true)
    expect(mocks.createTemplate).not.toHaveBeenCalled()
  })

  it('opens the modal from the menu instead of immediately creating a template', async () => {
    await mount(true)
    const menuButton = document.querySelector(
      '[aria-label="Flow Row Menu Options"]',
    ) as HTMLButtonElement
    menuButton.click()
    await tick()
    const option = Array.from(
      document.querySelectorAll('[role="menuitem"]'),
    ).find((item) => item.textContent === 'Convert to template')
    const convertOption = option as HTMLElement
    convertOption.click()
    await tick()
    expect(document.getElementById('template-title')).not.toBeNull()
    expect(mocks.createTemplate).not.toHaveBeenCalled()
  })
})
