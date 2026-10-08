import { z } from 'zod'

const responseSchema = z.object({
  data: z.object({ flowId: z.string().nullable() }),
})

export async function findFlowIdByWebhookUrl(
  webhookUrl: string,
): Promise<string | null> {
  const response = await fetch(
    `/api/flows/by-webhook-url?${new URLSearchParams({ webhookUrl })}`,
    { credentials: 'include' },
  )

  if (!response.ok) {
    throw new Error(`Failed to look up pipe: ${response.status}`)
  }

  return responseSchema.parse(await response.json()).data.flowId
}
