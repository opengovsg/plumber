import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@ai-sdk/mcp', () => ({
  experimental_createMCPClient: vi.fn(),
}))

import { experimental_createMCPClient } from '@ai-sdk/mcp'

import {
  connectGitbookMcp,
  GITBOOK_CONNECT_TIMEOUT_MS,
} from '../connect-gitbook-mcp'

type McpClient = Awaited<ReturnType<typeof experimental_createMCPClient>>

function makeClient(tools: () => Promise<unknown>) {
  return {
    tools: vi.fn(tools),
    close: vi.fn().mockResolvedValue(undefined),
  }
}

describe('connectGitbookMcp', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns the client and its tools', async () => {
    const client = makeClient(() =>
      Promise.resolve({ search_documentation: {} }),
    )
    vi.mocked(experimental_createMCPClient).mockResolvedValue(
      client as unknown as McpClient,
    )

    await expect(connectGitbookMcp()).resolves.toEqual({
      client,
      tools: { search_documentation: {} },
    })
    expect(client.close).not.toHaveBeenCalled()
  })

  it('times out when the client never connects, and closes it if it connects later', async () => {
    let connect: (client: McpClient) => void = () => undefined
    vi.mocked(experimental_createMCPClient).mockReturnValue(
      new Promise((resolve) => {
        connect = resolve
      }),
    )

    const result = connectGitbookMcp()
    const assertion = expect(result).rejects.toThrow(
      `Timed out after ${GITBOOK_CONNECT_TIMEOUT_MS}ms`,
    )
    await vi.advanceTimersByTimeAsync(GITBOOK_CONNECT_TIMEOUT_MS)
    await assertion

    const lateClient = makeClient(() => Promise.resolve({}))
    connect(lateClient as unknown as McpClient)
    await vi.runAllTimersAsync()

    expect(lateClient.close).toHaveBeenCalledTimes(1)
  })

  it('closes a client that connects after the timeout even if listing tools fails', async () => {
    let connect: (client: McpClient) => void = () => undefined
    vi.mocked(experimental_createMCPClient).mockReturnValue(
      new Promise((resolve) => {
        connect = resolve
      }),
    )

    const result = connectGitbookMcp()
    const assertion = expect(result).rejects.toThrow()
    await vi.advanceTimersByTimeAsync(GITBOOK_CONNECT_TIMEOUT_MS)
    await assertion

    const lateClient = makeClient(() => Promise.reject(new Error('HTTP 504')))
    connect(lateClient as unknown as McpClient)
    await vi.runAllTimersAsync()

    expect(lateClient.close).toHaveBeenCalledTimes(1)
  })

  it('times out and closes the client when listing tools hangs', async () => {
    const client = makeClient(() => new Promise(() => undefined))
    vi.mocked(experimental_createMCPClient).mockResolvedValue(
      client as unknown as McpClient,
    )

    const result = connectGitbookMcp()
    const assertion = expect(result).rejects.toThrow(
      `Timed out after ${GITBOOK_CONNECT_TIMEOUT_MS}ms`,
    )
    await vi.advanceTimersByTimeAsync(GITBOOK_CONNECT_TIMEOUT_MS)
    await assertion

    expect(client.close).toHaveBeenCalledTimes(1)
  })

  it('closes the client when listing tools fails', async () => {
    const client = makeClient(() => Promise.reject(new Error('HTTP 504')))
    vi.mocked(experimental_createMCPClient).mockResolvedValue(
      client as unknown as McpClient,
    )

    await expect(connectGitbookMcp()).rejects.toThrow('HTTP 504')
    expect(client.close).toHaveBeenCalledTimes(1)
  })
})
