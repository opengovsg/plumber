interface TracedPrompt {
  isFallback?: boolean
  toJSON(): string
}

/**
 * Builds the prompt fields for AI SDK telemetry metadata.
 *
 * IMPORTANT: Langfuse links a trace to the prompt version in `langfusePrompt`
 * and ignores `isFallback` there. Local prompts omit it, so dev runs never
 * count towards a real prompt version.
 */
export function promptTelemetryMetadata(prompt: TracedPrompt) {
  return prompt.isFallback
    ? { promptSource: 'local' as const }
    : { promptSource: 'langfuse' as const, langfusePrompt: prompt.toJSON() }
}
