import { experimental_createMCPClient as createMCPClient } from '@ai-sdk/mcp'

import { withTimeout } from '@/helpers/with-timeout'

const GITBOOK_MCP_URL = 'https://guide.plumber.gov.sg/~gitbook/mcp'

/**
 * Shorter than the tool call timeout.
 * The connection runs on every chat message before any output streams.
 */
export const GITBOOK_CONNECT_TIMEOUT_MS = 10_000

export type GitbookMcpClient = Awaited<ReturnType<typeof createMCPClient>>

function closeQuietly(client: GitbookMcpClient): void {
  void client.close().catch((): void => undefined)
}

export async function connectGitbookMcp(): Promise<{
  client: GitbookMcpClient
  tools: Awaited<ReturnType<GitbookMcpClient['tools']>>
}> {
  let gaveUp = false
  let connectedClient: GitbookMcpClient | undefined
  const connecting = (async () => {
    const client = await createMCPClient({
      transport: { type: 'http', url: GITBOOK_MCP_URL },
    })
    connectedClient = client
    // IMPORTANT: a client that connects after the timeout would otherwise stay open.
    if (gaveUp) {
      closeQuietly(client)
    }
    return { client, tools: await client.tools() }
  })()

  try {
    return await withTimeout(connecting, GITBOOK_CONNECT_TIMEOUT_MS)
  } catch (error) {
    gaveUp = true
    if (connectedClient) {
      closeQuietly(connectedClient)
    }
    throw error
  }
}
