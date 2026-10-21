import { execFileSync, spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

// IMPORTANT: packages/backend/src/helpers/ai/get-prompt.ts reads from this folder.
export const PROMPTS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '../prompts',
)

export const DEFAULT_LABEL = 'production'

const PROJECTS = ['aiBuilder', 'pairAction']

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
    if (match) {
      flags[match[1]] = match[2] ?? true
    } else {
      positionals.push(arg)
    }
  }

  const project = flags.project ?? 'aiBuilder'
  if (!PROJECTS.includes(project)) {
    throw new Error(`--project must be one of: ${PROJECTS.join(', ')}`)
  }
  return {
    command,
    name: positionals[0],
    project,
    label: typeof flags.label === 'string' ? flags.label : undefined,
    message: flags.message,
    force: flags.force === true,
    merge: flags.merge === true,
    against: flags.against ?? 'base',
  }
}

/**
 * Prompt names may contain "/" because Langfuse supports folders.
 */
export function promptPaths(project, name, root = PROMPTS_DIR) {
  const projectDir = resolve(root, project)
  const local = resolve(projectDir, `${name}.md`)
  if (!local.startsWith(projectDir + sep)) {
    throw new Error(`Invalid prompt name: ${name}`)
  }
  const stem = local.slice(0, -'.md'.length)
  if (stem.endsWith('.base')) {
    throw new Error(
      `Invalid prompt name: ${name}. The .base suffix is reserved.`,
    )
  }
  return { local, base: `${stem}.base.md`, meta: `${stem}.meta.json` }
}

export function getPullBlocker(paths, existing) {
  if (!existing && existsSync(paths.local)) {
    return 'The local prompt has no metadata. Back it up, then use --force to discard it.'
  }
  if (existing && existing.local !== null && existing.local !== existing.base) {
    return 'The local prompt has edits. Use --merge to keep them, or --force to discard them.'
  }
  return null
}

export function readLocalPrompt(paths) {
  if (!existsSync(paths.meta)) {
    return null
  }
  return {
    meta: JSON.parse(readFileSync(paths.meta, 'utf-8')),
    base: readFileSync(paths.base, 'utf-8'),
    local: existsSync(paths.local) ? readFileSync(paths.local, 'utf-8') : null,
  }
}

export function writeLocalPrompt(paths, { meta, base, local }) {
  mkdirSync(dirname(paths.local), { recursive: true })
  writeFileSync(paths.base, base, 'utf-8')
  writeFileSync(paths.local, local, 'utf-8')
  writeFileSync(paths.meta, `${JSON.stringify(meta, null, 2)}\n`, 'utf-8')
}

export function listLocalPrompts(root = PROMPTS_DIR) {
  const found = []
  for (const project of PROJECTS) {
    const projectDir = join(root, project)
    if (!existsSync(projectDir)) {
      continue
    }
    for (const entry of readdirSync(projectDir, { recursive: true })) {
      const file = String(entry)
      if (file.endsWith('.meta.json')) {
        const name = relative(projectDir, join(projectDir, file))
          .slice(0, -'.meta.json'.length)
          .split(sep)
          .join('/')
        found.push({ project, name })
      }
    }
  }
  return found
}

export function hasConflictMarkers(text) {
  return /^(<{7}|={7}|>{7})( |$)/m.test(text)
}

/**
 * Keeps every pushed version on top of what the base label currently serves,
 * so promoting it never reverts another dev's promoted change.
 */
export function getPushBlocker({ local, base, meta, currentVersion }) {
  if (local === null) {
    return 'The local prompt file is missing. Pull it again.'
  }
  if (hasConflictMarkers(local)) {
    return 'The local prompt has merge conflict markers. Resolve them first.'
  }
  if (local === base) {
    return 'The local prompt has no changes to push.'
  }
  if (currentVersion !== meta.baseVersion) {
    return `"${meta.label}" moved from v${meta.baseVersion} to v${currentVersion} since you pulled. Run "pnpm run prompt pull ${meta.name} --project=${meta.project} --merge" first.`
  }
  return null
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
    return execFileSync('git', ['config', 'user.email'], {
      encoding: 'utf-8',
    }).trim()
  } catch {
    return ''
  }
}

export function threeWayMerge({ local, base, theirs, theirsName }) {
  const dir = mkdtempSync(join(tmpdir(), 'prompt-merge-'))
  try {
    const files = {
      local: join(dir, 'local'),
      base: join(dir, 'base'),
      theirs: join(dir, 'theirs'),
    }
    writeFileSync(files.local, local)
    writeFileSync(files.base, base)
    writeFileSync(files.theirs, theirs)
    const result = spawnSync(
      'git',
      [
        'merge-file',
        '-p',
        '-L',
        'local',
        '-L',
        'base',
        '-L',
        theirsName,
        files.local,
        files.base,
        files.theirs,
      ],
      { encoding: 'utf-8' },
    )
    // git merge-file exits with the conflict count (max 127). A negative code on error wraps above 127.
    if (result.error || result.status === null || result.status > 127) {
      throw new Error(`git merge-file failed: ${result.stderr || result.error}`)
    }
    return { text: result.stdout, conflicts: result.status }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}
