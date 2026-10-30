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
      'notes.txt',
    ])
    mocks.readFile.mockResolvedValue('local prompt text')

    const prompt = await getPrompt('chat', 'aiBuilder', 'production')

    expect(mocks.readdir).toHaveBeenCalledWith(
      path.join(LOCAL_PROMPTS_DIR, 'aiBuilder', 'chat'),
    )
    expect(mocks.readFile).toHaveBeenCalledWith(
      path.join(LOCAL_PROMPTS_DIR, 'aiBuilder', 'chat', 'v10.md'),
      'utf-8',
    )
    expect(prompt.prompt).toBe('local prompt text')
    expect(prompt.version).toBe(10)
    expect(prompt.isFallback).toBe(true)
    expect(mocks.promptGet).not.toHaveBeenCalled()
  })

  it('reads prompts inside Langfuse folders', async () => {
    mocks.readdir.mockResolvedValue(['v1.md'])
    mocks.readFile.mockResolvedValue('skill text')

    await getPrompt('skills/form', 'aiBuilder')

    expect(mocks.readFile).toHaveBeenCalledWith(
      path.join(LOCAL_PROMPTS_DIR, 'aiBuilder', 'skills', 'form', 'v1.md'),
      'utf-8',
    )
  })

  it('warns and falls back to Langfuse when the prompt folder is missing', async () => {
    mocks.readdir.mockRejectedValue(enoent())

    const prompt = await getPrompt('chat-summary', 'aiBuilder', 'production')

    expect(prompt).toBe(langfusePrompt)
    expect(mocks.promptGet).toHaveBeenCalledWith('chat-summary', {
      label: 'production',
    })
    expect(mocks.warn).toHaveBeenCalledWith(
      expect.stringContaining('pnpm run prompts:clone'),
      expect.anything(),
    )
  })

  it('falls back to Langfuse when the folder has no text versions', async () => {
    mocks.readdir.mockResolvedValue(['v3.json', 'v3.meta.json'])

    const prompt = await getPrompt('chat-eval-harness', 'aiBuilder')

    expect(mocks.readFile).not.toHaveBeenCalled()
    expect(prompt).toBe(langfusePrompt)
  })

  it('rethrows read errors other than a missing folder', async () => {
    mocks.readdir.mockRejectedValue(
      Object.assign(new Error('denied'), { code: 'EACCES' }),
    )

    await expect(getPrompt('chat', 'aiBuilder')).rejects.toThrow('denied')
  })

  it('ignores prompt names that escape the prompts folder', async () => {
    const prompt = await getPrompt('../../secrets', 'aiBuilder')

    expect(mocks.readdir).not.toHaveBeenCalled()
    expect(prompt).toBe(langfusePrompt)
  })

  it('uses Langfuse in dev when AI_BUILDER_PROMPT_SOURCE is langfuse', async () => {
    process.env.AI_BUILDER_PROMPT_SOURCE = 'langfuse'

    const prompt = await getPrompt('chat', 'aiBuilder', 'production')

    expect(mocks.readdir).not.toHaveBeenCalled()
    expect(prompt).toBe(langfusePrompt)
  })

  it('never reads local prompts outside dev', async () => {
    mocks.isDev = false

    const prompt = await getPrompt('chat', 'aiBuilder', 'production')

    expect(mocks.readdir).not.toHaveBeenCalled()
    expect(prompt).toBe(langfusePrompt)
  })
})
