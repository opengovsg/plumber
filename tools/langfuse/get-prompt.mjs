/**
 * Fetches a prompt from Langfuse and saves it to docs/plans/prompts/<name>_v<version>.md
 *
 * Usage:
 *   node get-prompt.mjs <promptName> [--project=aiBuilder|pairAction] [--label=<label>] [--version=<number>] [--env=<path-to-env-file>]
 *
 * --label and --version are mutually exclusive; defaults to --label=latest if neither is given.
 *
 * Examples:
 *   node get-prompt.mjs chat
 *   node get-prompt.mjs chat-summary --project=aiBuilder --label=latest
 *   node get-prompt.mjs chat --version=154
 *   node get-prompt.mjs chat --project=aiBuilder --label=latest --env=../../packages/backend/.env
 */
import { LangfuseClient } from '@langfuse/client'
import { config } from 'dotenv'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function parseArgs(argv) {
  const [promptName, ...rest] = argv
  if (!promptName) {
    throw new Error(
      'Usage: node get-prompt.mjs <promptName> [--project=aiBuilder|pairAction] [--label=<label>] [--version=<number>] [--env=<path>]',
    )
  }

  const flags = {}
  for (const arg of rest) {
    const match = /^--([^=]+)=(.*)$/.exec(arg)
    if (match) {
      flags[match[1]] = match[2]
    }
  }

  if (flags.label && flags.version) {
    throw new Error('--label and --version are mutually exclusive')
  }

  return {
    promptName,
    project: flags.project ?? 'aiBuilder',
    label: flags.label,
    version: flags.version ? Number(flags.version) : undefined,
    envPath: flags.env ?? join(__dirname, '../../packages/backend/.env'),
    outDir: join(__dirname, '../../docs/plans/prompts'),
  }
}

function buildLangfuseClient(project, env) {
  const credentials =
    project === 'aiBuilder'
      ? {
          publicKey: env.PAIR_ROME_AI_BUILDER_PUBLIC_KEY,
          secretKey: env.PAIR_ROME_AI_BUILDER_SECRET_KEY,
        }
      : {
          publicKey: env.PAIR_ROME_PAIR_ACTION_PUBLIC_KEY,
          secretKey: env.PAIR_ROME_PAIR_ACTION_SECRET_KEY,
        }

  if (!credentials.publicKey || !credentials.secretKey) {
    throw new Error(
      `Missing Langfuse credentials for project "${project}" — check your env file`,
    )
  }

  return new LangfuseClient({
    timeout: 10000,
    baseUrl: env.PAIR_ROME_BASE_URL,
    additionalHeaders: {
      'CF-Access-Client-Id': env.PAIR_ROME_CLOUDFLARE_ZERO_TRUST_CLIENT_KEY,
      'CF-Access-Client-Secret': env.PAIR_ROME_CLOUDFLARE_ZERO_TRUST_SECRET_KEY,
    },
    ...credentials,
  })
}

async function main() {
  const { promptName, project, label, version, envPath, outDir } = parseArgs(
    process.argv.slice(2),
  )

  const { parsed: env } = config({ path: envPath })
  if (!env) {
    throw new Error(`Could not load env file at ${envPath}`)
  }

  const query = version ? { version } : { label: label ?? 'latest' }
  console.log('fetching prompt: ', promptName, query, project)

  const client = buildLangfuseClient(project, env)
  const prompt = await client.prompt.get(promptName, query)

  console.log('fetched prompt version: ', prompt.version)

  const content =
    typeof prompt.prompt === 'string'
      ? prompt.prompt
      : JSON.stringify(prompt.prompt, null, 2)

  mkdirSync(outDir, { recursive: true })
  const outPath = join(outDir, `${promptName}_v${prompt.version}.md`)

  writeFileSync(outPath, content, 'utf-8')
  console.log(`Saved ${promptName} v${prompt.version} to ${outPath}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
