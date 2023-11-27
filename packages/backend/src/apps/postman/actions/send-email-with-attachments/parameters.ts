import { IField } from '@plumber/types'

import {
  transactionalEmailFields,
  transactionalEmailSchema,
} from '../../common/parameters'

export const fields: IField[] = [...transactionalEmailFields]

export const schema = transactionalEmailSchema
