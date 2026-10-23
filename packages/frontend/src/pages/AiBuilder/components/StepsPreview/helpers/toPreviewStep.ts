import type { IStepConfig } from '@plumber/types'

import type { PipeStateStep } from '@/hooks/useChatStream'

import type { PreviewStep } from './previewItems'

/**
 * Turns a row of pipe state into a preview step. The row carries the custom
 * name and approval path flat, but the preview reads them from `config` like
 * the editor does. Without this, an MRF stage step shows its action name
 * instead of the stage name.
 */
export function toPreviewStep(step: PipeStateStep): PreviewStep {
  const { stepName, approval, ...rest } = step
  const config: IStepConfig = {
    ...(stepName && { stepName }),
    ...(approval && { approval }),
  }

  return {
    ...rest,
    ...(Object.keys(config).length > 0 && { config }),
  } as unknown as PreviewStep
}
