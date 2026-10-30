import { execFileSync } from 'node:child_process'
import {
  existsSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
} from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

// IMPORTANT: packages/backend/src/helpers/ai/get-prompt.ts reads from this folder.
export const PROMPTS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '../prompts',
)

export const PROJECTS = ['aiBuilder', 'pairAction']

const VALUE_FLAGS = ['project']

// IMPORTANT: get-prompt.ts matches the same pattern to find the newest version.
const VERSION_FILE = /^v(\d+)\.(md|json)$/

export function parseArgs(argv) {
  const [command, ...rest] = argv
  const positionals = []
  const flags = {}
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i]
    if (arg === '-m') {
      flags.message = rest[++i]
      continue
    }
    const match = /^--([^=]+)(?:=(.*))?$/.exec(arg)
    if (!match) {
      positionals.push(arg)
      continue
    }
    const [, key, value] = match
    if (!VALUE_FLAGS.includes(key)) {
      flags[key] = value ?? true
      continue
    }
    let flagValue = value
    const next = rest[i + 1]
    if (flagValue === undefined && next && !next.startsWith('-')) {
      flagValue = next
      i++
    }
    if (!flagValue) {
      throw new Error(`--${key} requires a value: --${key}=<value>`)
    }
    flags[key] = flagValue
  }

  if (flags.project && !PROJECTS.includes(flags.project)) {
    throw new Error(`--project must be one of: ${PROJECTS.join(', ')}`)
  }
  return {
    command,
    name: positionals[0],
    // Commands on one prompt default to aiBuilder. Repo-wide commands cover every project.
    project: flags.project,
    message: flags.message,
    renumber: flags.renumber === true,
  }
}

/**
 * Prompt names may contain "/" because Langfuse supports folders.
 */
export function promptDir(project, name, root = PROMPTS_DIR) {
  const projectDir = resolve(root, project)
  const dir = resolve(projectDir, name)
  if (!dir.startsWith(projectDir + sep)) {
    throw new Error(`Invalid prompt name: ${name}`)
  }
  return dir
}

export function versionPaths(dir, version, type = 'text') {
  return {
    content: join(dir, `v${version}.${type === 'chat' ? 'json' : 'md'}`),
    meta: join(dir, `v${version}.meta.json`),
  }
}

/**
 * Returns the versions stored in a prompt folder, oldest first.
 */
export function listVersions(dir) {
  if (!existsSync(dir)) {
    return []
  }
  return readdirSync(dir)
    .map((file) => VERSION_FILE.exec(file))
    .filter(Boolean)
    .map((match) => ({
      version: Number(match[1]),
      type: match[2] === 'json' ? 'chat' : 'text',
    }))
    .sort((a, b) => a.version - b.version)
}

export function listPrompts(root = PROMPTS_DIR, projects = PROJECTS) {
  const found = []
  for (const project of projects) {
    const projectDir = join(root, project)
    if (!existsSync(projectDir)) {
      continue
    }
    const dirs = readdirSync(projectDir, { recursive: true })
      .map((entry) => join(projectDir, String(entry)))
      .filter((path) => statSync(path).isDirectory())
    for (const dir of dirs) {
      if (listVersions(dir).length > 0) {
        const name = relative(projectDir, dir).split(sep).join('/')
        found.push({ project, name })
      }
    }
  }
  return found.sort((a, b) =>
    `${a.project}/${a.name}`.localeCompare(`${b.project}/${b.name}`),
  )
}

export function formatContent(prompt) {
  return prompt.type === 'chat'
    ? `${JSON.stringify(prompt.prompt, null, 2)}\n`
    : prompt.prompt
}

export function formatMeta(prompt) {
  return `${JSON.stringify(
    { config: prompt.config ?? {}, commitMessage: prompt.commitMessage ?? '' },
    null,
    2,
  )}\n`
}

export function readMeta(path) {
  const meta = JSON.parse(readFileSync(path, 'utf-8'))
  if (typeof meta !== 'object' || meta === null || Array.isArray(meta)) {
    throw new Error(`${path} must hold a JSON object.`)
  }
  return meta
}

/**
 * Lists the version numbers that exist on only one side.
 */
export function compareVersions(repoVersions, langfuseVersions) {
  const repo = new Set(repoVersions)
  const langfuse = new Set(langfuseVersions)
  return {
    missingInRepo: [...langfuse]
      .filter((v) => !repo.has(v))
      .sort((a, b) => a - b),
    missingInLangfuse: [...repo]
      .filter((v) => !langfuse.has(v))
      .sort((a, b) => a - b),
  }
}

/**
 * Keeps the repo and Langfuse on the same version numbers. A draft must be
 * the next number after both the newest Langfuse version and the newest
 * version on main.
 */
export function getPushBlocker({
  draft,
  langfuseLatest,
  mainLatest,
  changedPushedFiles,
}) {
  if (!draft) {
    return 'There is no draft. Run "pnpm run prompt new <name>" first.'
  }
  if (draft.type !== 'text') {
    return 'Only text prompts can be pushed.'
  }
  if (mainLatest < langfuseLatest) {
    return `Langfuse has v${langfuseLatest} but main stops at v${mainLatest}. Run "pnpm run prompt sync", commit and push the files, then retry.`
  }
  if (mainLatest > langfuseLatest) {
    return `main has v${mainLatest} but Langfuse stops at v${langfuseLatest}. Move your draft out of the folder, then run push again to finish the earlier push.`
  }
  if (changedPushedFiles.length > 0) {
    return `Pushed versions are read-only. Revert your changes to: ${changedPushedFiles.join(
      ', ',
    )}`
  }
  if (draft.version !== mainLatest + 1) {
    return `v${draft.version} is not the next version. main is at v${mainLatest}. Retry with --renumber.`
  }
  return null
}

function gitRaw(args, cwd) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

export function git(args, cwd = PROMPTS_DIR) {
  return gitRaw(args, cwd).trim()
}

export function gitSucceeds(args, cwd = PROMPTS_DIR) {
  try {
    gitRaw(args, cwd)
    return true
  } catch {
    return false
  }
}

export function assertPromptsRepo(root = PROMPTS_DIR) {
  let isRepoRoot = false
  try {
    isRepoRoot =
      git(['rev-parse', '--show-toplevel'], root) === realpathSync(root)
  } catch {
    // A missing folder or a non-repo folder gets the same fix.
  }
  if (!isRepoRoot) {
    throw new Error(
      `${root} is not a clone of the prompts repo. Run "pnpm run prompts:clone".`,
    )
  }
}

export function mainRef(root = PROMPTS_DIR) {
  const args = ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']
  try {
    return git(args, root)
  } catch {
    // A clone of an empty repo never learns origin's default branch.
  }
  try {
    git(['remote', 'set-head', 'origin', '--auto'], root)
    return git(args, root)
  } catch {
    throw new Error(
      'The prompts repo has no default branch yet. Push its first commit, then retry.',
    )
  }
}

/**
 * Returns paths with uncommitted changes, including untracked files.
 */
export function changedFiles(path, root = PROMPTS_DIR) {
  const output = gitRaw(
    ['status', '--porcelain', '--untracked-files=all', '-z', '--', path],
    root,
  )
  return output
    .split('\0')
    .filter(Boolean)
    .map((entry) => resolve(root, entry.slice(3)))
}

/**
 * Lists the versions of one prompt folder on a git ref.
 */
export function listVersionsAtRef(ref, dir, root = PROMPTS_DIR) {
  let output
  try {
    output = git(
      ['ls-tree', '--name-only', `${ref}:${relative(root, dir)}`],
      root,
    )
  } catch {
    return []
  }
  return output
    .split('\n')
    .map((file) => VERSION_FILE.exec(file))
    .filter(Boolean)
    .map((match) => Number(match[1]))
    .sort((a, b) => a - b)
}
