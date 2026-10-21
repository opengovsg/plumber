import {
  NoSuchToolError,
  type StreamTextTransform,
  type ToolCallRepairFunction,
  type ToolSet,
} from 'ai'

import logger from '@/helpers/logger'

// Only markup characters may follow the name. A suffix like `:preview` could
// be a different intent, and repairing it could run a real-send tool.
const NAME_WITH_TRAILING_MARKUP = /^([a-zA-Z0-9_-]+)[\s"'/<>]*$/

function resolveRegisteredToolName(
  toolName: string,
  tools: ToolSet,
): string | null {
  const cleanedName = NAME_WITH_TRAILING_MARKUP.exec(toolName)?.[1]
  return cleanedName && Object.hasOwn(tools, cleanedName) ? cleanedName : null
}

/**
 * Claude on Bedrock occasionally returns a tool name with trailing markup
 * (e.g. `list_apps" />`). The AI SDK keeps the unknown call in history and
 * Bedrock rejects it on the next request, so we rename it before that happens.
 */
export const repairMalformedToolName: ToolCallRepairFunction<ToolSet> = async ({
  toolCall,
  tools,
  error,
}) => {
  if (!NoSuchToolError.isInstance(error)) {
    return null
  }

  const cleanedName = resolveRegisteredToolName(toolCall.toolName, tools)
  if (!cleanedName) {
    return null
  }

  logger.warn('Repaired malformed tool name', {
    toolName: toolCall.toolName,
    cleanedName,
  })
  return { ...toolCall, toolName: cleanedName }
}

/**
 * The UI message part is created from the streamed `tool-input-start` name,
 * before the repair runs. The frontend echoes that part type back on the next
 * turn, where the malformed name fails request validation.
 */
export const repairMalformedStreamedToolNames: StreamTextTransform<ToolSet> = ({
  tools,
}) =>
  new TransformStream({
    transform(chunk, controller) {
      if (chunk.type === 'tool-input-start') {
        const cleanedName = resolveRegisteredToolName(chunk.toolName, tools)
        if (cleanedName) {
          controller.enqueue({ ...chunk, toolName: cleanedName })
          return
        }
      }
      controller.enqueue(chunk)
    },
  })
