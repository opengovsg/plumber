import { z } from 'zod'

// Column names are wrapped in backticks in SQL statements, which escapes most
// special characters. We use a whitelist of alphanumerics, spaces, and common
// special characters — explicitly excluding backticks and backslashes, which
// would allow breaking out of the quoted identifier.
// Tested creating a column with: `a-zA-Z0-9 _-!@#$%^&*()+=[]{};:'",.<>/?|~]+`
export const columnNameSchema = z
  .string()
  .min(1, { message: 'Column name is required' })
  .max(255, { message: 'Column name must be less than 255 characters' })
  .regex(/^[a-zA-Z0-9 _\-!@#$%^&*()+=[\]{};:'",.<>/?|~]+$/, {
    message: 'Column name contains invalid characters',
  })

export const tableNameSchema = z
  .string()
  .min(1, { message: 'Table name is required' })
  .max(255, { message: 'Table name must be less than 255 characters' })
  .regex(/^[a-zA-Z0-9_]+$/, {
    message: 'Table name contains invalid characters',
  })
