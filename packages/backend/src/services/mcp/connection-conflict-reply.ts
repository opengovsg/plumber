import { z } from 'zod/v4'

export const NO_CONNECTION_CONFLICT_MESSAGE =
  'The override is only allowed in the reply to your webhook conflict question for this step and connection. Nothing was changed. Ask which pipe or form the user means, or call update_step_parameters again to show the conflict.'

export interface ChatHistoryMessage {
  role: string
  parts: unknown[]
}

const conflictResultPartSchema = z.object({
  type: z.literal('tool-update_step_parameters'),
  state: z.literal('output-available'),
  input: z.object({ step_id: z.string(), connection_id: z.string() }),
  output: z.object({ connectionConflict: z.literal(true) }),
})

/**
 * Checks that the current request is the user's reply to a webhook conflict
 * shown for this step and connection.
 *
 * register_connection overwrites a FormSG webhook. A prompt rule alone did not
 * stop the model calling it without the user's answer.
 */
export function isReplyToConnectionConflict(
  messages: ChatHistoryMessage[],
  stepId: string,
  connectionId: string,
): boolean {
  const current = messages.at(-1)
  const previous = messages.at(-2)
  if (current?.role !== 'user' || previous?.role !== 'assistant') {
    return false
  }
  return previous.parts.some((part) => {
    const parsed = conflictResultPartSchema.safeParse(part)
    return (
      parsed.success &&
      parsed.data.input.step_id === stepId &&
      parsed.data.input.connection_id === connectionId
    )
  })
}
