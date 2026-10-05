import type { PipeStateStep } from '@/hooks/useChatStream'

import type { PreviewStep } from './previewItems'

/**
 * Turns a row of pipe state into a preview step. The row carries the custom
 * name as `stepName`, but the preview reads it from `config.stepName`. Without
 * this, an MRF stage step shows its action name instead of the stage name.
 */
export function toPreviewStep(step: PipeStateStep): PreviewStep {
  return {
    ...step,
    ...(step.stepName && { config: { stepName: step.stepName } }),
  } as unknown as PreviewStep
}
