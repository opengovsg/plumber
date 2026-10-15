import type { IStepConfig } from '@plumber/types'

/**
 * Config references contain bare step IDs, unlike parameter variable strings.
 */
export function remapTemplateStepConfig(
  config: IStepConfig,
  stepIdMap: Record<string, string>,
): IStepConfig {
  const mappedConfig = structuredClone(config)
  const resolve = (stepId: string): string => {
    const replacement = stepIdMap[stepId]
    if (!replacement) {
      throw new Error(`Template config references an unknown step: ${stepId}`)
    }
    return replacement
  }

  if (mappedConfig.endStepId !== undefined) {
    mappedConfig.endStepId = resolve(mappedConfig.endStepId)
  }
  if (mappedConfig.approval) {
    mappedConfig.approval.stepId = resolve(mappedConfig.approval.stepId)
  }

  return mappedConfig
}
