/**
 * Maintains the AI Builder gold dataset and reads Langfuse experiment runs.
 *
 *   cd tools/langfuse
 *   pnpm run eval-dataset sample   --tags=ai-builder --from=<iso> [--to=<iso>] [--limit=100] [--environment=production]
 *   pnpm run eval-dataset validate --items=datasets/<name>/items.json
 *   pnpm run eval-dataset coverage --items=datasets/<name>/items.json
 *   pnpm run eval-dataset push     --items=datasets/<name>/items.json --dataset=<langfuse dataset> [--archive-missing]
 *   pnpm run eval-dataset read     --dataset=<langfuse dataset> [--run=<run name>] [--score=tool_intent_correctness]
 *   pnpm run eval-dataset compare  --baseline=out/<dataset>/<run-a>.json --candidate=out/<dataset>/<run-b>.json
 *   pnpm run eval-dataset improve  --report=out/<dataset>/<run>.json [--items=<path>] [--apply] [--push --dataset=<name>]
 *
 * sample, push, read and improve --push need 1Password env injection, same as get-prompt.
 * validate, coverage, compare and improve run offline.
 *
 * The improver never drops must_not_tools. A forbidden tool call stays a failure.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { compareRuns, formatCompare } from './lib/compare.mjs'
import { coverageReport, formatCoverage } from './lib/coverage.mjs'
import { applyProposals, proposeAll } from './lib/improve.mjs'
import { readEvalRun } from './lib/read-run.mjs'
import { sampleTraces } from './lib/sample.mjs'
import { expectedOutputOf, itemId, validateItems } from './lib/schema.mjs'
import { knownTools } from './lib/tools.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

const USAGE =
  'Usage: pnpm run eval-dataset <sample|validate|coverage|push|read|compare|improve> [--flag=value ...]. See the header of eval-dataset.mjs.'

function parseArgs(argv) {
  const [command, ...rest] = argv
  if (!command || command.startsWith('--')) {
    throw new Error(USAGE)
  }
  const flags = { apply: false, push: false, 'archive-missing': false }
  for (const arg of rest) {
    const match = /^--([^=]+)(?:=(.*))?$/.exec(arg)
    if (!match) {
      continue
    }
    flags[match[1]] = match[2] === undefined ? true : match[2]
  }
  return { command, flags }
}

function readJson(path) {
  return JSON.parse(readFileSync(resolve(path), 'utf8'))
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n')
}

function requireFlag(flags, name, command) {
  if (!flags[name]) {
    throw new Error(`${command} requires --${name}=<value>`)
  }
  return flags[name]
}

/**
 * Loaded on demand so the offline commands work without the SDK installed.
 */
async function langfuseClient(flags) {
  const { buildLangfuseClient } = await import('./lib/client.mjs')
  return buildLangfuseClient(flags.project ?? 'aiBuilder', process.env)
}

function reportPath(datasetName, runName) {
  const safe = (value) => value.replace(/[^a-zA-Z0-9._-]+/g, '_')
  return join(__dirname, 'out', safe(datasetName), `${safe(runName)}.json`)
}

function loadItems(flags, command) {
  const path = requireFlag(flags, 'items', command)
  const items = readJson(path)
  const tools = knownTools()
  if (!tools) {
    console.warn('Backend tool list not found. Tool names are not checked.')
  }
  const errors = validateItems(items, { knownTools: tools })
  const drafts = Array.isArray(items)
    ? items.filter((item) => item?.metadata?.status === 'draft')
    : []
  for (const draft of drafts) {
    errors.push(
      `items: "${
        itemId(draft) ?? '(no id)'
      }" is still a draft. Review it and remove metadata.status.`,
    )
  }
  return { path: resolve(path), items, tools, errors }
}

function printErrors(errors) {
  for (const error of errors) {
    console.error(`- ${error}`)
  }
}

async function sampleCommand(flags) {
  const from = requireFlag(flags, 'from', 'sample')
  const client = await langfuseClient(flags)
  const result = await sampleTraces(client, {
    tags: flags.tags ?? 'ai-builder',
    from,
    to: flags.to,
    limit: Number(flags.limit ?? 100),
    environment: flags.environment,
  })
  const stamp = new Date().toISOString().slice(0, 10)
  const path = join(__dirname, 'out', 'candidates', `${stamp}.json`)
  writeJson(path, result)
  console.log(
    `Wrote ${path} (${result.candidates.length} candidates from ${result.tracesSeen} traces, ${result.redactions} values redacted)`,
  )
  console.log('Observed strata:')
  for (const [key, count] of Object.entries(result.strata)) {
    console.log(`  ${key}: ${count}`)
  }
}

function validateCommand(flags) {
  const { path, items, errors } = loadItems(flags, 'validate')
  if (errors.length > 0) {
    console.error(`${errors.length} problems in ${path}:`)
    printErrors(errors)
    process.exitCode = 1
    return
  }
  console.log(`${items.length} items in ${path} are valid.`)
}

function coverageCommand(flags) {
  const { items, tools, errors } = loadItems(flags, 'coverage')
  if (errors.length > 0) {
    console.error('Fix validation errors first:')
    printErrors(errors)
    process.exitCode = 1
    return
  }
  const report = coverageReport(items, { knownTools: tools })
  console.log(formatCoverage(report))
  if (flags.json) {
    writeJson(resolve(flags.json), report)
    console.log(`\nWrote ${resolve(flags.json)}`)
  }
}

async function pushCommand(flags) {
  const datasetName = requireFlag(flags, 'dataset', 'push')
  const { items, errors } = loadItems(flags, 'push')
  if (errors.length > 0) {
    console.error('Refusing to push. Fix validation errors first:')
    printErrors(errors)
    process.exitCode = 1
    return
  }
  const client = await langfuseClient(flags)
  const pushedIds = new Set()
  for (const item of items) {
    const id = itemId(item)
    await client.api.datasetItems.create({
      datasetName,
      id,
      input: item.input,
      expectedOutput: expectedOutputOf(item),
      metadata: item.metadata,
      status: 'ACTIVE',
    })
    pushedIds.add(id)
  }
  console.log(`Upserted ${pushedIds.size} items into "${datasetName}".`)

  const dataset = await client.dataset.get(datasetName)
  const stale = dataset.items.filter(
    (item) => item.status === 'ACTIVE' && !pushedIds.has(item.id),
  )
  if (stale.length === 0) {
    return
  }
  if (!flags['archive-missing']) {
    console.log(
      `${stale.length} active items in Langfuse are not in the file. Pass --archive-missing to archive them:`,
    )
    for (const item of stale) {
      console.log(`  ${item.id}`)
    }
    return
  }
  for (const item of stale) {
    await client.api.datasetItems.create({
      datasetName,
      id: item.id,
      input: item.input,
      expectedOutput: item.expectedOutput,
      metadata: item.metadata,
      status: 'ARCHIVED',
    })
  }
  console.log(`Archived ${stale.length} items.`)
}

async function readCommand(flags) {
  const datasetName = requireFlag(flags, 'dataset', 'read')
  const client = await langfuseClient(flags)
  const report = await readEvalRun(client, {
    datasetName,
    runName: flags.run,
    scoreName: flags.score ?? 'tool_intent_correctness',
  })
  const path = reportPath(report.datasetName, report.runName)
  writeJson(path, report)
  console.log(
    `Wrote ${path} (${report.counts.passed} true, ${report.counts.failed} false, ${report.counts.unscored} unscored)`,
  )
}

function compareCommand(flags) {
  const baseline = readJson(requireFlag(flags, 'baseline', 'compare'))
  const candidate = readJson(requireFlag(flags, 'candidate', 'compare'))
  if (!baseline.results || !candidate.results) {
    throw new Error(
      'Both reports need a results array. Re-run "eval-dataset read" for runs read before results were recorded.',
    )
  }
  const result = compareRuns(baseline, candidate, {
    minSlice: flags['min-slice'] ? Number(flags['min-slice']) : undefined,
  })
  console.log(formatCompare(result))
  if (flags.json) {
    writeJson(resolve(flags.json), result)
  }
  if (result.verdict === 'regression') {
    process.exitCode = 1
  }
}

function improveCommand(flags) {
  const reportFile = requireFlag(flags, 'report', 'improve')
  const report = readJson(reportFile)
  const proposals = proposeAll(report.failures ?? [])
  const summary = proposals.reduce(
    (counts, proposal) => {
      counts[proposal.action] = (counts[proposal.action] ?? 0) + 1
      return counts
    },
    { update: 0, skip: 0, judge_miss: 0 },
  )
  const outPath = reportFile.replace(/\.json$/, '.proposals.json')
  writeJson(resolve(outPath), { summary, proposals })
  console.log(
    `Wrote ${outPath} (${summary.update} updates, ${summary.skip} left for review, ${summary.judge_miss} judge misses)`,
  )

  if (flags.apply) {
    const itemsPath = resolve(requireFlag(flags, 'items', 'improve --apply'))
    const items = readJson(itemsPath)
    const applied = applyProposals(items, proposals)
    writeJson(itemsPath, applied.items)
    console.log(`Updated ${applied.applied} rows in ${itemsPath}`)
  }

  return { report, proposals }
}

async function pushProposals(flags, report, proposals) {
  const datasetName = flags.dataset ?? report.datasetName
  if (!datasetName) {
    throw new Error(
      '--push requires --dataset=<name> or a report that names the dataset',
    )
  }
  const client = await langfuseClient(flags)
  const updates = proposals.filter((proposal) => proposal.action === 'update')
  for (const proposal of updates) {
    await client.api.datasetItems.create({
      datasetName,
      id: proposal.datasetItemId,
      expectedOutput: proposal.expectedOutput,
    })
    console.log(`Pushed ${proposal.scenario ?? proposal.datasetItemId}`)
  }
}

const COMMANDS = {
  sample: sampleCommand,
  validate: validateCommand,
  coverage: coverageCommand,
  push: pushCommand,
  read: readCommand,
  compare: compareCommand,
  improve: async (flags) => {
    const result = improveCommand(flags)
    if (flags.push) {
      await pushProposals(flags, result.report, result.proposals)
    }
  },
}

async function main() {
  const { command, flags } = parseArgs(process.argv.slice(2))
  const run = COMMANDS[command]
  if (!run) {
    throw new Error(`Unknown command "${command}". ${USAGE}`)
  }
  await run(flags)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
