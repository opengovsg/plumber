import assert from 'node:assert/strict'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  devLabel,
  getPullBlocker,
  getPushBlocker,
  hasConflictMarkers,
  listLocalPrompts,
  parseArgs,
  promptPaths,
  readLocalPrompt,
  threeWayMerge,
  writeLocalPrompt,
} from './prompt-files.mjs'

const meta = {
  name: 'chat',
  project: 'aiBuilder',
  label: 'production',
  baseVersion: 188,
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
})

test('defaults to the aiBuilder project and rejects unknown ones', () => {
  assert.equal(parseArgs(['pull', 'chat']).project, 'aiBuilder')
  assert.throws(() => parseArgs(['pull', 'chat', '--project=other']))
})

test('keeps Langfuse folders in the path and rejects escapes', () => {
  const paths = promptPaths('aiBuilder', 'folder/chat', '/root')
  assert.equal(paths.local, '/root/aiBuilder/folder/chat.md')
  assert.equal(paths.base, '/root/aiBuilder/folder/chat.base.md')
  assert.equal(paths.meta, '/root/aiBuilder/folder/chat.meta.json')
  assert.throws(() => promptPaths('aiBuilder', '../../etc/passwd', '/root'))
})

test('round-trips local files and lists them by name', () => {
  const root = mkdtempSync(join(tmpdir(), 'prompts-'))
  try {
    const paths = promptPaths('aiBuilder', 'folder/chat', root)
    writeLocalPrompt(paths, { meta, base: 'base', local: 'edited' })
    assert.deepEqual(readLocalPrompt(paths), {
      meta,
      base: 'base',
      local: 'edited',
    })
    assert.deepEqual(listLocalPrompts(root), [
      { project: 'aiBuilder', name: 'folder/chat' },
    ])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('rejects prompt names that collide with saved bases', () => {
  for (const name of ['chat.base', 'folder/chat.base', 'chat.base.base']) {
    assert.throws(() => promptPaths('aiBuilder', name, '/root'), /reserved/)
  }
  assert.equal(
    promptPaths('aiBuilder', 'folder.base/chat', '/root').local,
    '/root/aiBuilder/folder.base/chat.md',
  )
})

test('blocks pulling over a working copy without metadata, including empty files', () => {
  const root = mkdtempSync(join(tmpdir(), 'prompts-'))
  try {
    const paths = promptPaths('aiBuilder', 'chat', root)
    mkdirSync(join(root, 'aiBuilder'))
    assert.equal(getPullBlocker(paths, readLocalPrompt(paths)), null)
    for (const local of ['handwritten prompt', '']) {
      writeFileSync(paths.local, local)
      assert.equal(readLocalPrompt(paths), null)
      assert.match(getPullBlocker(paths, readLocalPrompt(paths)), /--force/)
      assert.equal(readFileSync(paths.local, 'utf-8'), local)
    }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('blocks edited copies after metadata loss and permits clean or missing copies', () => {
  const root = mkdtempSync(join(tmpdir(), 'prompts-'))
  try {
    const paths = promptPaths('aiBuilder', 'chat', root)
    writeLocalPrompt(paths, { meta, base: 'base', local: 'base' })
    assert.equal(getPullBlocker(paths, readLocalPrompt(paths)), null)
    writeFileSync(paths.local, 'edited')
    assert.match(getPullBlocker(paths, readLocalPrompt(paths)), /--merge/)
    rmSync(paths.meta)
    assert.match(getPullBlocker(paths, readLocalPrompt(paths)), /--force/)
    assert.equal(readFileSync(paths.local, 'utf-8'), 'edited')
    writeLocalPrompt(paths, { meta, base: 'base', local: 'base' })
    rmSync(paths.local)
    assert.equal(getPullBlocker(paths, readLocalPrompt(paths)), null)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('detects conflict markers only at line start', () => {
  assert.equal(hasConflictMarkers('a\n<<<<<<< local\nb'), true)
  assert.equal(hasConflictMarkers('a\n=======\nb'), true)
  assert.equal(hasConflictMarkers('use <<<<<<< inline'), false)
})

test('blocks a push when the base label moved', () => {
  const blocker = getPushBlocker({
    local: 'new',
    base: 'old',
    meta,
    currentVersion: 189,
  })
  assert.match(blocker, /moved from v188 to v189/)
  assert.match(blocker, /--merge/)
})

test('blocks a push with no changes or conflict markers', () => {
  assert.match(
    getPushBlocker({ local: 'same', base: 'same', meta, currentVersion: 188 }),
    /no changes/,
  )
  assert.match(
    getPushBlocker({
      local: '<<<<<<< local\nx',
      base: 'old',
      meta,
      currentVersion: 188,
    }),
    /conflict markers/,
  )
  assert.match(
    getPushBlocker({ local: null, base: 'old', meta, currentVersion: 188 }),
    /missing/,
  )
})

test('allows a push on top of the current base version', () => {
  assert.equal(
    getPushBlocker({ local: 'new', base: 'old', meta, currentVersion: 188 }),
    null,
  )
})

test('derives the dev label from the git email', () => {
  assert.equal(devLabel('Kevin.Kim@open.gov.sg'), 'dev-kevin-kim')
  assert.throws(() => devLabel(''))
})

test('merges non-overlapping edits cleanly', () => {
  const { text, conflicts } = threeWayMerge({
    base: 'one\ntwo\nthree\n',
    local: 'ONE\ntwo\nthree\n',
    theirs: 'one\ntwo\nTHREE\n',
    theirsName: 'production v189',
  })
  assert.equal(conflicts, 0)
  assert.equal(text, 'ONE\ntwo\nTHREE\n')
})

test('marks overlapping edits as conflicts', () => {
  const { text, conflicts } = threeWayMerge({
    base: 'one\n',
    local: 'mine\n',
    theirs: 'theirs\n',
    theirsName: 'production v189',
  })
  assert.equal(conflicts, 1)
  assert.match(
    text,
    /<<<<<<< local\nmine\n=======\ntheirs\n>>>>>>> production v189/,
  )
  assert.equal(hasConflictMarkers(text), true)
})
