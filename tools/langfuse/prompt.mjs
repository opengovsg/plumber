/**
 * Syncs AI Builder prompts between the prompts repo and Langfuse.
 * The prompts repo is the source of truth. See PROMPTS.md for the workflow.
 *
 * Credentials come from the dev 1Password environment, so run it through pnpm:
 *   pnpm run prompt import [--label=production] [--project=aiBuilder] [--force]
 *   pnpm run prompt pull <name> [--label=production] [--project=aiBuilder] [--force]
 *   pnpm run prompt status
 *   pnpm run prompt push <name> -m "<commit message>"
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, relative } from 'node:path'

import { buildLangfuseClient } from './lib/client.mjs'
import {
  assertPromptsRepo,
  DEFAULT_LABEL,
  devLabel,
  getPushBlocker,
  git,
  gitEmail,
  hasUncommittedChanges,
  listPrompts,
  mainRef,
  parseArgs,
  promptPath,
  PROMPTS_DIR,
  readAtRef,
  readPrompt,
} from './lib/prompt-files.mjs'

const USAGE = `Usage:
  pnpm run prompt import [--label=${DEFAULT_LABEL}] [--project=aiBuilder] [--force]
  pnpm run prompt pull <name> [--label=${DEFAULT_LABEL}] [--project=aiBuilder] [--force]
  pnpm run prompt status
  pnpm run prompt push <name> -m "<commit message>"`

async function fetchByLabel(client, name, label) {
  // Status and push must see the label's current version, not a cached one.
  const prompt = await client.prompt.get(name, {
    label,
    type: 'text',
    cacheTtlSeconds: 0,
  })
  if (prompt.type !== 'text') {
    throw new Error(
      `"${name}" is a ${prompt.type} prompt. Only text prompts are supported.`,
    )
  }
  return prompt
}

function displayPath(path) {
  return relative(process.cwd(), path)
}

async function pull(args) {
  const { name, project, label, force } = args
  assertPromptsRepo()
  const path = promptPath(project, name)
  if (hasUncommittedChanges(path) && !force) {
    throw new Error(
      `${displayPath(
        path,
      )} has uncommitted changes. Commit or stash them, or use --force to discard them.`,
    )
  }

  const client = buildLangfuseClient(project, process.env)
  const prompt = await fetchByLabel(client, name, label)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, prompt.prompt, 'utf-8')
  console.log(`Saved ${label} v${prompt.version} to ${displayPath(path)}.`)
  console.log('Review it with "git diff", then commit it in the prompts repo.')
}

async function listNamesWithLabel(client, label) {
  const names = []
  for (let page = 1; ; page++) {
    const { data, meta } = await client.api.prompts.list({
      label,
      page,
      limit: 100,
    })
    for (const prompt of data) {
      if (prompt.type === 'text') {
        names.push(prompt.name)
      } else {
        console.warn(`Skipped "${prompt.name}". It is a ${prompt.type} prompt.`)
      }
    }
    if (page >= meta.totalPages) {
      return names
    }
  }
}

/**
 * Copies every prompt that carries the label from Langfuse into the prompts repo.
 */
async function importAll(args) {
  const { project, label, force } = args
  assertPromptsRepo()
  const client = buildLangfuseClient(project, process.env)
  const names = await listNamesWithLabel(client, label)

  // Check every file first so a refusal never leaves a half-finished import.
  const blocked = names
    .map((name) => promptPath(project, name))
    .filter((path) => hasUncommittedChanges(path))
  if (blocked.length > 0 && !force) {
    throw new Error(
      `These files have uncommitted changes. Commit or stash them, or use --force to discard them:\n${blocked
        .map(displayPath)
        .join('\n')}`,
    )
  }

  for (const name of names) {
    const path = promptPath(project, name)
    const prompt = await fetchByLabel(client, name, label)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, prompt.prompt, 'utf-8')
    console.log(`Saved ${label} v${prompt.version} to ${displayPath(path)}.`)
  }
  console.log(
    `Imported ${names.length} ${project} prompt(s). Review them with "git status", then commit them in the prompts repo.`,
  )
}

async function status() {
  assertPromptsRepo()
  git(['fetch', '--quiet', 'origin'])
  const main = mainRef()
  const prompts = listPrompts()
  if (prompts.length === 0) {
    console.log(`No prompts in ${displayPath(PROMPTS_DIR)}.`)
    return
  }
  for (const { project, name } of prompts) {
    const path = promptPath(project, name)
    const client = buildLangfuseClient(project, process.env)
    const production = await fetchByLabel(client, name, DEFAULT_LABEL)
    const local = hasUncommittedChanges(path) ? 'uncommitted changes' : 'clean'
    const sync =
      production.prompt === readAtRef(main, path)
        ? `matches ${main}`
        : `differs from ${main}. Promote the merged version, or commit what ${DEFAULT_LABEL} serves`
    console.log(
      `${project}/${name}: ${local}. ${DEFAULT_LABEL} v${production.version} ${sync}.`,
    )
  }
}

async function push(args) {
  const { name, project, message } = args
  if (!message) {
    throw new Error('Add a commit message with -m "<message>".')
  }
  assertPromptsRepo()
  git(['fetch', '--quiet', 'origin'])
  const path = promptPath(project, name)
  const main = mainRef()
  let containsMain = true
  try {
    git(['merge-base', '--is-ancestor', main, 'HEAD'])
  } catch {
    containsMain = false
  }

  const client = buildLangfuseClient(project, process.env)
  const production = await fetchByLabel(client, name, DEFAULT_LABEL)
  const text = readPrompt(path)
  const blocker = getPushBlocker({
    text,
    productionText: production.prompt,
    uncommitted: hasUncommittedChanges(path),
    containsMain,
    main,
  })
  if (blocker) {
    throw new Error(`${displayPath(path)}: ${blocker}`)
  }

  const commit = git(['rev-parse', '--short', 'HEAD'])
  const label = devLabel(gitEmail())
  const created = await client.prompt.create({
    name,
    type: 'text',
    prompt: text,
    config: production.config,
    tags: production.tags,
    labels: [label],
    commitMessage: `${message} (plumber-prompts ${commit})`,
  })

  console.log(`Created ${name} v${created.version} with label "${label}".`)
  if (project === 'aiBuilder') {
    console.log(
      'The "Latest" variation of the ai-builder LaunchDarkly flag now serves this version.',
    )
  }
  console.log(
    `Merge ${commit} into ${main} through a prompts repo PR. Then promote v${created.version} to "${DEFAULT_LABEL}" in the Langfuse UI.`,
  )
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const needsName = ['pull', 'push'].includes(args.command)
  if (needsName && !args.name) {
    throw new Error(USAGE)
  }
  switch (args.command) {
    case 'import':
      return importAll(args)
    case 'pull':
      return pull(args)
    case 'status':
      return status()
    case 'push':
      return push(args)
    default:
      throw new Error(USAGE)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
