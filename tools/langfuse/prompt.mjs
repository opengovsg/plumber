/**
 * Keeps a local working copy of a Langfuse text prompt for the local backend to read.
 * See PROMPTS.md for the workflow.
 *
 * Credentials come from the dev 1Password environment, so run it through pnpm:
 *   pnpm run prompt pull <name> [--label=production] [--project=aiBuilder] [--force | --merge]
 *   pnpm run prompt status
 *   pnpm run prompt diff <name> [--against=base | --against=<label>]
 *   pnpm run prompt push <name> -m "<commit message>"
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'

import { buildLangfuseClient } from './lib/client.mjs'
import {
  DEFAULT_LABEL,
  devLabel,
  getPullBlocker,
  getPushBlocker,
  gitEmail,
  listLocalPrompts,
  parseArgs,
  promptPaths,
  PROMPTS_DIR,
  readLocalPrompt,
  threeWayMerge,
  writeLocalPrompt,
} from './lib/prompt-files.mjs'

const USAGE = `Usage:
  pnpm run prompt pull <name> [--label=${DEFAULT_LABEL}] [--project=aiBuilder] [--force | --merge]
  pnpm run prompt status
  pnpm run prompt diff <name> [--against=base | --against=<label>]
  pnpm run prompt push <name> -m "<commit message>"`

async function fetchByLabel(client, name, label) {
  // The push check must see the label's current version, not a cached one.
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

function toMeta(prompt, project, label) {
  return {
    name: prompt.name,
    project,
    label,
    baseVersion: prompt.version,
    config: prompt.config,
    tags: prompt.tags,
    pulledAt: new Date().toISOString(),
  }
}

function displayPath(path) {
  return relative(process.cwd(), path)
}

async function pull(args) {
  const { name, project, force, merge } = args
  const paths = promptPaths(project, name)
  const existing = readLocalPrompt(paths)
  const client = buildLangfuseClient(project, process.env)

  if (merge) {
    if (!existing) {
      throw new Error(
        `No local copy of "${name}" to merge. Run pull without --merge.`,
      )
    }
    const label = args.label ?? existing.meta.label
    const theirs = await fetchByLabel(client, name, label)
    if (
      theirs.version === existing.meta.baseVersion &&
      label === existing.meta.label
    ) {
      console.log(
        `Already based on ${label} v${theirs.version}. Nothing to merge.`,
      )
      return
    }
    const { text, conflicts } = threeWayMerge({
      local: existing.local ?? existing.base,
      base: existing.base,
      theirs: theirs.prompt,
      theirsName: `${label} v${theirs.version}`,
    })
    writeLocalPrompt(paths, {
      meta: toMeta(theirs, project, label),
      base: theirs.prompt,
      local: text,
    })
    if (conflicts > 0) {
      console.log(
        `Merged ${label} v${theirs.version} with ${conflicts} conflict(s).`,
      )
      console.log(
        `Resolve the conflict markers in ${displayPath(
          paths.local,
        )} before pushing.`,
      )
    } else {
      console.log(
        `Merged ${label} v${theirs.version} into ${displayPath(
          paths.local,
        )} cleanly.`,
      )
    }
    return
  }

  const blocker = getPullBlocker(paths, existing)
  if (blocker && !force) {
    throw new Error(`${displayPath(paths.local)}: ${blocker}`)
  }

  const label = args.label ?? DEFAULT_LABEL
  const prompt = await fetchByLabel(client, name, label)
  writeLocalPrompt(paths, {
    meta: toMeta(prompt, project, label),
    base: prompt.prompt,
    local: prompt.prompt,
  })
  console.log(
    `Saved ${label} v${prompt.version} to ${displayPath(paths.local)}`,
  )
  console.log(
    'The local backend now reads this file on every AI Builder request.',
  )
}

async function status() {
  const prompts = listLocalPrompts()
  if (prompts.length === 0) {
    console.log(
      `No local prompts in ${displayPath(
        PROMPTS_DIR,
      )}. Run "pnpm run prompt pull <name>".`,
    )
    return
  }
  for (const { project, name } of prompts) {
    const paths = promptPaths(project, name)
    const { meta, base, local } = readLocalPrompt(paths)
    const client = buildLangfuseClient(project, process.env)
    const current = await fetchByLabel(client, name, meta.label)
    const state =
      local === null ? 'missing' : local === base ? 'clean' : 'edited'
    const action =
      current.version !== meta.baseVersion
        ? `run "pnpm run prompt pull ${name} --project=${project} --merge"`
        : state === 'edited'
        ? 'ready to push'
        : 'up to date'
    console.log(
      `${project}/${name}: ${state}, based on ${meta.label} v${meta.baseVersion}, ${meta.label} is now v${current.version}. ${action}.`,
    )
  }
}

async function diff(args) {
  const { name, project, against } = args
  const paths = promptPaths(project, name)
  const existing = readLocalPrompt(paths)
  if (!existing) {
    throw new Error(
      `No local copy of "${name}". Run "pnpm run prompt pull ${name}" first.`,
    )
  }

  const dir = mkdtempSync(join(tmpdir(), 'prompt-diff-'))
  try {
    let otherPath = paths.base
    if (against !== 'base') {
      const client = buildLangfuseClient(project, process.env)
      const other = await fetchByLabel(client, name, against)
      otherPath = join(dir, `${against}-v${other.version}.md`)
      writeFileSync(otherPath, other.prompt)
    }
    spawnSync(
      'git',
      [
        'diff',
        '--no-index',
        '--',
        displayPath(otherPath),
        displayPath(paths.local),
      ],
      {
        stdio: 'inherit',
      },
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

async function push(args) {
  const { name, project, message } = args
  if (!message) {
    throw new Error('Add a commit message with -m "<message>".')
  }
  const paths = promptPaths(project, name)
  const existing = readLocalPrompt(paths)
  if (!existing) {
    throw new Error(
      `No local copy of "${name}". Run "pnpm run prompt pull ${name}" first.`,
    )
  }
  const { meta, base, local } = existing
  const label = devLabel(gitEmail())
  const client = buildLangfuseClient(project, process.env)

  const before = await fetchByLabel(client, name, meta.label)
  const blocker = getPushBlocker({
    local,
    base,
    meta,
    currentVersion: before.version,
  })
  if (blocker) {
    throw new Error(blocker)
  }

  const created = await client.prompt.create({
    name,
    type: 'text',
    prompt: local,
    config: meta.config,
    tags: meta.tags,
    labels: [label],
    commitMessage: message,
  })

  // Langfuse has no conditional create, so another promotion can land between the check and the create.
  const after = await fetchByLabel(client, name, meta.label)
  if (after.version !== meta.baseVersion) {
    console.warn(
      `WARNING: "${meta.label}" moved to v${after.version} while you pushed. v${created.version} may not include it. Run pull --merge and push again.`,
    )
  }

  console.log(`Created ${name} v${created.version} with label "${label}".`)
  if (project === 'aiBuilder') {
    console.log(
      'The "Latest" variation of the ai-builder LaunchDarkly flag now serves this version.',
    )
  }
  console.log(`Promote it to "${DEFAULT_LABEL}" in the Langfuse UI.`)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const needsName = ['pull', 'diff', 'push'].includes(args.command)
  if (needsName && !args.name) {
    throw new Error(USAGE)
  }
  switch (args.command) {
    case 'pull':
      return pull(args)
    case 'status':
      return status()
    case 'diff':
      return diff(args)
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
