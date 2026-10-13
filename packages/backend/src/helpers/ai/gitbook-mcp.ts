import { experimental_createMCPClient as createMCPClient } from '@ai-sdk/mcp'

import {
  type McpToolUsageMeta,
  wrapMcpToolsWithUsageLogs,
} from '@/helpers/mcp-tool-usage-log'

export const GITBOOK_MCP_URL = 'https://guide.plumber.gov.sg/~gitbook/mcp'

export async function openGitBookMcp(meta: McpToolUsageMeta): Promise<{
  tools: Record<string, unknown>
  close: () => Promise<void>
}> {
  const client = await createMCPClient({
    transport: {
      type: 'http',
      url: GITBOOK_MCP_URL,
    },
  })

  try {
    const tools = wrapMcpToolsWithUsageLogs(await client.tools(), meta)
    let closed = false
    return {
      tools,
      close: async () => {
        if (closed) {
          return
        }
        closed = true
        await client.close()
      },
    }
  } catch (error) {
    await client.close()
    throw error
  }
}
