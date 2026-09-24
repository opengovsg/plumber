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

export const getPrompts = async (
  promptNames: string[],
  project: LangfuseProject,
  version?: string,
) => {
  const entries = await Promise.all(
    promptNames.map(async (promptName) => {
      const prompt = await getPrompt(promptName, project, version)
      return [promptName, prompt] as const
    }),
  )

  return new Map(entries)
}
