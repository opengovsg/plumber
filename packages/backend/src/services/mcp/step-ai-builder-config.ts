import type { IStepAiBuilderTool, IStepConfig } from '@plumber/types'

export function createStepAiBuilderConfig(
  traceId: string,
  tool: IStepAiBuilderTool,
): Pick<IStepConfig, 'aiBuilderConfig'> {
  return {
    aiBuilderConfig: { traceId, tool },
  }
}
