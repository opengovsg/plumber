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
  isVersionFile,
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

const CLASH_HINT =
  'A local draft has the same number as a version on main (listed below). Run push with --renumber for that prompt, then retry.'

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
function reconcileDraft({ dir, draftVersion, theirsVersion, readVersion }) {
  const paths = versionPaths(dir, draftVersion)
  const meta = existsSync(paths.meta) ? readMeta(paths.meta) : {}
  let base = null
  try {
    base = meta.basedOn === undefined ? null : readVersion(meta.basedOn)
  } catch {
    // A missing base version gets the same manual fallback.
  }
  if (base === null) {
    return `Your draft does not record which version it came from. Run "pnpm run prompt diff" and fold v${theirsVersion}'s changes in by hand.`
  }
  const { text, conflicts } = threeWayMerge({
    ours: readFileSync(paths.content, 'utf-8'),
    base,
    theirs: readVersion(theirsVersion),
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
 * Returns the newest version that both main and Langfuse hold.
 */
function newestSharedVersion(mainVersions, langfuseVersions) {
  const langfuse = new Set(langfuseVersions)
  return Math.max(0, ...mainVersions.filter((v) => langfuse.has(v)))
}

/**
 * Writes, commits and pushes every Langfuse version that main is missing.
 * Also repairs main's newest version when Langfuse holds different text under
 * the same number, which happens when a UI version takes a half-pushed number.
 */
async function sync(args) {
  assertPromptsRepo()
  const main = fetchMain()
  fastForwardToMain(main, CLASH_HINT)
  const projects = args.project ? [args.project] : PROJECTS
  const written = []
  const created = []
  let moves = 0
  for (const project of projects) {
    const client = buildLangfuseClient(project, process.env)
    const prompts = await listLangfusePrompts(client)
    const work = prompts.flatMap((prompt) => {
      const dir = promptDir(project, prompt.name)
      // Compares against committed files, because a local draft can share a number with a UI version.
      const mainVersions = listVersionsAtRef('HEAD', dir)
      const shared = newestSharedVersion(mainVersions, prompt.versions)
      return [
        ...compareVersions(mainVersions, prompt.versions).missingInRepo.map(
          (version) => ({ prompt, dir, version, kind: 'missing' }),
        ),
        ...(shared > 0
          ? [{ prompt, dir, version: shared, kind: 'check' }]
          : []),
      ]
    })
    const fetched = await mapWithConcurrency(work, async (item) => ({
      ...item,
      remote: await client.api.prompts.get(item.prompt.name, {
        version: item.version,
      }),
    }))

    // Runs one at a time so each moved draft gets its own free number.
    const taken = new Map()
    const moved = []
    const reserve = (prompt, dir) => {
      if (!taken.has(dir)) {
        taken.set(
          dir,
          new Set([
            ...prompt.versions,
            ...listVersions(dir).map((v) => v.version),
          ]),
        )
      }
      const next = takeNextVersion(taken.get(dir))
      const text = versionPaths(dir, next, 'text')
      const chat = versionPaths(dir, next, 'chat')
      if ([text.content, chat.content, text.meta].some(existsSync)) {
        throw new Error(
          `${displayPath(text.content)} already exists. Move it out of the folder, then retry.`,
        )
      }
      return next
    }
    for (const { prompt, dir, kind, remote } of fetched) {
      const paths = versionPaths(dir, remote.version, remote.type)
      const content = formatContent(remote)
      if (kind === 'check') {
        const mainText = readAtRef('HEAD', paths.content)
        if (mainText === content) {
          continue
        }
        const next = reserve(prompt, dir)
        const to = versionPaths(dir, next, remote.type)
        const mainMeta = JSON.parse(readAtRef('HEAD', paths.meta))
        writeFileSync(to.content, mainText, 'utf-8')
        writeFileSync(
          to.meta,
          formatMeta({ config: mainMeta.config, basedOn: remote.version - 1 }),
          'utf-8',
        )
        created.push(to.content, to.meta)
        moved.push({
          prompt,
          dir,
          type: remote.type,
          to: next,
          note: `main's v${remote.version} did not match Langfuse's v${remote.version}. main now holds Langfuse's text, and main's old text is your draft v${next}.`,
        })
      } else if (
        existsSync(paths.content) &&
        readFileSync(paths.content, 'utf-8') !== content
      ) {
        const next = reserve(prompt, dir)
        const to = versionPaths(dir, next, remote.type)
        renameSync(paths.content, to.content)
        if (existsSync(paths.meta)) {
          renameSync(paths.meta, to.meta)
        }
        moved.push({
          prompt,
          dir,
          type: remote.type,
          to: next,
          note: `Langfuse already has v${remote.version}, so your local file moved to v${next}.`,
        })
      }
      mkdirSync(dir, { recursive: true })
      writeFileSync(paths.content, content, 'utf-8')
      writeFileSync(paths.meta, formatMeta(remote), 'utf-8')
      written.push(paths.content, paths.meta)
    }
    // Prints each move now, so a later failure cannot hide it from the dev.
    for (const { prompt, dir, type, to, note } of moved) {
      const theirs = Math.max(...prompt.versions)
      const result =
        type === 'text'
          ? reconcileDraft({
              dir,
              draftVersion: to,
              theirsVersion: theirs,
              readVersion: (v) =>
                readFileSync(versionPaths(dir, v).content, 'utf-8'),
            })
          : `Fold v${theirs}'s changes into it by hand.`
      console.warn(`${project}/${prompt.name}: ${note} ${result}`)
      moves++
    }
  }
  if (moves > 0) {
    console.warn(RECONCILE_HELP)
  }
  const versionCount = written.length / 2
  if (versionCount === 0) {
    console.log('Every version in Langfuse is already on main.')
    return
  }
  try {
    commitAndPush({
      main,
      paths: written,
      message: `Sync ${versionCount} version(s) from Langfuse`,
    })
  } catch (error) {
    // Everything sync wrote comes from Langfuse or main, so a rerun recreates it.
    for (const path of written) {
      if (
        gitSucceeds(['cat-file', '-e', `HEAD:${relative(PROMPTS_DIR, path)}`])
      ) {
        git(['checkout', '--quiet', 'HEAD', '--', path])
      } else {
        rmSync(path, { force: true })
      }
    }
    for (const path of created) {
      rmSync(path, { force: true })
    }
    throw error
  }
  console.log(`Committed and pushed ${versionCount} version(s) to ${main}.`)
}

async function sameText({ client, main, dir, prompt, version }) {
  const remote = await client.api.prompts.get(prompt.name, { version })
  const path = versionPaths(dir, version, remote.type).content
  return readAtRef(main, path) === formatContent(remote)
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
      const mainVersions = listVersionsAtRef(main, dir)
      const { missingInRepo, missingInLangfuse } = compareVersions(
        mainVersions,
        prompt.versions,
      )
      const problems = []
      const shared = newestSharedVersion(mainVersions, prompt.versions)
      if (
        shared > 0 &&
        !(await sameText({ client, main, dir, prompt, version: shared }))
      ) {
        problems.push(
          `v${shared} on ${main} differs from Langfuse's v${shared}. Run "pnpm run prompt sync" to repair it`,
        )
      }
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
  fastForwardToMain(fetchMain(), CLASH_HINT)
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
async function createLangfuseVersion({
  client,
  main,
  project,
  name,
  dir,
  version,
}) {
  const paths = versionPaths(dir, version)
  const content = readAtRef(main, paths.content)
  const meta = JSON.parse(readAtRef(main, paths.meta))
  const statusCommand = `pnpm run prompt status --project=${project}`
  // Narrows the race with a concurrent --resume. Langfuse has no conditional create.
  const latest = await langfuseLatestVersion(client, name)
  if (latest !== version - 1) {
    throw new Error(
      `Langfuse is at v${latest}, not v${
        version - 1
      }, so v${version} was not created. Run "${statusCommand}".`,
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
      `v${version} is on main, but Langfuse did not create it. Run "pnpm run prompt push ${name} --project=${project} --resume" to finish. ${error.message}`,
    )
  }
  if (created.version !== version) {
    throw new Error(
      `Langfuse created v${created.version}, but the repo holds it as v${version}. Someone created a version outside this tool. Run "${statusCommand}".`,
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
  const mainVersions = listVersionsAtRef(main, dir)
  const mainLatest = Math.max(0, ...mainVersions)
  const readFromMain = (v) => readAtRef(main, versionPaths(dir, v).content)

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
  const draftPaths = draft && versionPaths(dir, draft.version, draft.type)
  const draftMeta =
    draft && existsSync(draftPaths.meta) ? readMeta(draftPaths.meta) : {}
  const changedPushedFiles = changedFiles(dir)
    .filter(isVersionFile)
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
    const next = langfuseLatest + 1
    if (mainVersions.includes(next)) {
      return createLangfuseVersion({
        client,
        main,
        project,
        name,
        dir,
        version: next,
      })
    }
    const shared = newestSharedVersion(mainVersions, [langfuseLatest])
    const prompt = { name }
    if (
      shared > 0 &&
      !(await sameText({ client, main, dir, prompt, version: shared }))
    ) {
      throw new Error(
        `v${shared} on ${main} differs from Langfuse's v${shared}. Someone created a version in the Langfuse UI. Run "pnpm run prompt sync --project=${project}" to repair it.`,
      )
    }
    throw new Error(
      `Nothing to resume. main is at v${mainLatest} and Langfuse is at v${langfuseLatest}.`,
    )
  }

  // Merges without fast-forwarding first, because a clashing draft blocks the fast-forward.
  if (renumber) {
    if (!draft || draft.type !== 'text') {
      throw new Error('There is no text draft to renumber.')
    }
    const target = mainLatest + 1
    if (draft.version === target && draftMeta.basedOn === mainLatest) {
      throw new Error(
        `Your draft is already v${target} and includes v${mainLatest}. Push without --renumber.`,
      )
    }
    const notes = []
    if (draft.version !== target) {
      const to = versionPaths(dir, target)
      if (existsSync(to.content) || existsSync(to.meta)) {
        throw new Error(
          `${displayPath(to.content)} already exists. Move it out of the folder, then retry.`,
        )
      }
      renameSync(draftPaths.content, to.content)
      if (existsSync(draftPaths.meta)) {
        renameSync(draftPaths.meta, to.meta)
      }
      notes.push(`Renumbered your draft from v${draft.version} to v${target}.`)
    }
    notes.push(
      reconcileDraft({
        dir,
        draftVersion: target,
        theirsVersion: mainLatest,
        readVersion: readFromMain,
      }),
      RECONCILE_HELP,
    )
    throw new Error(notes.join(' '))
  }

  fastForwardToMain(main, CLASH_HINT)
  const blocker = getPushBlocker({
    draft,
    draftText:
      draft?.type === 'text' ? readFileSync(draftPaths.content, 'utf-8') : '',
    basedOn: draftMeta.basedOn,
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
  const previousMeta = versionPaths(dir, draft.version - 1).meta
  const config = existsSync(draftPaths.meta)
    ? draftMeta.config
    : existsSync(previousMeta)
      ? readMeta(previousMeta).config
      : {}
  const originalMeta = existsSync(draftPaths.meta)
    ? readFileSync(draftPaths.meta, 'utf-8')
    : null
  writeFileSync(
    draftPaths.meta,
    formatMeta({ config, commitMessage: message }),
    'utf-8',
  )
  try {
    commitAndPush({
      main,
      paths: [draftPaths.content, draftPaths.meta],
      message: `${project}/${name} v${draft.version}: ${message}`,
    })
  } catch (error) {
    // Keeps basedOn, so the --renumber that follows a lost race can merge.
    if (originalMeta === null) {
      rmSync(draftPaths.meta, { force: true })
    } else {
      writeFileSync(draftPaths.meta, originalMeta, 'utf-8')
    }
    throw error
  }
  git(['fetch', '--quiet', 'origin'])

  await createLangfuseVersion({
    client,
    main,
    project,
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
