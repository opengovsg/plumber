import { experimental_createMCPClient as createMCPClient } from '@ai-sdk/mcp'

import { withTimeout } from '@/helpers/with-timeout'

const GITBOOK_MCP_URL = 'https://guide.plumber.gov.sg/~gitbook/mcp'

/**
 * Shorter than the tool call timeout.
 * The connection runs on every chat message before any output streams.
 */
export const GITBOOK_CONNECT_TIMEOUT_MS = 10_000

export type GitbookMcpClient = Awaited<ReturnType<typeof createMCPClient>>

export async function connectGitbookMcp(): Promise<{
  client: GitbookMcpClient
  tools: Awaited<ReturnType<GitbookMcpClient['tools']>>
}> {
  let connectedClient: GitbookMcpClient | undefined
  const connecting = (async () => {
    const client = await createMCPClient({
      transport: { type: 'http', url: GITBOOK_MCP_URL },
    })
    connectedClient = client
    return { client, tools: await client.tools() }
  })()

  try {
    return await withTimeout(connecting, GITBOOK_CONNECT_TIMEOUT_MS)
  } catch (error) {
    // IMPORTANT: a connection that completes after the timeout would otherwise stay open.
    const closing = connectedClient
      ? connectedClient.close()
      : connecting.then(({ client }) => client.close())
    void closing.catch((): void => undefined)
    throw error
  }
}
