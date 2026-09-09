/**
 * Step 0 spike: check whether PAIR Foundry returns prompt-cache hits.
 *
 * Sends two identical chat/completions requests with Anthropic-style
 * cache_control on a long system prompt. Pass if the second response shows
 * cached_tokens or cache_read_input_tokens > 0.
 *
 * Usage:
 *   node spike-prompt-cache.mjs [--env=<path-to-env-file>] [--base-url=<url>]
 *
 * Required env (from packages/backend/.env by default, or process.env):
 *   PAIR_FOUNDRY_API_KEY
 *   PAIR_FOUNDRY_MODEL
 *
 * Examples:
 *   node spike-prompt-cache.mjs
 *   node spike-prompt-cache.mjs --env=../../packages/backend/.env
 *   PAIR_FOUNDRY_API_KEY=... PAIR_FOUNDRY_MODEL=... node spike-prompt-cache.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEFAULT_BASE_URL = 'https://engine.pair.gov.sg'
const DEFAULT_ENV_PATH = join(__dirname, '../../packages/backend/.env')

function parseArgs(argv) {
  const flags = {}
  for (const arg of argv) {
    const match = /^--([^=]+)=(.*)$/.exec(arg)
    if (!match) {
      throw new Error(
        `Unknown argument: ${arg}\nUsage: node spike-prompt-cache.mjs [--env=<path>] [--base-url=<url>]`,
      )
    }
    flags[match[1]] = match[2]
  }

  return {
    envPath: flags.env ?? DEFAULT_ENV_PATH,
    baseUrl: (flags['base-url'] ?? DEFAULT_BASE_URL).replace(/\/$/, ''),
  }
}

function loadEnvFile(envPath) {
  let contents
  try {
    contents = readFileSync(envPath, 'utf8')
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return
    }
    throw error
  }

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) {
      continue
    }

    const eq = line.indexOf('=')
    if (eq <= 0) {
      continue
    }

    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    // Do not override vars already set in the shell.
    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

function requireEnv(name) {
  const value = process.env[name]
  if (!value || value === '...') {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value
}

function buildSystemPrompt() {
  // Long enough to clear typical Claude/Bedrock cache minimums (1k–4k tokens).
  return `You are Plumber AI Builder. ${'Follow these fixed instructions. '.repeat(400)}`
}

function extractCacheUsage(usage) {
  if (!usage || typeof usage !== 'object') {
    return {
      promptTokens: undefined,
      completionTokens: undefined,
      cachedTokens: undefined,
      cacheReadInputTokens: undefined,
      cacheCreationInputTokens: undefined,
    }
  }

  return {
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
    cachedTokens: usage.prompt_tokens_details?.cached_tokens,
    cacheReadInputTokens: usage.cache_read_input_tokens,
    cacheCreationInputTokens: usage.cache_creation_input_tokens,
  }
}

function isCacheHit(cacheUsage) {
  return (
    (typeof cacheUsage.cachedTokens === 'number' &&
      cacheUsage.cachedTokens > 0) ||
    (typeof cacheUsage.cacheReadInputTokens === 'number' &&
      cacheUsage.cacheReadInputTokens > 0)
  )
}

async function callChatCompletions({ baseUrl, apiKey, body }) {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const text = await response.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error(
      `PAIR returned non-JSON (HTTP ${response.status}): ${text.slice(0, 500)}`,
    )
  }

  if (!response.ok) {
    throw new Error(
      `PAIR request failed (HTTP ${response.status}): ${JSON.stringify(json)}`,
    )
  }

  return json
}

async function main() {
  const { envPath, baseUrl } = parseArgs(process.argv.slice(2))
  loadEnvFile(envPath)

  const apiKey = requireEnv('PAIR_FOUNDRY_API_KEY')
  const model = requireEnv('PAIR_FOUNDRY_MODEL')
  const systemPrompt = buildSystemPrompt()

  const body = {
    model,
    max_tokens: 16,
    messages: [
      {
        role: 'system',
        content: [
          {
            type: 'text',
            text: systemPrompt,
            cache_control: { type: 'ephemeral' },
          },
        ],
      },
      {
        role: 'user',
        content: 'Reply with OK.',
      },
    ],
  }

  console.log('PAIR prompt-cache spike')
  console.log(`  baseUrl: ${baseUrl}`)
  console.log(`  model:   ${model}`)
  console.log(`  env:     ${envPath}`)
  console.log(`  system:  ~${systemPrompt.split(/\s+/).length} words (approx)`)
  console.log('')

  console.log('Turn 1 (expect cache write or full input)...')
  const turn1 = await callChatCompletions({ baseUrl, apiKey, body })
  const usage1 = extractCacheUsage(turn1.usage)
  console.log(JSON.stringify({ usage: turn1.usage, parsed: usage1 }, null, 2))
  console.log('')

  await delay(2000)

  console.log('Turn 2 (expect cache read if PAIR supports caching)...')
  const turn2 = await callChatCompletions({ baseUrl, apiKey, body })
  const usage2 = extractCacheUsage(turn2.usage)
  console.log(JSON.stringify({ usage: turn2.usage, parsed: usage2 }, null, 2))
  console.log('')

  if (isCacheHit(usage2)) {
    console.log('PASS: turn 2 shows a prompt-cache hit.')
    process.exitCode = 0
    return
  }

  console.log('FAIL: turn 2 shows no cache hit.')
  console.log(
    'Next: retry without client cache_control, or ask PAIR to enable litellm auto-inject.',
  )
  process.exitCode = 1
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
