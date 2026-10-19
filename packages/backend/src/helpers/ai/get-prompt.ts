import { TextPromptClient } from '@langfuse/client'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import appConfig from '@/config/app'
import { getLangfuseClient, LangfuseProject } from '@/helpers/langfuse'
import logger from '@/helpers/logger'

export const LOCAL_PROMPTS_DIR = path.resolve(
  __dirname,
  '../../../../../tools/langfuse/prompts',
)

/**
 * Lets devs iterate on prompts without creating Langfuse versions.
 * Set AI_BUILDER_PROMPT_SOURCE=langfuse to test the real Langfuse prompt locally.
 */
function shouldUseLocalPrompt(): boolean {
  return appConfig.isDev && process.env.AI_BUILDER_PROMPT_SOURCE !== 'langfuse'
}

function getLocalPromptPath(
  promptName: string,
  project: LangfuseProject,
): string | null {
  const projectDir = path.join(LOCAL_PROMPTS_DIR, project)
  const promptPath = path.resolve(projectDir, `${promptName}.md`)
  if (!promptPath.startsWith(projectDir + path.sep)) {
    return null
  }
  return promptPath
}

async function getLocalPrompt(
  promptName: string,
  project: LangfuseProject,
): Promise<TextPromptClient | null> {
  const promptPath = getLocalPromptPath(promptName, project)
  if (!promptPath) {
    return null
  }

  let content: string
  try {
    content = await readFile(promptPath, 'utf-8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
    logger.warn(
      `No local prompt at ${promptPath}. Falling back to Langfuse. Run "pnpm run prompt pull ${promptName} --project=${project}" to edit it locally.`,
      { promptName, project },
    )
    return null
  }

  // isFallback stops Langfuse from linking traces to a real prompt version.
  return new TextPromptClient(
    {
      name: promptName,
      version: 0,
      prompt: content,
      config: {},
      labels: ['local'],
      tags: [],
      type: 'text',
    },
    true,
  )
}

export const getPrompt = async (
  promptName: string,
  project: LangfuseProject,
  version?: string,
) => {
  if (shouldUseLocalPrompt()) {
    const localPrompt = await getLocalPrompt(promptName, project)
    if (localPrompt) {
      return localPrompt
    }
  }

  const client = getLangfuseClient(project)

  const prompt = await client.prompt.get(
    promptName,
    version ? { label: version } : undefined,
  )
  return prompt
}
