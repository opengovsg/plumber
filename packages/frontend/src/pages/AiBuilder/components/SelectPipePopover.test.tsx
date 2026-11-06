// @vitest-environment jsdom
import { MockedProvider, type MockedResponse } from '@apollo/client/testing'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import ThemeProvider from '@/components/ThemeProvider'
import { UPDATE_FLOW_STATUS } from '@/graphql/mutations/update-flow-status'
import { GET_FLOWS } from '@/graphql/queries/get-flows'

import type { PipeChoice } from '../pipe-chip'
import SelectPipePopover from './SelectPipePopover'

const DRAFT_ID = '123e4567-e89b-12d3-a456-426614174000'
const LIVE_ID = '223e4567-e89b-12d3-a456-426614174001'
const UPDATED_AT = '1700000000000'

const LIST_VARIABLES = { limit: 100, offset: 0 }

function flowNode(id: string, name: string, active: boolean) {
  return {
    id,
    name,
    active,
    role: 'editor',
    updatedAt: UPDATED_AT,
    createdAt: UPDATED_AT,
    steps: [],
    collaborators: [],
    pendingTransfer: null,
  }
}

const listMock: MockedResponse = {
  request: { query: GET_FLOWS, variables: LIST_VARIABLES },
  result: {
    data: {
      getFlows: {
        pageInfo: { currentPage: 1, totalCount: 2 },
        edges: [
          { node: flowNode(DRAFT_ID, 'Draft pipe', false) },
          { node: flowNode(LIVE_ID, 'Live pipe', true) },
        ],
      },
    },
  },
  maxUsageCount: 2,
}

const unpublishMock: MockedResponse = {
  request: {
    query: UPDATE_FLOW_STATUS,
    variables: {
      input: { id: LIVE_ID, active: false, updatedAt: UPDATED_AT },
    },
  },
  result: {
    data: {
      updateFlowStatus: {
        id: LIVE_ID,
        active: false,
        updatedAt: UPDATED_AT,
      },
    },
  },
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

async function waitFor(predicate: () => boolean, attempts = 80): Promise<void> {
  for (let i = 0; i < attempts && !predicate(); i++) {
    await flushMacrotask()
  }
  expect(predicate()).toBe(true)
}

async function renderPopover(): Promise<void> {
  await act(async () => {
    root.render(
      <MockedProvider mocks={[listMock, unpublishMock]} addTypename={false}>
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
  const match = [...document.body.querySelectorAll('button')].find((el) => {
    const text = el.textContent?.trim() ?? ''
    return text === name || text.startsWith(name)
  })
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

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect.mock.calls[0]?.[0].pipeId).toBe(DRAFT_ID)
    expect(onSelect.mock.calls[0]?.[0].published).toBe(false)
    expect(document.body.textContent).not.toContain('Unpublish Draft pipe?')
  })

  it('unpublishes a live pipe, then selects it', async () => {
    await renderPopover()
    await openPopover()

    await act(async () => {
      buttonNamed('Live pipe').click()
    })

    expect(onSelect).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('Unpublish Live pipe?')
    expect(document.body.textContent).toContain(
      'It stops running until you publish it again.',
    )

    await act(async () => {
      buttonNamed('Unpublish').click()
    })
    await waitFor(() => onSelect.mock.calls.length === 1)

    expect(onSelect.mock.calls[0]?.[0].pipeId).toBe(LIVE_ID)
    expect(onSelect.mock.calls[0]?.[0].published).toBe(true)
  })
})
