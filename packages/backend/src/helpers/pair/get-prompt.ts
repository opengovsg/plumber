import { langfuseClient } from '@/helpers/langfuse'

export const getPrompt = async (promptName: string, version?: string) => {
  const prompt = await langfuseClient.prompt.get(
    promptName,
    version ? { label: version } : undefined,
  )
  return prompt
}
