import { readFileSync } from 'fs'
import { join, resolve } from 'path'
import { describe, expect, it } from 'vitest'

import {
  composePinnedSystemPrompt,
  inferChatPhase,
  promptManifestSchema,
  selectPromptNames,
} from './prompt-context'
import type { ChatRequest } from './schema'

type Message = ChatRequest['messages'][number]

const userMessage = (text: string): Message => ({
  role: 'user',
  parts: [{ type: 'text', text }],
})

const assistantMessage = (text: string): Message => ({
  role: 'assistant',
  parts: [{ type: 'text', text }],
})

describe('inferChatPhase', () => {
  it('defaults workflow requests to align', () => {
    expect(
      inferChatPhase([userMessage('Send email when my form submits')]),
    ).toBe('align')
  })

  it('detects guide questions without treating workflow requests as guides', () => {
    expect(inferChatPhase([userMessage('How do I configure FormSG?')])).toBe(
      'guide',
    )
    expect(
      inferChatPhase([userMessage('How do I send email when a form submits?')]),
    ).toBe('align')
  })

  it('keeps proposed workflows in propose', () => {
    expect(
      inferChatPhase([
        assistantMessage('<!-- WORKFLOW_METADATA\nname: Test\n-->'),
        userMessage("No, I'll keep refining"),
      ]),
    ).toBe('propose')
  })

  it('loads configure when the user confirms a proposal', () => {
    expect(
      inferChatPhase([
        assistantMessage('<!-- WORKFLOW_METADATA\nname: Test\n-->'),
        userMessage('Yes, create it'),
      ]),
    ).toBe('configure')
  })

  it('uses configure or edit after a pipe exists', () => {
    const pipeState: Message = {
      role: 'assistant',
      parts: [
        {
          type: 'data-pipeState',
          data: {
            pipeId: '123e4567-e89b-12d3-a456-426614174000',
            steps: [],
          },
        },
      ],
    }

    expect(inferChatPhase([pipeState, userMessage('Continue')])).toBe(
      'configure',
    )
    expect(
      inferChatPhase([pipeState, userMessage('Remove the Slack step')]),
    ).toBe('edit')
  })
})

describe('prompt manifest', () => {
  it('selects core and every skill for a phase', () => {
    const manifest = promptManifestSchema.parse({
      core: 'ai-builder/core',
      summary: 'chat-summary',
      skills: [
        {
          id: 'configure',
          prompt: 'ai-builder/configure',
          phases: ['configure', 'edit'],
        },
        {
          id: 'edit',
          prompt: 'ai-builder/edit',
          phases: ['edit'],
        },
      ],
    })

    expect(selectPromptNames(manifest, 'edit')).toEqual([
      'ai-builder/core',
      'ai-builder/configure',
      'ai-builder/edit',
    ])
  })
})

describe('composePinnedSystemPrompt', () => {
  it('strips restricted apps after composing skills and appends facts', () => {
    const result = composePinnedSystemPrompt({
      corePrompt: 'Core',
      skillPrompts: ['| Store data | M365 Excel |'],
      restrictedApps: ['m365-excel'],
      facts: '\nKnown fact',
    })

    expect(result).not.toContain('| Store data | M365 Excel |')
    expect(result).toContain('user does not have access to')
    expect(result.endsWith('Known fact')).toBe(true)
  })
})

describe('prompt drafts', () => {
  it('retain runtime output contracts without static app catalogs', () => {
    const promptsDirectory = resolve(
      __dirname,
      '../../../../../../tools/langfuse/prompts/ai-builder',
    )
    const files = [
      'core.md',
      'align.md',
      'propose.md',
      'configure.md',
      'edit.md',
      'guide.md',
      'unsupported.md',
      'output-format.md',
    ]
    const content = files
      .map((file) => readFileSync(join(promptsDirectory, file), 'utf8'))
      .join('\n')

    for (const marker of [
      'CLARIFICATION_DATA',
      'WORKFLOW_METADATA',
      'DYNAMIC_PICKER_DATA',
      'APP_KEY',
      'useConfiguredEmails',
      '{{SUPPORT_FORM_URL}}',
    ]) {
      expect(content).toContain(marker)
    }
    expect(content).not.toContain('## Available Triggers')
    expect(content).not.toContain('## Available Actions')
  })
})
