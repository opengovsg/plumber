import { z } from 'zod'

const guideUrlSchema = z
  .string()
  .url()
  .refine((url) => {
    const parsed = new URL(url)
    return (
      parsed.protocol === 'https:' && parsed.hostname === 'guide.plumber.gov.sg'
    )
  })

const stepErrorFixResponseSchema = z.object({
  data: z.object({
    fixed: z.boolean(),
    summary: z.string().trim().min(1),
    sources: z
      .array(
        z.object({
          title: z.string().trim().min(1),
          url: guideUrlSchema,
        }),
      )
      .max(3),
  }),
})

export type StepErrorFixSource = {
  title: string
  url: string
}

export type StepErrorFixResult = {
  fixed: boolean
  summary: string
  sources: StepErrorFixSource[]
}

export type CheckStepErrorSummary = {
  errorName: string
  errorSolution?: string
}

export function readCheckStepError(
  errorDetails: unknown,
): CheckStepErrorSummary | null {
  if (!errorDetails || typeof errorDetails !== 'object') {
    return null
  }
  const record = errorDetails as Record<string, unknown>
  if (typeof record.name === 'string' && record.name.trim()) {
    return {
      errorName: record.name.trim(),
      errorSolution:
        typeof record.solution === 'string' && record.solution.trim()
          ? record.solution.trim().slice(0, 2000)
          : undefined,
    }
  }
  return { errorName: 'We could not test this step' }
}

export async function requestStepErrorFix(
  input: {
    stepId: string
    appName: string
    appKey: string
    stepKey: string
    stepName: string
    errorName: string
    errorSolution?: string
  },
  signal: AbortSignal,
): Promise<StepErrorFixResult> {
  const response = await fetch('/api/step-error-fix', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
    signal,
  })
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const message =
      body &&
      typeof body === 'object' &&
      'error' in body &&
      typeof body.error === 'string'
        ? body.error
        : 'AI could not fix this step. Your settings were not changed.'
    throw new Error(message)
  }
  const parsed = stepErrorFixResponseSchema.safeParse(body)
  if (!parsed.success) {
    throw new Error(
      'AI could not fix this step. Your settings were not changed.',
    )
  }
  return parsed.data.data
}
