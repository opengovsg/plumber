import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  assertPromptsRepo,
  changedFiles,
  compareVersions,
  formatContent,
  formatMeta,
  getPushBlocker,
  listPrompts,
  listVersions,
  listVersionsAtRef,
  mainRef,
  parseArgs,
  promptDir,
  versionPaths,
} from './prompt-files.mjs'

function run(cwd, ...args) {
  execFileSync(
    'git',
    ['-c', 'user.email=dev@example.com', '-c', 'user.name=Dev', ...args],
    { cwd, stdio: 'ignore' },
  )
}

/**
 * Creates a bare origin with chat v1 and v2 on main, and a clone of it.
 */
function withPromptsRepo(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'prompts-'))
  try {
    const origin = join(dir, 'origin.git')
    const seed = join(dir, 'seed')
    const clone = join(dir, 'clone')
    run(dir, 'init', '--bare', '--initial-branch=main', origin)
    run(dir, 'clone', origin, seed)
    mkdirSync(join(seed, 'aiBuilder/chat'), { recursive: true })
    for (const version of [1, 2]) {
      writeFileSync(
        join(seed, `aiBuilder/chat/v${version}.md`),
        `v${version}\n`,
      )
      writeFileSync(join(seed, `aiBuilder/chat/v${version}.meta.json`), '{}\n')
    }
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
    '--project',
    'pairAction',
    '--renumber',
  ])
  assert.equal(args.command, 'push')
  assert.equal(args.name, 'chat')
  assert.equal(args.message, 'Tighten tone')
  assert.equal(args.project, 'pairAction')
  assert.equal(args.renumber, true)
  assert.equal(parseArgs(['status']).project, undefined)
  assert.throws(() => parseArgs(['sync', '--project=other']))
  assert.throws(() => parseArgs(['sync', '--project']), /--project/)
})

test('keeps Langfuse folders in the path and rejects escapes', () => {
  assert.equal(
    promptDir('aiBuilder', 'skills/form', '/root'),
    '/root/aiBuilder/skills/form',
  )
  assert.throws(() => promptDir('aiBuilder', '../../etc', '/root'))
  assert.deepEqual(versionPaths('/p', 3, 'chat'), {
    content: '/p/v3.json',
    meta: '/p/v3.meta.json',
  })
})

test('lists versions numerically and prompts inside Langfuse folders', () => {
  const root = mkdtempSync(join(tmpdir(), 'prompts-'))
  try {
    const chat = join(root, 'aiBuilder/chat')
    const harness = join(root, 'aiBuilder/chat-eval-harness')
    const skill = join(root, 'aiBuilder/skills/form')
    for (const dir of [chat, harness, skill]) {
      mkdirSync(dir, { recursive: true })
    }
    for (const file of ['v10.md', 'v9.md', 'v10.meta.json', 'notes.txt']) {
      writeFileSync(join(chat, file), '')
    }
    writeFileSync(join(harness, 'v1.json'), '[]')
    writeFileSync(join(skill, 'v1.md'), '')

    assert.deepEqual(listVersions(chat), [
      { version: 9, type: 'text' },
      { version: 10, type: 'text' },
    ])
    assert.deepEqual(listVersions(harness), [{ version: 1, type: 'chat' }])
    assert.deepEqual(listVersions(join(root, 'missing')), [])
    assert.deepEqual(listPrompts(root), [
      { project: 'aiBuilder', name: 'chat' },
      { project: 'aiBuilder', name: 'chat-eval-harness' },
      { project: 'aiBuilder', name: 'skills/form' },
    ])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('formats text, chat and metadata files', () => {
  assert.equal(formatContent({ type: 'text', prompt: 'hi' }), 'hi')
  assert.equal(
    formatContent({ type: 'chat', prompt: [{ role: 'system', content: 'x' }] }),
    '[\n  {\n    "role": "system",\n    "content": "x"\n  }\n]\n',
  )
  assert.equal(
    formatMeta({ config: { t: 1 }, commitMessage: 'why', labels: ['x'] }),
    '{\n  "config": {\n    "t": 1\n  },\n  "commitMessage": "why"\n}\n',
  )
  assert.equal(formatMeta({}), '{\n  "config": {},\n  "commitMessage": ""\n}\n')
})

test('compares version lists in both directions', () => {
  assert.deepEqual(compareVersions([1, 2, 4], [3, 2, 1]), {
    missingInRepo: [3],
    missingInLangfuse: [4],
  })
})

const ready = {
  draft: { version: 3, type: 'text' },
  langfuseLatest: 2,
  mainLatest: 2,
  changedPushedFiles: [],
}

test('allows only a draft that is the next version on both sides', () => {
  assert.equal(getPushBlocker(ready), null)
  assert.match(
    getPushBlocker({ ...ready, changedPushedFiles: ['v2.md'] }),
    /read-only/,
  )
  assert.match(getPushBlocker({ ...ready, draft: null }), /prompt new/)
  assert.match(
    getPushBlocker({ ...ready, draft: { version: 3, type: 'chat' } }),
    /text/,
  )
  assert.match(getPushBlocker({ ...ready, langfuseLatest: 3 }), /prompt sync/)
  assert.match(
    getPushBlocker({ ...ready, langfuseLatest: 1 }),
    /finish the earlier push/,
  )
  assert.match(
    getPushBlocker({ ...ready, draft: { version: 5, type: 'text' } }),
    /--renumber/,
  )
})

test('reads versions and changes from a prompts clone', () => {
  withPromptsRepo((repo) => {
    const chat = join(repo, 'aiBuilder/chat')
    assert.doesNotThrow(() => assertPromptsRepo(repo))
    assert.throws(() => assertPromptsRepo(chat), /clone/)

    assert.deepEqual(listVersionsAtRef('origin/main', chat, repo), [1, 2])
    assert.deepEqual(
      listVersionsAtRef('origin/main', join(repo, 'x'), repo),
      [],
    )

    assert.deepEqual(changedFiles(chat, repo), [])
    writeFileSync(join(chat, 'v2.md'), 'edited\n')
    writeFileSync(join(chat, 'v3.md'), 'draft\n')
    assert.deepEqual(changedFiles(chat, repo).sort(), [
      join(chat, 'v2.md'),
      join(chat, 'v3.md'),
    ])
  })
})

test('rejects a plain folder and finds main after the first push', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prompts-'))
  try {
    const origin = join(dir, 'origin.git')
    const clone = join(dir, 'clone')
    assert.throws(() => assertPromptsRepo(dir), /prompts:clone/)
    run(dir, 'init', '--bare', '--initial-branch=main', origin)
    run(dir, 'clone', origin, clone)
    assert.throws(() => mainRef(clone), /first commit/)
    writeFileSync(join(clone, 'README.md'), 'prompts\n')
    run(clone, 'add', '.')
    run(clone, 'commit', '-m', 'init')
    run(clone, 'push', 'origin', 'HEAD:main')
    assert.equal(mainRef(clone), 'origin/main')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
