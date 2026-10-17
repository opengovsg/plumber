/**
 * Maintains the AI Builder gold dataset and reads Langfuse experiment runs.
 *
 *   cd tools/langfuse
 *   pnpm run eval-dataset pull     --dataset=<langfuse dataset> [--items=<path>] [--include-archived] [--force]
 *   node eval-dataset.mjs init     --dataset=<langfuse dataset> [--stubs]
 *   node eval-dataset.mjs inspect  --dataset=<langfuse dataset>
 *   pnpm run eval-dataset sample   --tags=ai-builder --from=<iso> [--to=<iso>] [--limit=100] [--environment=production]
 *   node eval-dataset.mjs adopt    --dataset=<name> --candidates=out/candidates/<date>.json --trace=<trace id> --scenario=<name>
 *   pnpm run eval-dataset validate --items=datasets/<name>/items.json
 *   pnpm run eval-dataset coverage --items=datasets/<name>/items.json
 *   pnpm run eval-dataset push     --items=datasets/<name>/items.json --dataset=<langfuse dataset> [--archive-missing]
 *   pnpm run eval-dataset read     --dataset=<langfuse dataset> [--run=<run name>] [--score=tool_intent_correctness]
 *   pnpm run eval-dataset compare  --baseline=out/<dataset>/<run-a>.json --candidate=out/<dataset>/<run-b>.json
 *   pnpm run eval-dataset improve  --report=out/<dataset>/<run>.json [--items=<path>] [--apply] [--push --dataset=<name>]
 *   node eval-dataset.mjs calibrate --report=out/<dataset>/<run>.json --dataset=<name> [--labels=<path>] [--min=0.9] [--write-template]
 *
 * --items defaults to datasets/<dataset>/items.json when --dataset is given.
 * datasets/ is a local working copy and is ignored by git. Langfuse holds the dataset.
 * notes/<dataset>/ holds CHANGELOG.md and judge-labels.json. Also ignored by git.
 * sample, push, read and improve --push need 1Password env injection, same as get-prompt.
 * validate, coverage, compare and improve run offline.
 *
 * The improver never drops must_not_tools. A forbidden tool call stays a failure.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { adoptCandidate, findCandidate } from './lib/adopt.mjs'
import {
  calibrate,
  formatCalibration,
  labelTemplate,
} from './lib/calibrate.mjs'
import { compareRuns, formatCompare } from './lib/compare.mjs'
import { coverageReport, formatCoverage } from './lib/coverage.mjs'
import {
  changelogPath,
  changelogTemplate,
  datasetDir,
  fromLangfuseItem,
  itemsPath,
  labelsPath,
  notesDir,
  stubItems,
} from './lib/dataset-files.mjs'
import { formatInspection, inspectItems } from './lib/inspect.mjs'
import { applyProposals, proposeAll } from './lib/improve.mjs'
import { readEvalRun } from './lib/read-run.mjs'
import { sampleTraces } from './lib/sample.mjs'
import {
  expectedOutputOf,
  itemId,
  pruneUnknownTools,
  validateItems,
} from './lib/schema.mjs'
import { knownTools } from './lib/tools.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

const USAGE =
  'Usage: pnpm run eval-dataset <pull|init|inspect|sample|adopt|validate|coverage|push|read|compare|improve|calibrate> [--flag=value ...]. See the header of eval-dataset.mjs.'

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

function today() {
  return new Date().toISOString().slice(0, 10)
}

function itemsFlag(flags, command) {
  if (flags.items) {
    return flags.items
  }
  if (flags.dataset) {
    return itemsPath(flags.dataset)
  }
  throw new Error(`${command} requires --items=<path> or --dataset=<name>`)
}

function loadItems(flags, command, options = {}) {
  const path = itemsFlag(flags, command)
  const items = readJson(path)
  const tools = knownTools()
  if (!tools) {
    console.warn('Backend tool list not found. Tool names are not checked.')
  }
  const errors = validateItems(items, { knownTools: tools })
  const drafts =
    Array.isArray(items) && !options.allowDrafts
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

async function pullCommand(flags) {
  const datasetName = requireFlag(flags, 'dataset', 'pull')
  const path = resolve(itemsFlag(flags, 'pull'))
  if (existsSync(path) && !flags.force) {
    throw new Error(
      `${path} exists. Pass --force to overwrite it with the Langfuse copy.`,
    )
  }
  const client = await langfuseClient(flags)
  const items = []
  let page = 1
  let totalPages = 1
  do {
    const response = await client.api.datasetItems.list({
      datasetName,
      page,
      limit: 100,
    })
    items.push(...response.data)
    totalPages = response.meta?.totalPages ?? 1
    page += 1
  } while (page <= totalPages)

  const kept = items.filter(
    (item) => flags['include-archived'] || item.status === 'ACTIVE',
  )
  const converted = kept
    .map(fromLangfuseItem)
    .sort((a, b) => a.metadata.scenario.localeCompare(b.metadata.scenario))
  writeJson(path, converted)
  ensureChangelog(datasetName)
  console.log(
    `Wrote ${converted.length} items to ${path} (${
      items.length - kept.length
    } archived skipped).`,
  )
  const errors = validateItems(converted, { knownTools: knownTools() })
  if (errors.length > 0) {
    console.log(`${errors.length} items need attention before the next push:`)
    printErrors(errors)
  }
}

function ensureChangelog(datasetName) {
  const path = changelogPath(datasetName)
  if (existsSync(path)) {
    return
  }
  mkdirSync(notesDir(datasetName), { recursive: true })
  writeFileSync(path, changelogTemplate(datasetName, today()))
  console.log(`Created ${path}.`)
}

function inspectCommand(flags) {
  const path = itemsFlag(flags, 'inspect')
  const items = readJson(path)
  if (!Array.isArray(items)) {
    throw new Error(`${path} must contain a JSON array`)
  }
  console.log(formatInspection(inspectItems(items)))
}

function initCommand(flags) {
  const datasetName = requireFlag(flags, 'dataset', 'init')
  const dir = datasetDir(datasetName)
  const path = itemsPath(datasetName)
  if (existsSync(path)) {
    throw new Error(`${path} exists. Use pull --force or edit it directly.`)
  }
  mkdirSync(dir, { recursive: true })
  const tools = knownTools()
  const items = flags.stubs ? stubItems(tools ?? [], today()) : []
  writeJson(path, items)
  ensureChangelog(datasetName)
  console.log(`Created ${path} with ${items.length} items.`)
  if (flags.stubs) {
    console.log(
      'Every stub is a draft. Fill in the input, decide the expected output, then remove metadata.status.',
    )
  }
  console.log(
    `Create the dataset "${datasetName}" in Langfuse before the first push.`,
  )
}

function labelsFlag(flags) {
  if (typeof flags.labels === 'string') {
    return resolve(flags.labels)
  }
  if (flags.dataset) {
    return labelsPath(flags.dataset)
  }
  throw new Error('calibrate requires --labels=<path> or --dataset=<name>')
}

function calibrateCommand(flags) {
  const report = readJson(requireFlag(flags, 'report', 'calibrate'))
  if (flags['write-template']) {
    const path =
      typeof flags['write-template'] === 'string'
        ? resolve(flags['write-template'])
        : labelsFlag(flags)
    if (existsSync(path) && !flags.force) {
      throw new Error(`${path} exists. Pass --force to overwrite the labels.`)
    }
    const rows = labelTemplate(report, {
      perClass: flags['per-class'] ? Number(flags['per-class']) : undefined,
    })
    writeJson(path, rows)
    console.log(
      `Wrote ${rows.length} rows to ${path}. Set "human" to "pass" or "fail" on each.`,
    )
    return
  }
  const labels = readJson(labelsFlag(flags))
  const result = calibrate(report, labels, {
    min: flags.min ? Number(flags.min) : undefined,
  })
  console.log(formatCalibration(result))
  if (!result.ok) {
    process.exitCode = 1
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
  const path = join(__dirname, 'out', 'candidates', `${today()}.json`)
  writeJson(path, result)
  console.log(
    `Wrote ${path} (${result.candidates.length} candidates from ${result.tracesSeen} traces, ${result.redactions} values redacted)`,
  )
  console.log('Observed strata:')
  for (const [key, count] of Object.entries(result.strata)) {
    console.log(`  ${key}: ${count}`)
  }
}

function adoptCommand(flags) {
  const candidatesPath = requireFlag(flags, 'candidates', 'adopt')
  const traceId = requireFlag(flags, 'trace', 'adopt')
  const scenario = requireFlag(flags, 'scenario', 'adopt')
  const target = resolve(itemsFlag(flags, 'adopt'))
  const { candidates = [] } = readJson(candidatesPath)
  const candidate = findCandidate(candidates, traceId)
  if (!candidate) {
    throw new Error(
      `No candidate with source_trace_id ${traceId} in ${candidatesPath}`,
    )
  }
  const items = existsSync(target) ? readJson(target) : []
  if (items.some((item) => itemId(item) === scenario)) {
    throw new Error(`${target} already has an item "${scenario}"`)
  }
  if (items.some((item) => item.metadata?.source_trace_id === traceId)) {
    throw new Error(`${target} already has an item from trace ${traceId}`)
  }
  items.push(adoptCandidate(candidate, { scenario, today: today() }))
  writeJson(target, items)
  console.log(
    `Added draft "${scenario}" to ${target}. Decide expected_output, add covers, then remove metadata.status.`,
  )
}

function validateCommand(flags) {
  if (flags.fix) {
    const itemsFile = resolve(itemsFlag(flags, 'validate'))
    const tools = knownTools()
    if (!tools) {
      throw new Error(
        '--fix needs the backend tool list. Run from a full checkout.',
      )
    }
    const { items: fixed, removed } = pruneUnknownTools(
      readJson(itemsFile),
      tools,
    )
    if (removed.length > 0) {
      writeJson(itemsFile, fixed)
    }
    for (const entry of removed) {
      console.log(
        `Removed "${entry.tool}" from must_not_tools of ${entry.id}. The agent has no such tool.`,
      )
    }
    console.log(`${removed.length} forbidden tool entries removed.`)
  }
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
  const { items, tools, errors } = loadItems(flags, 'coverage', {
    allowDrafts: true,
  })
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
    const target = resolve(
      itemsFlag(
        { ...flags, dataset: flags.dataset ?? report.datasetName },
        'improve --apply',
      ),
    )
    const items = readJson(target)
    const applied = applyProposals(items, proposals)
    writeJson(target, applied.items)
    console.log(`Updated ${applied.applied} rows in ${target}`)
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
  pull: pullCommand,
  init: initCommand,
  inspect: inspectCommand,
  calibrate: calibrateCommand,
  sample: sampleCommand,
  adopt: adoptCommand,
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
