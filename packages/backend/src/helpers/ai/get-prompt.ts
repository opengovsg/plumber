import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import { TextPromptClient } from '@langfuse/client'

import appConfig from '@/config/app'
import { getLangfuseClient, LangfuseProject } from '@/helpers/langfuse'
import logger from '@/helpers/logger'

// The clone of the plumber-prompts repo, not the PROMPTS.md doc next to it.
export const PROMPTS_REPO_DIR = path.resolve(
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

// IMPORTANT: tools/langfuse/lib/prompt-files.mjs writes versions with the same names.
const VERSION_FILE = /^v(\d+)\.md$/

function getLocalPromptDir(
  promptName: string,
  project: LangfuseProject,
): string | null {
  const projectDir = path.join(PROMPTS_REPO_DIR, project)
  const promptDir = path.resolve(projectDir, promptName)
  // path.resolve follows "..", so a crafted name can still leave the folder.
  const fromProject = path.relative(projectDir, promptDir)
  if (
    fromProject === '' ||
    fromProject === '..' ||
    fromProject.startsWith(`..${path.sep}`) ||
    path.isAbsolute(fromProject)
  ) {
    return null
  }
  return promptDir
}

async function findNewestVersion(promptDir: string): Promise<number | null> {
  let files: string[]
  try {
    files = await readdir(promptDir)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
    return null
  }
  const versions = files.flatMap((file) => {
    const match = VERSION_FILE.exec(file)
    return match ? [Number(match[1])] : []
  })
  return versions.length > 0 ? Math.max(...versions) : null
}

/**
 * Serves the newest version file, which is the dev's draft while they edit one.
 */
async function getLocalPrompt(
  promptName: string,
  project: LangfuseProject,
): Promise<TextPromptClient | null> {
  const promptDir = getLocalPromptDir(promptName, project)
  if (!promptDir) {
    return null
  }

  const version = await findNewestVersion(promptDir)
  if (version === null) {
    logger.warn(
      `No local prompt versions in ${promptDir}. Falling back to Langfuse. Run "pnpm run prompts:clone" to read prompts from the prompts repo.`,
      { promptName, project },
    )
    return null
  }

  const content = await readFile(
    path.join(promptDir, `v${version}.md`),
    'utf-8',
  )

  // isFallback stops Langfuse from linking traces to a real prompt version.
  return new TextPromptClient(
    {
      name: promptName,
      version,
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
