/**
 * Read a Langfuse dataset run and propose gold edits for the failures.
 *
 * An agent should run this when a developer asks to improve the AI Builder
 * eval set from the latest experiment.
 *
 *   cd tools/langfuse
 *   pnpm run eval-dataset read --dataset <langfuse dataset name> [--run <run name>] [--score tool_intent_correctness]
 *   pnpm run eval-dataset improve --report out/<dataset>/<run>.json [--items path/to/items.json] [--apply] [--push --dataset <name>]
 *
 * read needs 1Password env injection, same as get-prompt.
 * improve only needs credentials when --push is set.
 *
 * The improver never drops must_not_tools. A forbidden tool call stays a failure.
 * Proposals are written next to the report. --apply updates a local items.json.
 * --push upserts those expected outputs in Langfuse. Edit build_dataset.py
 * yourself when that file is the source of the items. The next generate
 * overwrites items.json.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildLangfuseClient } from './lib/client.mjs'
import { applyProposals, proposeAll } from './lib/improve.mjs'
import { readEvalRun } from './lib/read-run.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

function parseArgs(argv) {
  const [command, ...rest] = argv
  if (!command || command.startsWith('--')) {
    throw new Error(
      'Usage: pnpm run eval-dataset <read|improve> [--dataset=<name>] [--run=<name>] [--score=<name>] [--report=<path>] [--items=<path>] [--apply] [--push] [--project=aiBuilder|pairAction]',
    )
  }
  const flags = { apply: false, push: false }
  for (const arg of rest) {
    if (arg === '--apply') {
      flags.apply = true
      continue
    }
    if (arg === '--push') {
      flags.push = true
      continue
    }
    const match = /^--([^=]+)=(.*)$/.exec(arg)
    if (match) {
      flags[match[1]] = match[2]
    }
  }
  return { command, flags }
}

function reportPath(datasetName, runName) {
  const safe = (value) => value.replace(/[^a-zA-Z0-9._-]+/g, '_')
  return join(__dirname, 'out', safe(datasetName), `${safe(runName)}.json`)
}

async function readCommand(flags) {
  if (!flags.dataset) {
    throw new Error('read requires --dataset=<langfuse dataset name>')
  }
  const client = buildLangfuseClient(flags.project ?? 'aiBuilder', process.env)
  const report = await readEvalRun(client, {
    datasetName: flags.dataset,
    runName: flags.run,
    scoreName: flags.score ?? 'tool_intent_correctness',
  })
  const path = reportPath(report.datasetName, report.runName)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(report, null, 2))
  console.log(
    `Wrote ${path} (${report.counts.passed} true, ${report.counts.failed} false, ${report.counts.unscored} unscored)`,
  )
}

function improveCommand(flags) {
  if (!flags.report) {
    throw new Error('improve requires --report=<path>')
  }
  const report = JSON.parse(readFileSync(resolve(flags.report), 'utf8'))
  const proposals = proposeAll(report.failures ?? [])
  const summary = proposals.reduce(
    (counts, proposal) => {
      counts[proposal.action] = (counts[proposal.action] ?? 0) + 1
      return counts
    },
    { update: 0, skip: 0, judge_miss: 0 },
  )
  const outPath = flags.report.replace(/\.json$/, '.proposals.json')
  writeFileSync(
    resolve(outPath),
    JSON.stringify({ summary, proposals }, null, 2),
  )
  console.log(
    `Wrote ${outPath} (${summary.update} updates, ${summary.skip} left for review, ${summary.judge_miss} judge misses)`,
  )

  if (flags.apply) {
    if (!flags.items) {
      throw new Error('--apply requires --items=<items.json>')
    }
    const itemsPath = resolve(flags.items)
    const items = JSON.parse(readFileSync(itemsPath, 'utf8'))
    const applied = applyProposals(items, proposals)
    writeFileSync(itemsPath, JSON.stringify(applied.items, null, 2) + '\n')
    console.log(`Updated ${applied.applied} rows in ${itemsPath}`)
  }

  return { report, proposals }
}

async function pushProposals(flags, report, proposals) {
  const datasetName = flags.dataset ?? report.datasetName
  if (!datasetName) {
    throw new Error('--push requires --dataset=<name> or a report that names the dataset')
  }
  const client = buildLangfuseClient(flags.project ?? 'aiBuilder', process.env)
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

async function main() {
  const { command, flags } = parseArgs(process.argv.slice(2))
  if (command === 'read') {
    await readCommand(flags)
    return
  }
  if (command === 'improve') {
    const result = improveCommand(flags)
    if (flags.push) {
      await pushProposals(flags, result.report, result.proposals)
    }
    return
  }
  throw new Error(`Unknown command "${command}". Use read or improve.`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
