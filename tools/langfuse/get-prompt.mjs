/**
 * Fetches a prompt from Langfuse and saves it to docs/plans/prompts/<name>_v<version>.md
 *
 * Credentials come from the dev 1Password environment, so run it through npm:
 *   npm run get-prompt -- <promptName> [--project=aiBuilder|pairAction] [--label=<label>] [--version=<number>]
 *
 * --label and --version are mutually exclusive. Defaults to --label=latest if neither is given.
 *
 * Examples:
 *   npm run get-prompt -- chat
 *   npm run get-prompt -- chat-summary --project=aiBuilder --label=latest
 *   npm run get-prompt -- chat --version=154
 */
import { LangfuseClient } from '@langfuse/client'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function parseArgs(argv) {
  const [promptName, ...rest] = argv
  if (!promptName) {
    throw new Error(
      'Usage: npm run get-prompt -- <promptName> [--project=aiBuilder|pairAction] [--label=<label>] [--version=<number>]',
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
      `Missing Langfuse credentials for project "${project}". Run this through "npm run get-prompt" so 1Password injects them.`,
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
  const { promptName, project, label, version, outDir } = parseArgs(
    process.argv.slice(2),
  )

  const query = version ? { version } : { label: label ?? 'latest' }
  console.log('fetching prompt: ', promptName, query, project)

  const client = buildLangfuseClient(project, process.env)
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
