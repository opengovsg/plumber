import { z } from 'zod'

export const encryptionKeySchema = z
  .string()
  .min(12, {
    message: 'be at least 12 characters long',
  })
  .max(20, { message: 'be at most 20 characters long' })
  .regex(/[0-9]/, {
    message: 'contain at least 1 number',
  })
  .regex(/[A-Z]/, {
    message: 'contain at least 1 uppercase letter',
  })
  .regex(/[^A-Za-z0-9\s]/, {
    message: 'contain at least 1 special character',
  })
  // Do not allow leading or trailing whitespace
  .refine((value) => value === value.trim(), {
    message: 'not have leading or trailing whitespace',
  })
