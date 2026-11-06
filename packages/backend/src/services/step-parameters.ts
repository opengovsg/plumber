import type { IJSONObject } from '@plumber/types'

import apps from '@/apps'

export interface PrepareStepParametersInput {
  appKey: string
  key: string | null | undefined
  parameters: IJSONObject
  version: number
}

export interface PreparedStepParameters {
  parameters: IJSONObject
  version: number
}

export function prepareStepParameters({
  appKey,
  key,
  parameters,
  version,
}: PrepareStepParametersInput): PreparedStepParameters {
  const transformer = key ? apps[appKey]?.stepTransformer : undefined
  if (!transformer) {
    return { parameters, version }
  }

  return {
    parameters: transformer.transformStepParameters(key, parameters, version),
    version: transformer.getLatestStepVersion(key),
  }
}
