import { getLangfuseClient, LangfuseProject } from '@/helpers/langfuse'

export const getPrompt = async (
  promptName: string,
  project: LangfuseProject,
  version?: string,
) => {
  const client = getLangfuseClient(project)

  const prompt = await client.prompt.get(
    promptName,
    version ? { label: version } : undefined,
  )
  return prompt
}
