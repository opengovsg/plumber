import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getPrompt, LOCAL_PROMPTS_DIR } from '../get-prompt'

const mocks = vi.hoisted(() => ({
  isDev: true,
  readdir: vi.fn(),
  readFile: vi.fn(),
  promptGet: vi.fn(),
  warn: vi.fn(),
}))

vi.mock('node:fs/promises', () => ({
  readdir: mocks.readdir,
  readFile: mocks.readFile,
}))

vi.mock('@/config/app', () => ({
  default: {
    get isDev() {
      return mocks.isDev
    },
  },
}))

vi.mock('@/helpers/langfuse', () => ({
  getLangfuseClient: () => ({ prompt: { get: mocks.promptGet } }),
}))

vi.mock('@/helpers/logger', () => ({
  default: { warn: mocks.warn },
}))

const langfusePrompt = { prompt: 'from langfuse', isFallback: false }

function enoent() {
  return Object.assign(new Error('missing'), { code: 'ENOENT' })
}

describe('getPrompt', () => {
  beforeEach(() => {
    mocks.isDev = true
    mocks.promptGet.mockResolvedValue(langfusePrompt)
    delete process.env.AI_BUILDER_PROMPT_SOURCE
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('reads the newest local version in dev', async () => {
    mocks.readdir.mockResolvedValue([
      'v9.md',
      'v10.md',
      'v10.meta.json',
      'v2.md',
    ])
    mocks.readFile.mockResolvedValue('local prompt text')

    const prompt = await getPrompt('skills/form', 'aiBuilder', 'production')

    expect(mocks.readFile).toHaveBeenCalledWith(
      path.join(LOCAL_PROMPTS_DIR, 'aiBuilder', 'skills', 'form', 'v10.md'),
      'utf-8',
    )
    expect(prompt.prompt).toBe('local prompt text')
    expect(prompt.version).toBe(10)
    expect(prompt.isFallback).toBe(true)
    expect(mocks.promptGet).not.toHaveBeenCalled()
  })

  it.each([
    ['the folder is missing', () => mocks.readdir.mockRejectedValue(enoent())],
    [
      'the folder has no text versions',
      () => mocks.readdir.mockResolvedValue(['v3.json', 'v3.meta.json']),
    ],
  ])('warns and falls back to Langfuse when %s', async (_, arrange) => {
    arrange()

    const prompt = await getPrompt('chat', 'aiBuilder', 'production')

    expect(prompt).toBe(langfusePrompt)
    expect(mocks.promptGet).toHaveBeenCalledWith('chat', {
      label: 'production',
    })
    expect(mocks.warn).toHaveBeenCalledWith(
      expect.stringContaining('pnpm run prompts:clone'),
      expect.anything(),
    )
  })

  it('rethrows read errors other than a missing folder', async () => {
    mocks.readdir.mockRejectedValue(
      Object.assign(new Error('denied'), { code: 'EACCES' }),
    )

    await expect(getPrompt('chat', 'aiBuilder')).rejects.toThrow('denied')
  })

  it.each([
    ['the prompt name escapes the prompts folder', () => '../../secrets'],
    [
      'AI_BUILDER_PROMPT_SOURCE is langfuse',
      () => {
        process.env.AI_BUILDER_PROMPT_SOURCE = 'langfuse'
        return 'chat'
      },
    ],
    [
      'the app is not in dev',
      () => {
        mocks.isDev = false
        return 'chat'
      },
    ],
  ])('skips local prompts when %s', async (_, arrange) => {
    const prompt = await getPrompt(arrange(), 'aiBuilder')

    expect(mocks.readdir).not.toHaveBeenCalled()
    expect(prompt).toBe(langfusePrompt)
  })
})
