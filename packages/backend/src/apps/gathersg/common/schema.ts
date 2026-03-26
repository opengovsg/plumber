import { z } from 'zod'

export const fieldTypeEnum = z.enum(['string', 'number', 'null'])
