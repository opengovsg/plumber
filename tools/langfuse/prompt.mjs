/**
 * Keeps the plumber-prompts repo and Langfuse on the same prompt versions.
 * Each Langfuse version is one file. See PROMPTS.md for the workflow.
 *
 * Credentials come from the dev 1Password environment, so run it through pnpm:
 *   pnpm run prompt sync [--project=aiBuilder]
 *   pnpm run prompt status [--project=aiBuilder]
 *   pnpm run prompt new <name> [--project=aiBuilder]
 *   pnpm run prompt diff <name> [--project=aiBuilder]
 *   pnpm run prompt push <name> -m "<commit message>" [--project=aiBuilder] [--renumber]
 */
import { spawnSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { relative } from 'node:path'

import { buildLangfuseClient } from './lib/client.mjs'
import {
  assertPromptsRepo,
  changedFiles,
  compareVersions,
  formatContent,
  formatMeta,
  getPushBlocker,
  git,
  gitSucceeds,
  listPrompts,
  listVersions,
  listVersionsAtRef,
  mainRef,
  parseArgs,
  PROJECTS,
  promptDir,
  PROMPTS_DIR,
  readMeta,
  versionPaths,
} from './lib/prompt-files.mjs'

const USAGE = `Usage:
  pnpm run prompt sync [--project=aiBuilder]
  pnpm run prompt status [--project=aiBuilder]
  pnpm run prompt new <name> [--project=aiBuilder]
  pnpm run prompt diff <name> [--project=aiBuilder]
  pnpm run prompt push <name> -m "<commit message>" [--project=aiBuilder] [--renumber]`

const FETCH_CONCURRENCY = 5

function displayPath(path) {
  return relative(process.cwd(), path)
}

async function listLangfusePrompts(client, name) {
  const prompts = []
  for (let page = 1; ; page++) {
    const { data, meta } = await client.api.prompts.list({
      name,
      page,
      limit: 100,
    })
    prompts.push(...data)
    if (page >= meta.totalPages) {
      return prompts
    }
  }
}

async function mapWithConcurrency(items, fn) {
  const queue = [...items]
  const workers = Array.from({ length: FETCH_CONCURRENCY }, async () => {
    while (queue.length > 0) {
      await fn(queue.shift())
    }
  })
  await Promise.all(workers)
}

function fetchMain() {
  git(['fetch', '--quiet', 'origin'])
  return mainRef()
}

function fastForwardToMain(main) {
  if (git(['rev-list', '--count', `${main}..HEAD`]) !== '0') {
    throw new Error(
      `Your clone has commits that are not on ${main}. Push or drop those commits first.`,
    )
  }
  if (!gitSucceeds(['merge', '--ff-only', '--quiet', main])) {
    throw new Error(
      `Could not fast-forward to ${main}. It may already hold your draft's version number. Retry with --renumber.`,
    )
  }
}

/**
 * Pushes only the given files, so a dev's other uncommitted work stays local.
 */
function commitAndPush({ main, paths, message }) {
  const branch = main.replace(/^origin\//, '')
  git(['add', '--', ...paths])
  git(['commit', '--quiet', '-m', message, '--', ...paths])
  if (
    !gitSucceeds(['push', '--quiet', 'origin', `HEAD:refs/heads/${branch}`])
  ) {
    git(['reset', '--soft', 'HEAD~1'])
    throw new Error(
      `Someone pushed to ${main} first. Nothing was created in Langfuse. Run the command again.`,
    )
  }
}

/**
 * Writes every Langfuse version that the repo is missing. Never overwrites a file.
 */
async function sync(args) {
  assertPromptsRepo()
  const main = fetchMain()
  fastForwardToMain(main)
  const projects = args.project ? [args.project] : PROJECTS
  const written = []
  for (const project of projects) {
    const client = buildLangfuseClient(project, process.env)
    const prompts = await listLangfusePrompts(client)
    // Compares against committed files, because a local draft can share a number with a UI version.
    const missing = prompts.flatMap((prompt) => {
      const dir = promptDir(project, prompt.name)
      const nextFree = Math.max(...prompt.versions) + 1
      return compareVersions(
        listVersionsAtRef('HEAD', dir),
        prompt.versions,
      ).missingInRepo.map((version) => ({
        name: prompt.name,
        dir,
        version,
        nextFree,
      }))
    })
    await mapWithConcurrency(
      missing,
      async ({ name, dir, version, nextFree }) => {
        const prompt = await client.api.prompts.get(name, { version })
        const paths = versionPaths(dir, version, prompt.type)
        const content = formatContent(prompt)
        if (
          existsSync(paths.content) &&
          readFileSync(paths.content, 'utf-8') !== content
        ) {
          const moved = versionPaths(dir, nextFree, prompt.type)
          renameSync(paths.content, moved.content)
          if (existsSync(paths.meta)) {
            renameSync(paths.meta, moved.meta)
          }
          console.warn(
            `${project}/${name}: Langfuse already has v${version}, so your draft moved to v${nextFree}. Fold v${version}'s changes into it before you push.`,
          )
        }
        mkdirSync(dir, { recursive: true })
        writeFileSync(paths.content, content, 'utf-8')
        writeFileSync(paths.meta, formatMeta(prompt), 'utf-8')
        written.push(paths.content, paths.meta)
      },
    )
    console.log(`${project}: wrote ${missing.length} missing version(s).`)
  }
  if (written.length === 0) {
    return
  }
  const versionCount = written.length / 2
  try {
    commitAndPush({
      main,
      paths: written,
      message: `Sync ${versionCount} version(s) from Langfuse`,
    })
  } catch (error) {
    // The files come from Langfuse, so a rerun can rewrite them on top of the new main.
    git(['reset', '--quiet', '--', ...written])
    for (const path of written) {
      rmSync(path, { force: true })
    }
    throw error
  }
  console.log(`Committed and pushed ${versionCount} version(s) to ${main}.`)
}

async function status(args) {
  assertPromptsRepo()
  const main = fetchMain()
  const projects = args.project ? [args.project] : PROJECTS
  let outOfSync = 0
  for (const project of projects) {
    const client = buildLangfuseClient(project, process.env)
    const prompts = await listLangfusePrompts(client)
    const names = new Set(prompts.map((prompt) => prompt.name))
    for (const prompt of prompts) {
      const dir = promptDir(project, prompt.name)
      const { missingInRepo, missingInLangfuse } = compareVersions(
        listVersionsAtRef(main, dir),
        prompt.versions,
      )
      const problems = []
      if (missingInRepo.length > 0) {
        problems.push(
          `missing on ${main}: v${missingInRepo.join(
            ', v',
          )}. Run "pnpm run prompt sync"`,
        )
      }
      if (missingInLangfuse.length > 0) {
        problems.push(
          `missing in Langfuse: v${missingInLangfuse.join(
            ', v',
          )}. Run "pnpm run prompt push ${
            prompt.name
          } --project=${project}" to finish the push`,
        )
      }
      if (problems.length > 0) {
        outOfSync++
        console.log(`${project}/${prompt.name}: ${problems.join('. ')}.`)
      }
    }
    for (const { name } of listPrompts(PROMPTS_DIR, [project])) {
      if (!names.has(name)) {
        outOfSync++
        console.log(
          `${project}/${name}: exists in the repo but not in Langfuse.`,
        )
      }
    }
  }
  console.log(
    outOfSync === 0
      ? 'Every prompt is in sync.'
      : `${outOfSync} prompt(s) out of sync.`,
  )
}

function newDraft(args) {
  const { name } = args
  const project = args.project ?? 'aiBuilder'
  assertPromptsRepo()
  const main = fetchMain()
  if (!gitSucceeds(['merge-base', '--is-ancestor', main, 'HEAD'])) {
    throw new Error(
      `Your clone is behind ${main}. Run "pnpm run prompts:clone" first.`,
    )
  }
  const dir = promptDir(project, name)
  const latest = listVersions(dir).at(-1)
  if (!latest) {
    throw new Error(
      `No versions of "${name}" in ${displayPath(
        dir,
      )}. Run "pnpm run prompt sync" first.`,
    )
  }
  if (latest.type !== 'text') {
    throw new Error('Only text prompts can have drafts.')
  }
  const from = versionPaths(dir, latest.version)
  if (changedFiles(from.content).length > 0) {
    throw new Error(
      `${displayPath(from.content)} is already a draft. Edit it instead.`,
    )
  }

  const to = versionPaths(dir, latest.version + 1)
  copyFileSync(from.content, to.content)
  writeFileSync(
    to.meta,
    formatMeta({ config: readMeta(from.meta).config }),
    'utf-8',
  )
  console.log(`Created ${displayPath(to.content)} from v${latest.version}.`)
  console.log('The local backend now serves this draft. Edit it, then test.')
}

function diff(args) {
  const { name } = args
  const project = args.project ?? 'aiBuilder'
  const dir = promptDir(project, name)
  const versions = listVersions(dir)
  if (versions.length < 2) {
    throw new Error(`"${name}" has fewer than two versions to compare.`)
  }
  const [previous, latest] = versions.slice(-2)
  spawnSync(
    'git',
    [
      'diff',
      '--no-index',
      '--',
      displayPath(versionPaths(dir, previous.version, previous.type).content),
      displayPath(versionPaths(dir, latest.version, latest.type).content),
    ],
    { stdio: 'inherit' },
  )
}

async function createLangfuseVersion({ client, name, dir, version }) {
  const paths = versionPaths(dir, version)
  const meta = readMeta(paths.meta)
  let created
  try {
    created = await client.prompt.create({
      name,
      type: 'text',
      prompt: readFileSync(paths.content, 'utf-8'),
      config: meta.config ?? {},
      commitMessage: meta.commitMessage,
    })
  } catch (error) {
    throw new Error(
      `v${version} is on main, but Langfuse did not create it. Run "pnpm run prompt push ${name}" again to finish. ${error.message}`,
    )
  }
  if (created.version !== version) {
    throw new Error(
      `Langfuse created v${created.version}, but the repo holds it as v${version}. Someone created a version outside this tool. Rename the v${version} files to v${created.version}, then commit and push them.`,
    )
  }
  console.log(`Created ${name} v${version} in Langfuse and on main.`)
  console.log(
    'Promote it in the Langfuse UI or the ai-builder LaunchDarkly flag.',
  )
}

/**
 * Pushes to git before Langfuse. Git rejects a stale push, so a concurrent
 * push stops before it creates a Langfuse version.
 */
async function push(args) {
  const { name, message, renumber } = args
  const project = args.project ?? 'aiBuilder'
  assertPromptsRepo()
  const main = fetchMain()
  if (git(['rev-list', '--count', `${main}..HEAD`]) !== '0') {
    throw new Error(
      `Your clone has commits that are not on ${main}. push publishes only the draft. Push or drop those commits first.`,
    )
  }

  const dir = promptDir(project, name)
  const client = buildLangfuseClient(project, process.env)
  const langfuse = (await listLangfusePrompts(client, name)).find(
    (prompt) => prompt.name === name,
  )
  const langfuseLatest = Math.max(0, ...(langfuse?.versions ?? []))
  const mainLatest = Math.max(0, ...listVersionsAtRef(main, dir))

  const latest = listVersions(dir).at(-1)
  const draft =
    latest &&
    !gitSucceeds([
      'cat-file',
      '-e',
      `HEAD:${relative(
        PROMPTS_DIR,
        versionPaths(dir, latest.version, latest.type).content,
      )}`,
    ])
      ? latest
      : null

  // Stops after renumbering so the dev folds in the versions that landed first.
  if (draft && renumber && draft.version !== mainLatest + 1) {
    const from = versionPaths(dir, draft.version)
    const to = versionPaths(dir, mainLatest + 1)
    renameSync(from.content, to.content)
    if (existsSync(from.meta)) {
      renameSync(from.meta, to.meta)
    }
    if (!gitSucceeds(['merge', '--ff-only', '--quiet', main])) {
      throw new Error(
        `Renumbered your draft, but could not fast-forward to ${main}.`,
      )
    }
    const landed =
      draft.version === mainLatest
        ? `v${mainLatest}`
        : `v${draft.version} to v${mainLatest}`
    throw new Error(
      `Renumbered your draft from v${draft.version} to v${
        mainLatest + 1
      }. ${landed} landed first, and your draft does not include it. Run "pnpm run prompt diff ${name}", fold those changes into v${
        mainLatest + 1
      }, test, then push again.`,
    )
  }

  fastForwardToMain(main)

  // An earlier push reached git but not Langfuse.
  if (!draft && mainLatest === langfuseLatest + 1) {
    return createLangfuseVersion({ client, name, dir, version: mainLatest })
  }

  const draftPaths = draft ? versionPaths(dir, draft.version) : null
  const changedPushedFiles = changedFiles(dir)
    .filter((path) => path !== draftPaths?.content && path !== draftPaths?.meta)
    .map(displayPath)
  const blocker = getPushBlocker({
    draft,
    langfuseLatest,
    mainLatest,
    changedPushedFiles,
  })
  if (blocker) {
    throw new Error(blocker)
  }
  if (!message) {
    throw new Error('Add a commit message with -m "<message>".')
  }

  // A draft made by hand has no meta file, so it inherits the previous config.
  const meta = readMeta(
    existsSync(draftPaths.meta)
      ? draftPaths.meta
      : versionPaths(dir, draft.version - 1).meta,
  )
  writeFileSync(
    draftPaths.meta,
    formatMeta({ config: meta.config, commitMessage: message }),
    'utf-8',
  )
  commitAndPush({
    main,
    paths: [draftPaths.content, draftPaths.meta],
    message: `${project}/${name} v${draft.version}: ${message}`,
  })

  await createLangfuseVersion({ client, name, dir, version: draft.version })
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const needsName = ['new', 'diff', 'push'].includes(args.command)
  if (needsName && !args.name) {
    throw new Error(USAGE)
  }
  switch (args.command) {
    case 'sync':
      return sync(args)
    case 'status':
      return status(args)
    case 'new':
      return newDraft(args)
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
