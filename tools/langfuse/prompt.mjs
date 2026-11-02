/**
 * Keeps the plumber-prompts repo and Langfuse on the same prompt versions.
 * Each Langfuse version is one file. See PROMPTS.md for the workflow.
 *
 * Credentials come from the dev 1Password environment, so run it through pnpm:
 *   pnpm run prompt sync [--project=aiBuilder]
 *   pnpm run prompt status [--project=aiBuilder]
 *   pnpm run prompt new <name> [--project=aiBuilder]
 *   pnpm run prompt diff <name> [--project=aiBuilder]
 *   pnpm run prompt push <name> -m "<commit message>" [--project=aiBuilder] [--renumber | --resume]
 */
import { spawnSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'

import { buildLangfuseClient } from './lib/client.mjs'
import {
  assertPromptsRepo,
  changedFiles,
  commitAndPush,
  compareVersions,
  fastForwardToMain,
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
  readAtRef,
  readMeta,
  takeNextVersion,
  threeWayMerge,
  versionPaths,
} from './lib/prompt-files.mjs'

const USAGE = `Usage:
  pnpm run prompt sync [--project=aiBuilder]
  pnpm run prompt status [--project=aiBuilder]
  pnpm run prompt new <name> [--project=aiBuilder]
  pnpm run prompt diff <name> [--project=aiBuilder]
  pnpm run prompt push <name> -m "<commit message>" [--project=aiBuilder] [--renumber | --resume]`

const FETCH_CONCURRENCY = 5

const RECONCILE_HELP =
  'Need help reconciling? Ask your AI assistant. The langfuse-prompts skill covers it.'

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

async function langfuseLatestVersion(client, name) {
  const prompt = (await listLangfusePrompts(client, name)).find(
    (candidate) => candidate.name === name,
  )
  return Math.max(0, ...(prompt?.versions ?? []))
}

async function mapWithConcurrency(items, fn) {
  const queue = [...items]
  const results = []
  const workers = Array.from({ length: FETCH_CONCURRENCY }, async () => {
    while (queue.length > 0) {
      const item = queue.shift()
      results.push(await fn(item))
    }
  })
  await Promise.all(workers)
  return results
}

function fetchMain() {
  git(['fetch', '--quiet', 'origin'])
  return mainRef()
}

/**
 * Merges the version that landed first into a renumbered draft.
 * Returns a message for the dev.
 */
function reconcileDraft({ dir, draftVersion, theirsVersion }) {
  const paths = versionPaths(dir, draftVersion)
  const meta = existsSync(paths.meta) ? readMeta(paths.meta) : {}
  const basePath = versionPaths(dir, meta.basedOn).content
  if (meta.basedOn === undefined || !existsSync(basePath)) {
    return `Your draft does not record which version it came from. Run "pnpm run prompt diff" and fold v${theirsVersion}'s changes in by hand.`
  }
  const { text, conflicts } = threeWayMerge({
    ours: readFileSync(paths.content, 'utf-8'),
    base: readFileSync(basePath, 'utf-8'),
    theirs: readFileSync(versionPaths(dir, theirsVersion).content, 'utf-8'),
    labels: ['your draft', `v${meta.basedOn}`, `v${theirsVersion}`],
  })
  writeFileSync(paths.content, text, 'utf-8')
  writeFileSync(
    paths.meta,
    formatMeta({ ...meta, basedOn: theirsVersion }),
    'utf-8',
  )
  return conflicts > 0
    ? `Merged v${theirsVersion} into your draft with ${conflicts} conflict(s). Resolve the <<<<<<< markers in ${displayPath(
        paths.content,
      )}, test, then push again.`
    : `Merged v${theirsVersion} into your draft cleanly. Test it again, then push.`
}

/**
 * Writes, commits and pushes every Langfuse version that main is missing.
 */
async function sync(args) {
  assertPromptsRepo()
  const main = fetchMain()
  fastForwardToMain(
    main,
    'Local files clash with versions on main. Move them out of the prompt folder, then retry.',
  )
  const projects = args.project ? [args.project] : PROJECTS
  const written = []
  const notes = []
  for (const project of projects) {
    const client = buildLangfuseClient(project, process.env)
    const prompts = await listLangfusePrompts(client)
    // Compares against committed files, because a local draft can share a number with a UI version.
    const missing = prompts.flatMap((prompt) => {
      const dir = promptDir(project, prompt.name)
      return compareVersions(
        listVersionsAtRef('HEAD', dir),
        prompt.versions,
      ).missingInRepo.map((version) => ({ prompt, dir, version }))
    })
    const fetched = await mapWithConcurrency(missing, async (item) => ({
      ...item,
      remote: await client.api.prompts.get(item.prompt.name, {
        version: item.version,
      }),
    }))

    // Runs one at a time so each moved draft gets its own free number.
    const taken = new Map()
    const moved = []
    for (const { prompt, dir, remote } of fetched) {
      if (!taken.has(dir)) {
        taken.set(
          dir,
          new Set([
            ...prompt.versions,
            ...listVersions(dir).map((v) => v.version),
          ]),
        )
      }
      const paths = versionPaths(dir, remote.version, remote.type)
      const content = formatContent(remote)
      if (
        existsSync(paths.content) &&
        readFileSync(paths.content, 'utf-8') !== content
      ) {
        const next = takeNextVersion(taken.get(dir))
        const to = versionPaths(dir, next, remote.type)
        if (existsSync(to.content) || existsSync(to.meta)) {
          throw new Error(
            `${displayPath(to.content)} already exists. Move it out of the folder, then retry.`,
          )
        }
        renameSync(paths.content, to.content)
        if (existsSync(paths.meta)) {
          renameSync(paths.meta, to.meta)
        }
        moved.push({
          prompt,
          dir,
          type: remote.type,
          from: remote.version,
          to: next,
        })
      }
      mkdirSync(dir, { recursive: true })
      writeFileSync(paths.content, content, 'utf-8')
      writeFileSync(paths.meta, formatMeta(remote), 'utf-8')
      written.push(paths.content, paths.meta)
    }
    for (const { prompt, dir, type, from, to } of moved) {
      const theirs = Math.max(...prompt.versions)
      const result =
        type === 'text'
          ? reconcileDraft({ dir, draftVersion: to, theirsVersion: theirs })
          : `Fold v${theirs}'s changes into it by hand.`
      notes.push(
        `${project}/${prompt.name}: Langfuse already has v${from}, so your local file moved to v${to}. ${result}`,
      )
    }
    console.log(`${project}: wrote ${missing.length} missing version(s).`)
  }
  if (written.length > 0) {
    const versionCount = written.length / 2
    try {
      commitAndPush({
        main,
        paths: written,
        message: `Sync ${versionCount} version(s) from Langfuse`,
      })
    } catch (error) {
      // The files come from Langfuse, so a rerun can rewrite them on top of the new main.
      for (const path of written) {
        rmSync(path, { force: true })
      }
      throw error
    }
    console.log(`Committed and pushed ${versionCount} version(s) to ${main}.`)
  }
  if (notes.length > 0) {
    console.warn([...notes, RECONCILE_HELP].join('\n'))
  }
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
          } --project=${project} --resume" once per version`,
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
  fastForwardToMain(
    fetchMain(),
    'Local files clash with versions on main. Move them out of the prompt folder, then retry.',
  )
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
    formatMeta({
      config: readMeta(from.meta).config,
      basedOn: latest.version,
    }),
    'utf-8',
  )
  console.log(`Created ${displayPath(to.content)} from v${latest.version}.`)
  console.log('The local backend now serves this draft. Edit it, then test.')
}

/**
 * Diffs the newest local file against Langfuse's newest version. This also
 * shows versions someone created in the Langfuse UI.
 */
async function diff(args) {
  const { name } = args
  const project = args.project ?? 'aiBuilder'
  const dir = promptDir(project, name)
  const local = listVersions(dir).at(-1)
  if (!local) {
    throw new Error(`No versions of "${name}" in ${displayPath(dir)}.`)
  }
  const client = buildLangfuseClient(project, process.env)
  const langfuseVersion = await langfuseLatestVersion(client, name)
  if (langfuseVersion === 0) {
    throw new Error(`"${name}" does not exist in Langfuse.`)
  }
  const remote = await client.api.prompts.get(name, {
    version: langfuseVersion,
  })
  const tmp = mkdtempSync(join(tmpdir(), 'prompt-diff-'))
  try {
    const remotePath = join(tmp, `langfuse-v${langfuseVersion}`)
    writeFileSync(remotePath, formatContent(remote))
    const localPath = versionPaths(dir, local.version, local.type).content
    console.log(
      `Comparing Langfuse v${langfuseVersion} with your v${local.version}.`,
    )
    const result = spawnSync(
      'git',
      ['diff', '--no-index', '--', remotePath, displayPath(localPath)],
      { stdio: 'inherit' },
    )
    if (result.status === 0) {
      console.log('No differences.')
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

/**
 * Creates the Langfuse version from main, never the working tree, so both
 * sides hold the same text.
 */
async function createLangfuseVersion({ client, main, name, dir, version }) {
  const paths = versionPaths(dir, version)
  const content = readAtRef(main, paths.content)
  const meta = JSON.parse(readAtRef(main, paths.meta))
  // Narrows the race with a concurrent --resume. Langfuse has no conditional create.
  const latest = await langfuseLatestVersion(client, name)
  if (latest !== version - 1) {
    throw new Error(
      `Langfuse is now at v${latest}, not v${version - 1}. Someone else finished this push. Run "pnpm run prompt status".`,
    )
  }
  let created
  try {
    created = await client.prompt.create({
      name,
      type: 'text',
      prompt: content,
      config: meta.config ?? {},
      commitMessage: meta.commitMessage,
    })
  } catch (error) {
    throw new Error(
      `v${version} is on main, but Langfuse did not create it. Run "pnpm run prompt push ${name} --resume" to finish. ${error.message}`,
    )
  }
  if (created.version !== version) {
    throw new Error(
      `Langfuse created v${created.version}, but the repo holds it as v${version}. Someone created a version outside this tool. Run "pnpm run prompt status".`,
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
  const { name, message, renumber, resume } = args
  const project = args.project ?? 'aiBuilder'
  assertPromptsRepo()
  const main = fetchMain()
  const dir = promptDir(project, name)
  const client = buildLangfuseClient(project, process.env)
  const langfuseLatest = await langfuseLatestVersion(client, name)
  const mainLatest = Math.max(0, ...listVersionsAtRef(main, dir))

  const latest = listVersions(dir).at(-1)
  const latestPath =
    latest && versionPaths(dir, latest.version, latest.type).content
  const draft =
    latest &&
    !gitSucceeds([
      'cat-file',
      '-e',
      `HEAD:${relative(PROMPTS_DIR, latestPath)}`,
    ])
      ? latest
      : null
  const draftPaths = draft && versionPaths(dir, draft.version)
  const changedPushedFiles = changedFiles(dir)
    .filter((path) => path !== draftPaths?.content && path !== draftPaths?.meta)
    .map(displayPath)

  if (resume) {
    if (changedPushedFiles.length > 0) {
      throw new Error(
        `Pushed versions are read-only. Revert your changes to: ${changedPushedFiles.join(
          ', ',
        )}`,
      )
    }
    if (mainLatest !== langfuseLatest + 1) {
      throw new Error(
        `Nothing to resume. main is at v${mainLatest} and Langfuse is at v${langfuseLatest}.`,
      )
    }
    return createLangfuseVersion({
      client,
      main,
      name,
      dir,
      version: mainLatest,
    })
  }

  // Stops after renumbering so the dev re-tests the merged draft.
  if (draft && renumber && draft.version !== mainLatest + 1) {
    const to = versionPaths(dir, mainLatest + 1)
    if (existsSync(to.content) || existsSync(to.meta)) {
      throw new Error(
        `${displayPath(to.content)} already exists. Move it out of the folder, then retry.`,
      )
    }
    renameSync(draftPaths.content, to.content)
    if (existsSync(draftPaths.meta)) {
      renameSync(draftPaths.meta, to.meta)
    }
    fastForwardToMain(main, 'Move clashing files out of the prompt folder.')
    throw new Error(
      [
        `Renumbered your draft from v${draft.version} to v${mainLatest + 1}.`,
        reconcileDraft({
          dir,
          draftVersion: mainLatest + 1,
          theirsVersion: mainLatest,
        }),
        RECONCILE_HELP,
      ].join(' '),
    )
  }

  fastForwardToMain(
    main,
    draft
      ? `main may already hold v${draft.version}. Retry with --renumber.`
      : 'Move clashing files out of the prompt folder.',
  )
  const blocker = getPushBlocker({
    draft,
    draftText: draft ? readFileSync(draftPaths.content, 'utf-8') : '',
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
  git(['fetch', '--quiet', 'origin'])

  await createLangfuseVersion({
    client,
    main,
    name,
    dir,
    version: draft.version,
  })
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
