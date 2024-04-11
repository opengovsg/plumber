import type { TransformSpec } from '../../../../common/transform-spec'

import { fields } from './fields'
import { transformData } from './transform-data'

export const id: TransformSpec['id'] = 'addSubtractDateTime'

export const dropdownConfig: TransformSpec['dropdownConfig'] = {
  label: 'Add/subtract time',
  description:
    'Manipulate a date and/or time by adding/subtracting days, months, years, hours or minutes',
}

export const spec: TransformSpec = {
  id,
  dropdownConfig,
  fields,
  transformData,
}
