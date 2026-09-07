import { z } from 'zod'

import { buildSystemPrompt } from '@/helpers/build-system-prompt'

import type { ChatRequest } from './schema'

export type ChatPhase = 'align' | 'propose' | 'configure' | 'edit' | 'guide'

export const promptManifestSchema = z.object({
  core: z.string().min(1),
  summary: z.string().min(1),
  skills: z.array(
    z.object({
      id: z.string().min(1),
      prompt: z.string().min(1),
      phases: z.array(
        z.enum(['align', 'propose', 'configure', 'edit', 'guide']),
      ),
    }),
  ),
})

export type PromptManifest = z.infer<typeof promptManifestSchema>

function textFromMessage(message: ChatRequest['messages'][number]): string {
  return message.parts
    .flatMap((part) => (part.type === 'text' ? [part.text] : []))
    .join('\n')
}

function hasPipe(messages: ChatRequest['messages']): boolean {
  return messages.some((message) =>
    message.parts.some((part) => {
      if (part.type === 'data-pipeState') {
        return true
      }
      if (part.type !== 'tool-create_pipe' && part.type !== 'dynamic-tool') {
        return false
      }
      if (part.type === 'dynamic-tool' && part.toolName !== 'create_pipe') {
        return false
      }
      return (
        typeof part.output === 'object' &&
        part.output !== null &&
        'pipeId' in part.output
      )
    }),
  )
}

function isEditRequest(text: string): boolean {
  return /\b(add|change|delete|edit|modify|move|remove|replace|start over|swap|update)\b/i.test(
    text,
  )
}

function confirmsProposal(text: string): boolean {
  return /^(yes|yes, create it|create it|go ahead|set it up|confirm)\b/i.test(
    text.trim(),
  )
}

function isGuideQuestion(text: string): boolean {
  const asksForHelp = /\?|^(how|what|when|where|why|can|does|is)\b/i.test(
    text.trim(),
  )
  const mentionsGuidance =
    /\b(connect|configure|guide|set up|setup|troubleshoot|triggering|work)\b/i.test(
      text,
    )
  const requestsWorkflow =
    /\b(automate|build|create|pipe|save|send|store|workflow|when .*submitted)\b/i.test(
      text,
    )
  return asksForHelp && mentionsGuidance && !requestsWorkflow
}

export function inferChatPhase(messages: ChatRequest['messages']): ChatPhase {
  const latestUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === 'user')
  const latestUserText = latestUserMessage
    ? textFromMessage(latestUserMessage)
    : ''

  if (hasPipe(messages)) {
    return isEditRequest(latestUserText) ? 'edit' : 'configure'
  }

  const hasProposal = messages.some(
    (message) =>
      message.role === 'assistant' &&
      textFromMessage(message).includes('<!-- WORKFLOW_METADATA'),
  )
  if (hasProposal) {
    return confirmsProposal(latestUserText) ? 'configure' : 'propose'
  }

  return isGuideQuestion(latestUserText) ? 'guide' : 'align'
}

export function selectPromptNames(
  manifest: PromptManifest,
  phase: ChatPhase,
): string[] {
  return [
    manifest.core,
    ...manifest.skills
      .filter((skill) => skill.phases.includes(phase))
      .map((skill) => skill.prompt),
  ]
}

interface ComposePinnedSystemPromptParams {
  corePrompt: string
  skillPrompts: string[]
  restrictedApps: string[]
  facts?: string
}

export function composePinnedSystemPrompt({
  corePrompt,
  skillPrompts,
  restrictedApps,
  facts = '',
}: ComposePinnedSystemPromptParams): string {
  const composedPrompt = [corePrompt, ...skillPrompts].join('\n\n---\n\n')
  return buildSystemPrompt(composedPrompt, restrictedApps) + facts
}
