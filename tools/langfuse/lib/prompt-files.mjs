import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

// IMPORTANT: packages/backend/src/helpers/ai/get-prompt.ts reads from this folder.
export const PROMPTS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '../prompts',
)

export const DEFAULT_LABEL = 'production'

const PROJECTS = ['aiBuilder', 'pairAction']

const VALUE_FLAGS = ['label', 'project']

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

  const project = flags.project ?? 'aiBuilder'
  if (!PROJECTS.includes(project)) {
    throw new Error(`--project must be one of: ${PROJECTS.join(', ')}`)
  }
  return {
    command,
    name: positionals[0],
    project,
    label: flags.label ?? DEFAULT_LABEL,
    message: flags.message,
    force: flags.force === true,
  }
}

/**
 * Prompt names may contain "/" because Langfuse supports folders.
 */
export function promptPath(project, name, root = PROMPTS_DIR) {
  const projectDir = resolve(root, project)
  const path = resolve(projectDir, `${name}.md`)
  if (!path.startsWith(projectDir + sep)) {
    throw new Error(`Invalid prompt name: ${name}`)
  }
  return path
}

export function listPrompts(root = PROMPTS_DIR) {
  const found = []
  for (const project of PROJECTS) {
    const projectDir = join(root, project)
    if (!existsSync(projectDir)) {
      continue
    }
    for (const entry of readdirSync(projectDir, { recursive: true })) {
      const file = String(entry)
      if (file.endsWith('.md')) {
        const name = file.slice(0, -'.md'.length).split(sep).join('/')
        found.push({ project, name })
      }
    }
  }
  return found.sort((a, b) =>
    `${a.project}/${a.name}`.localeCompare(`${b.project}/${b.name}`),
  )
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
  return git(['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'], root)
}

export function hasUncommittedChanges(path, root = PROMPTS_DIR) {
  return git(['status', '--porcelain', '--', path], root) !== ''
}

export function readAtRef(ref, path, root = PROMPTS_DIR) {
  try {
    // Untrimmed so it compares equal to the file and to Langfuse text.
    return gitRaw(['show', `${ref}:${relative(root, path)}`], root)
  } catch {
    return null
  }
}

export function hasConflictMarkers(text) {
  return /^(<{7}|={7}|>{7})( |$)/m.test(text)
}

/**
 * Keeps every pushed version on top of main. Promoting it then never reverts
 * a change another dev already merged.
 */
export function getPushBlocker({
  text,
  productionText,
  uncommitted,
  containsMain,
  main,
}) {
  if (text === null) {
    return 'The prompt file does not exist.'
  }
  if (uncommitted) {
    return 'The prompt file has uncommitted changes. Commit them in the prompts repo first.'
  }
  if (hasConflictMarkers(text)) {
    return 'The prompt file has merge conflict markers. Resolve them first.'
  }
  if (!containsMain) {
    return `Your branch does not contain ${main}. Merge or rebase onto it first.`
  }
  if (text === productionText) {
    return `The prompt matches "${DEFAULT_LABEL}". There is nothing to push.`
  }
  return null
}

export function readPrompt(path) {
  return existsSync(path) ? readFileSync(path, 'utf-8') : null
}

export function devLabel(email) {
  const user = (email ?? '')
    .split('@')[0]
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!user) {
    throw new Error('Set "git config user.email" so push can name your label.')
  }
  return `dev-${user}`
}

export function gitEmail() {
  try {
    return git(['config', 'user.email'], process.cwd())
  } catch {
    return ''
  }
}
