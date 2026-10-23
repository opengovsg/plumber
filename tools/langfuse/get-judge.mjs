/**
 * Fetches an LLM-as-a-judge evaluator from Langfuse and saves its prompt to
 * docs/plans/prompts/judge_<name>_v<version>.md. With --diff, compares the live
 * prompt against a local draft so "is draft e live?" is one command.
 *
 * Credentials come from the dev 1Password environment, so run it through pnpm:
 *   pnpm run get-judge <evaluatorName> [--project=aiBuilder|pairAction] [--version=<n>] [--diff=<local file>] [--from=<iso>]
 *
 * --from bounds the execution-trace search (fallback only). Default: 48 hours ago.
 *
 * Uses GET /api/public/v2/evaluators, which @langfuse/client 4.2 does not wrap.
 * Langfuse versions without that endpoint (404) fall back to the evaluator's
 * newest execution trace in the `langfuse-llm-as-a-judge` environment and
 * rebuild the template from the rendered prompt. Only the template is saved.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildLangfuseClient, langfuseCredentials } from './lib/client.mjs'
import {
  extractPrompt,
  generationText,
  pickEvaluator,
  promptBody,
  templateSkeleton,
} from './lib/judge.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const JUDGE_ENVIRONMENT = 'langfuse-llm-as-a-judge'

function parseArgs(argv) {
  const [name, ...rest] = argv
  if (!name) {
    throw new Error(
      'Usage: pnpm run get-judge <evaluatorName> [--project=aiBuilder|pairAction] [--version=<n>] [--diff=<local file>] [--from=<iso>]',
    )
  }
  const flags = {}
  for (const arg of rest) {
    const match = /^--([^=]+)=(.*)$/.exec(arg)
    if (match) flags[match[1]] = match[2]
  }
  return {
    name,
    project: flags.project ?? 'aiBuilder',
    version: flags.version ? Number(flags.version) : undefined,
    diff: flags.diff,
    from: flags.from ?? new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
    outDir: join(__dirname, '../../docs/plans/prompts'),
  }
}

async function getJson(credentials, path) {
  const response = await fetch(`${credentials.baseUrl}${path}`, {
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${credentials.publicKey}:${credentials.secretKey}`,
      ).toString('base64')}`,
      ...credentials.additionalHeaders,
    },
  })
  if (!response.ok) {
    const body = (await response.text()).replace(/<[^>]+>/g, ' ').trim()
    const error = new Error(
      `GET ${path} returned ${response.status}. ${body.slice(0, 160)}`,
    )
    error.status = response.status
    throw error
  }
  return response.json()
}

async function listEvaluators(credentials) {
  const all = []
  let cursor
  do {
    const query = new URLSearchParams({ limit: '100' })
    if (cursor) query.set('cursor', cursor)
    const page = await getJson(
      credentials,
      `/api/public/v2/evaluators?${query}`,
    )
    all.push(...(page.data ?? page.evaluators ?? []))
    cursor = page.meta?.nextCursor ?? page.nextCursor ?? null
  } while (cursor)
  return all
}

async function findVersion(credentials, evaluatorId, version) {
  let cursor
  do {
    const query = new URLSearchParams({ limit: '100' })
    if (cursor) query.set('cursor', cursor)
    const page = await getJson(
      credentials,
      `/api/public/v2/evaluators/${evaluatorId}/versions?${query}`,
    )
    const hit = (page.data ?? page.versions ?? []).find(
      (entry) => Number(entry.version) === version,
    )
    if (hit) return hit
    cursor = page.meta?.nextCursor ?? page.nextCursor ?? null
  } while (cursor)
  throw new Error(`Evaluator ${evaluatorId} has no version ${version}.`)
}

async function fromExecutionTrace(project, name, from) {
  const client = buildLangfuseClient(project, process.env)
  const page = await client.api.trace.list({
    page: 1,
    limit: 50,
    environment: JUDGE_ENVIRONMENT,
    fromTimestamp: from,
    orderBy: 'timestamp.desc',
  })
  const traces = page.data ?? []
  if (traces.length === 0) {
    throw new Error(
      `No traces in environment ${JUDGE_ENVIRONMENT} since ${from}. Widen with --from=<iso>.`,
    )
  }
  const wanted = name.toLowerCase()
  const summary =
    traces.find((trace) =>
      JSON.stringify([trace.name, trace.metadata, trace.tags])
        .toLowerCase()
        .includes(wanted),
    ) ?? traces[0]
  const trace = await client.api.trace.get(summary.id)
  const generation = (trace.observations ?? []).find(
    (observation) => observation.type === 'GENERATION' && observation.input,
  )
  if (!generation) {
    throw new Error(`Trace ${summary.id} has no generation with an input.`)
  }
  const template = templateSkeleton(generationText(generation.input))
  if (!template) {
    throw new Error(
      `Trace ${summary.id}: could not find INPUT: and the rules marker in the rendered prompt.`,
    )
  }
  return {
    prompt: template,
    source: `execution trace ${summary.id} (${summary.timestamp}), model ${
      generation.model ?? 'unknown'
    }`,
  }
}

function saveJudge(outDir, name, version, prompt, notes) {
  mkdirSync(outDir, { recursive: true })
  const outPath = join(outDir, `judge_${name}_v${version}.md`)
  const header = [
    `# ${name} evaluator, pulled from Langfuse ${new Date()
      .toISOString()
      .slice(0, 10)}`,
    '',
    ...notes,
    '',
    '---',
    '',
  ].join('\n')
  writeFileSync(outPath, header + prompt.trim() + '\n', 'utf-8')
  return outPath
}

function normalise(text) {
  return (
    text
      .split('\n')
      .map((line) => line.trimEnd())
      .join('\n')
      .trim() + '\n'
  )
}

function showDiff(localPath, livePrompt) {
  const local = normalise(promptBody(readFileSync(localPath, 'utf-8')))
  const live = normalise(livePrompt)
  if (local === live) {
    console.log(`No difference: ${localPath} matches the live judge prompt.`)
    return
  }
  const liveTmp = join(tmpdir(), `judge-live-${Date.now()}.md`)
  const localTmp = join(tmpdir(), `judge-local-${Date.now()}.md`)
  writeFileSync(liveTmp, live)
  writeFileSync(localTmp, local)
  const result = spawnSync(
    'diff',
    ['-u', '--label', 'live', '--label', localPath, liveTmp, localTmp],
    { encoding: 'utf-8' },
  )
  console.log(result.stdout || result.stderr)
}

async function main() {
  const { name, project, version, diff, from, outDir } = parseArgs(
    process.argv.slice(2),
  )
  const credentials = langfuseCredentials(project, process.env)

  let evaluators
  try {
    evaluators = await listEvaluators(credentials)
  } catch (error) {
    if (error.status !== 404) throw error
    console.log(
      'This Langfuse has no /v2/evaluators endpoint. Reading the newest judge execution trace instead.',
    )
    const { prompt, source } = await fromExecutionTrace(project, name, from)
    const outPath = saveJudge(outDir, name, 'live', prompt, [
      `Source: ${source}.`,
    ])
    console.log(`Saved ${name} (from ${source}) to ${outPath}`)
    if (diff) showDiff(diff, prompt)
    return
  }

  const { chosen, matches } = pickEvaluator(evaluators, name)
  if (!chosen) {
    const names = [...new Set(evaluators.map((entry) => entry.name))].sort()
    throw new Error(
      `No evaluator named "${name}". Evaluators:\n  ${names.join('\n  ')}`,
    )
  }
  if (matches.length > 1) {
    console.log(
      `${
        matches.length
      } evaluators share the name "${name}". Using the newest: ${
        chosen.id
      }. Others: ${matches
        .slice(1)
        .map((entry) => entry.id)
        .join(', ')}`,
    )
  }

  const payload = version
    ? await findVersion(credentials, chosen.id, version)
    : await getJson(credentials, `/api/public/v2/evaluators/${chosen.id}`)
  const prompt = extractPrompt(payload)
  if (!prompt) {
    throw new Error(
      `Could not find a prompt field on evaluator ${
        chosen.id
      }. Keys: ${Object.keys(payload).join(', ')}`,
    )
  }
  const resolvedVersion = payload.version ?? chosen.version ?? 'unknown'
  const notes = [`Evaluator id: ${chosen.id}. Version: ${resolvedVersion}.`]
  if (payload.modelConfig) {
    notes.push(`Model config: ${JSON.stringify(payload.modelConfig)}`)
  }
  const outPath = saveJudge(outDir, name, resolvedVersion, prompt, notes)
  console.log(`Saved ${name} v${resolvedVersion} to ${outPath}`)
  if (diff) showDiff(diff, prompt)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
