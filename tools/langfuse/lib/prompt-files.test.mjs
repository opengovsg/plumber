import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  assertPromptsRepo,
  devLabel,
  getPushBlocker,
  hasConflictMarkers,
  hasUncommittedChanges,
  listPrompts,
  mainRef,
  parseArgs,
  promptPath,
  readAtRef,
} from './prompt-files.mjs'

function run(cwd, ...args) {
  execFileSync(
    'git',
    ['-c', 'user.email=dev@example.com', '-c', 'user.name=Dev', ...args],
    { cwd, stdio: 'ignore' },
  )
}

/**
 * Creates a bare origin with one commit on main and a clone of it.
 */
function withPromptsRepo(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'prompts-'))
  try {
    const origin = join(dir, 'origin.git')
    const seed = join(dir, 'seed')
    const clone = join(dir, 'clone')
    run(dir, 'init', '--bare', '--initial-branch=main', origin)
    run(dir, 'clone', origin, seed)
    mkdirSync(join(seed, 'aiBuilder'))
    writeFileSync(join(seed, 'aiBuilder/chat.md'), 'main text\n')
    run(seed, 'add', '.')
    run(seed, 'commit', '-m', 'seed')
    run(seed, 'push', 'origin', 'HEAD:main')
    run(dir, 'clone', origin, clone)
    fn(clone)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test('parses flags, -m and the prompt name', () => {
  const args = parseArgs([
    'push',
    'chat',
    '-m',
    'Tighten tone',
    '--project=pairAction',
  ])
  assert.equal(args.command, 'push')
  assert.equal(args.name, 'chat')
  assert.equal(args.message, 'Tighten tone')
  assert.equal(args.project, 'pairAction')
  assert.equal(args.label, 'production')
})

test('defaults to the aiBuilder project and rejects unknown ones', () => {
  assert.equal(parseArgs(['pull', 'chat']).project, 'aiBuilder')
  assert.throws(() => parseArgs(['pull', 'chat', '--project=other']))
})

test('accepts value flags with = or a space and rejects missing values', () => {
  const spaced = parseArgs(['pull', 'chat', '--label', 'staging'])
  assert.equal(spaced.name, 'chat')
  assert.equal(spaced.label, 'staging')
  assert.equal(parseArgs(['pull', 'chat', '--label=latest']).label, 'latest')
  assert.throws(() => parseArgs(['pull', 'chat', '--label']), /--label/)
  assert.throws(() => parseArgs(['pull', 'chat', '--label=']), /--label/)
  assert.throws(() => parseArgs(['pull', 'chat', '--label', '--force']))
})

test('keeps Langfuse folders in the path and rejects escapes', () => {
  assert.equal(
    promptPath('aiBuilder', 'folder/chat', '/root'),
    '/root/aiBuilder/folder/chat.md',
  )
  assert.throws(() => promptPath('aiBuilder', '../../etc/passwd', '/root'))
})

test('lists prompts by project and name', () => {
  withPromptsRepo((repo) => {
    mkdirSync(join(repo, 'pairAction/folder'), { recursive: true })
    writeFileSync(join(repo, 'pairAction/folder/action.md'), 'text')
    writeFileSync(join(repo, 'README.md'), 'not a prompt')
    assert.deepEqual(listPrompts(repo), [
      { project: 'aiBuilder', name: 'chat' },
      { project: 'pairAction', name: 'folder/action' },
    ])
  })
})

test('accepts only the root of a prompts clone', () => {
  withPromptsRepo((repo) => {
    assert.doesNotThrow(() => assertPromptsRepo(repo))
    assert.throws(() => assertPromptsRepo(join(repo, 'aiBuilder')), /clone/)
  })
  const plain = mkdtempSync(join(tmpdir(), 'plain-'))
  try {
    assert.throws(() => assertPromptsRepo(plain), /prompts:clone/)
    assert.throws(() => assertPromptsRepo(join(plain, 'missing')))
  } finally {
    rmSync(plain, { recursive: true, force: true })
  }
})

test('detects modified and untracked prompt files', () => {
  withPromptsRepo((repo) => {
    const chat = join(repo, 'aiBuilder/chat.md')
    const summary = join(repo, 'aiBuilder/chat-summary.md')
    assert.equal(hasUncommittedChanges(chat, repo), false)
    assert.equal(hasUncommittedChanges(summary, repo), false)
    writeFileSync(chat, 'edited\n')
    writeFileSync(summary, 'handwritten\n')
    assert.equal(hasUncommittedChanges(chat, repo), true)
    assert.equal(hasUncommittedChanges(summary, repo), true)
  })
})

test('reads a file at main with its trailing newline', () => {
  withPromptsRepo((repo) => {
    const main = mainRef(repo)
    assert.equal(main, 'origin/main')
    const chat = join(repo, 'aiBuilder/chat.md')
    assert.equal(readAtRef(main, chat, repo), 'main text\n')
    assert.equal(readAtRef(main, join(repo, 'aiBuilder/x.md'), repo), null)
  })
})

test('detects conflict markers only at line start', () => {
  assert.equal(hasConflictMarkers('a\n<<<<<<< local\nb'), true)
  assert.equal(hasConflictMarkers('a <<<<<<< b'), false)
})

const pushable = {
  text: 'new',
  productionText: 'old',
  uncommitted: false,
  containsMain: true,
  main: 'origin/main',
}

test('allows a committed change on top of main', () => {
  assert.equal(getPushBlocker(pushable), null)
})

test('blocks a push that could revert or lose a change', () => {
  assert.match(getPushBlocker({ ...pushable, text: null }), /does not exist/)
  assert.match(getPushBlocker({ ...pushable, uncommitted: true }), /Commit/)
  assert.match(
    getPushBlocker({ ...pushable, text: '<<<<<<< HEAD\nnew' }),
    /conflict/,
  )
  assert.match(
    getPushBlocker({ ...pushable, containsMain: false }),
    /origin\/main/,
  )
  assert.match(
    getPushBlocker({ ...pushable, productionText: 'new' }),
    /nothing to push/,
  )
})

test('derives the dev label from the git email', () => {
  assert.equal(devLabel('Kevin.Kim@open.gov.sg'), 'dev-kevin-kim')
  assert.throws(() => devLabel(''))
})
