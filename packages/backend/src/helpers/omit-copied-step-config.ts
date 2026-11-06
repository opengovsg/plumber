import type { IStepConfig } from '@plumber/types'
import { omit } from 'lodash'

/**
 * IMPORTANT: These keys describe the source step only. Copying them would
 * apply the source's admin overrides or template guidance to the copy.
 */
export function omitCopiedStepConfig(config: IStepConfig): IStepConfig {
  return omit(config, ['templateConfig', 'adminOverride', 'aiBuilderConfig'])
}
