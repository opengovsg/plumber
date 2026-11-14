// @vitest-environment jsdom
import { MockedProvider, type MockedResponse } from '@apollo/client/testing'
import { type PipeId, parsePipeId } from '@plumber/shared'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import ThemeProvider from '@/components/ThemeProvider'
import { UPDATE_FLOW_STATUS } from '@/graphql/mutations/update-flow-status'
import { GET_FLOWS } from '@/graphql/queries/get-flows'

import type { PipeChoice } from '../pipe-chip'
import SelectPipePopover from './SelectPipePopover'

function mustPipeId(value: string): PipeId {
  const pipeId = parsePipeId(value)
  if (!pipeId) {
    throw new Error('fixture is not a pipe id')
  }
  return pipeId
}

const DRAFT_ID = mustPipeId('123e4567-e89b-12d3-a456-426614174000')
const LIVE_ID = mustPipeId('223e4567-e89b-12d3-a456-426614174001')
const UPDATED_AT = '1700000000000'

function flowNode(id: string, name: string, active: boolean) {
  return { id, name, active, role: 'editor', updatedAt: UPDATED_AT }
}

function listMock(): MockedResponse {
  return {
    request: { query: GET_FLOWS, variables: { limit: 100, offset: 0 } },
    result: {
      data: {
        getFlows: {
          edges: [
            { node: flowNode(DRAFT_ID, 'Draft pipe', false) },
            { node: flowNode(LIVE_ID, 'Live pipe', true) },
          ],
        },
      },
    },
  }
}

function unpublishMock(): MockedResponse {
  return {
    request: {
      query: UPDATE_FLOW_STATUS,
      variables: {
        input: { id: LIVE_ID, active: false, updatedAt: UPDATED_AT },
      },
    },
    result: {
      data: {
        updateFlowStatus: { id: LIVE_ID, active: false, updatedAt: UPDATED_AT },
      },
    },
  }
}

const draftChoice: PipeChoice = {
  pipeId: DRAFT_ID,
  name: 'Draft pipe',
  published: false,
  updatedAt: UPDATED_AT,
}
const liveChoice: PipeChoice = {
  pipeId: LIVE_ID,
  name: 'Live pipe',
  published: true,
  updatedAt: UPDATED_AT,
}

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>
let onSelect: ReturnType<typeof vi.fn<(choice: PipeChoice) => void>>

function stubMatchMedia(): void {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

function flushMacrotask(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 2))
}

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let i = 0; i < 80 && !predicate(); i++) {
    await flushMacrotask()
  }
  expect(predicate()).toBe(true)
}

async function renderPopover(): Promise<void> {
  await act(async () => {
    root.render(
      <MockedProvider mocks={[listMock(), unpublishMock()]} addTypename={false}>
        <ThemeProvider>
          <SelectPipePopover isStreaming={false} onSelect={onSelect} />
        </ThemeProvider>
      </MockedProvider>,
    )
  })
}

async function openPopover(): Promise<void> {
  const trigger = [...document.body.querySelectorAll('button')].find((el) =>
    el.textContent?.includes('Select a pipe'),
  )
  await act(async () => {
    trigger?.click()
  })
  await waitFor(
    () => document.body.textContent?.includes('Draft pipe') ?? false,
  )
}

function buttonNamed(name: string): HTMLButtonElement {
  const match = [...document.body.querySelectorAll('button')].find((el) =>
    el.textContent?.trim().startsWith(name),
  )
  if (!(match instanceof HTMLButtonElement)) {
    throw new Error(`missing button ${name}`)
  }
  return match
}

describe('SelectPipePopover', () => {
  beforeEach(() => {
    stubMatchMedia()
    onSelect = vi.fn<(choice: PipeChoice) => void>()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    root.unmount()
    container.remove()
  })

  it('selects an unpublished pipe without asking', async () => {
    await renderPopover()
    await openPopover()

    await act(async () => {
      buttonNamed('Draft pipe').click()
    })

    expect(onSelect).toHaveBeenCalledWith(draftChoice)
    expect(document.body.textContent).not.toContain('Unpublish')
  })

  it('unpublishes a live pipe, then selects it', async () => {
    await renderPopover()
    await openPopover()

    await act(async () => {
      buttonNamed('Live pipe').click()
    })

    expect(onSelect).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain(
      'It stops running until you publish it again.',
    )

    await act(async () => {
      buttonNamed('Unpublish').click()
    })
    await waitFor(() => onSelect.mock.calls.length === 1)
    expect(onSelect).toHaveBeenCalledWith(liveChoice)
  })
})
