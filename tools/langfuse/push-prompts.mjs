/**
 * Reviews local AI Builder prompt drafts before creating Langfuse versions.
 *
 * Usage:
 *   node push-prompts.mjs [--name=<prompt>] [--env=<path-to-env-file>]
 */
import { LangfuseClient } from '@langfuse/client'
import { config } from 'dotenv'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROMPTS_DIR = join(__dirname, 'prompts/ai-builder')
const PROMPTS = [
  'ai-builder/core',
  'ai-builder/align',
  'ai-builder/propose',
  'ai-builder/configure',
  'ai-builder/edit',
  'ai-builder/guide',
  'ai-builder/unsupported',
  'ai-builder/output-format',
  'ai-builder/manifest',
]

function parseArgs(argv) {
  const flags = {}
  for (const arg of argv) {
    const match = /^--([^=]+)=(.*)$/.exec(arg)
    if (!match) {
      throw new Error(`Unknown argument: ${arg}`)
    }
    flags[match[1]] = match[2]
  }

  if (flags.name && !PROMPTS.includes(flags.name)) {
    throw new Error(`Unknown prompt name: ${flags.name}`)
  }

  return {
    promptNames: flags.name ? [flags.name] : PROMPTS,
    envPath: flags.env ?? join(__dirname, '../../packages/backend/.env'),
  }
}

function buildLangfuseClient(env) {
  const publicKey = env.PAIR_ROME_AI_BUILDER_PUBLIC_KEY
  const secretKey = env.PAIR_ROME_AI_BUILDER_SECRET_KEY
  if (!publicKey || !secretKey) {
    throw new Error('Missing Langfuse AI Builder credentials')
  }

  return new LangfuseClient({
    timeout: 10000,
    baseUrl: env.PAIR_ROME_BASE_URL,
    additionalHeaders: {
      'CF-Access-Client-Id':
        env.PAIR_ROME_CLOUDFLARE_ZERO_TRUST_CLIENT_KEY,
      'CF-Access-Client-Secret':
        env.PAIR_ROME_CLOUDFLARE_ZERO_TRUST_SECRET_KEY,
    },
    publicKey,
    secretKey,
  })
}

function promptPath(promptName) {
  const filename =
    promptName === 'ai-builder/manifest'
      ? 'manifest.json'
      : `${basename(promptName)}.md`
  return join(PROMPTS_DIR, filename)
}

function readDraft(promptName) {
  const path = promptPath(promptName)
  const text = readFileSync(path, 'utf8')
  if (promptName !== 'ai-builder/manifest') {
    return { prompt: text, config: {} }
  }

  return {
    prompt: '{}',
    config: JSON.parse(text),
  }
}

function isNotFound(error) {
  if (!(error instanceof Error)) {
    return false
  }
  const status = error.status ?? error.statusCode
  return status === 404 || /\b404\b/.test(error.message)
}

async function getLatestPrompt(client, promptName) {
  try {
    return await client.prompt.get(promptName, { label: 'latest' })
  } catch (error) {
    if (isNotFound(error)) {
      return null
    }
    throw error
  }
}

function stringifyPrompt(prompt) {
  if (!prompt) {
    return ''
  }
  const body =
    typeof prompt.prompt === 'string'
      ? prompt.prompt
      : JSON.stringify(prompt.prompt, null, 2)
  const configText = JSON.stringify(prompt.config ?? {}, null, 2)
  return `${body}\n\n--- config ---\n${configText}\n`
}

function stringifyDraft(draft) {
  const configText = JSON.stringify(draft.config, null, 2)
  return `${draft.prompt}\n\n--- config ---\n${configText}\n`
}

function printDiff(promptName, oldText, newText) {
  const tempDir = mkdtempSync(join(tmpdir(), 'langfuse-prompt-'))
  const oldPath = join(tempDir, 'langfuse-latest')
  const newPath = join(tempDir, 'local-draft')
  writeFileSync(oldPath, oldText)
  writeFileSync(newPath, newText)

  console.log(`\n=== ${promptName} ===`)
  try {
    const output = execFileSync(
      'git',
      ['diff', '--no-index', '--no-ext-diff', '--', oldPath, newPath],
      { encoding: 'utf8' },
    )
    console.log(output || '(unchanged)')
  } catch (error) {
    if (error.status !== 1) {
      throw error
    }
    console.log(error.stdout)
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
}

async function confirmWrite() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.log('No prompts written. Run interactively to confirm changes.')
    return false
  }

  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  const answer = await readline.question(
    'Type "yes" to create these Langfuse prompt versions: ',
  )
  readline.close()
  return answer === 'yes'
}

async function main() {
  const { promptNames, envPath } = parseArgs(process.argv.slice(2))
  const { parsed: env } = config({ path: envPath })
  if (!env) {
    throw new Error(`Could not load env file at ${envPath}`)
  }

  const client = buildLangfuseClient(env)
  const changes = []
  const statuses = []

  for (const promptName of promptNames) {
    const draft = readDraft(promptName)
    const latest = await getLatestPrompt(client, promptName)
    const oldText = stringifyPrompt(latest)
    const newText = stringifyDraft(draft)
    const status = latest ? (oldText === newText ? 'unchanged' : 'changed') : 'new'
    statuses.push({ promptName, status })

    if (status !== 'unchanged') {
      printDiff(promptName, oldText, newText)
      changes.push({ promptName, draft })
    }
  }

  console.log('\nSummary')
  for (const { promptName, status } of statuses) {
    console.log(`- ${promptName}: ${status}`)
  }

  if (changes.length === 0 || !(await confirmWrite())) {
    console.log('No prompts written.')
    return
  }

  for (const { promptName, draft } of changes) {
    const created = await client.prompt.create({
      name: promptName,
      type: 'text',
      prompt: draft.prompt,
      config: draft.config,
      labels: ['latest'],
    })
    console.log(`Created ${promptName} version ${created.version}`)
  }

  console.log(
    'Only latest was assigned. Production is unchanged. Promote in Langfuse when ready.',
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
