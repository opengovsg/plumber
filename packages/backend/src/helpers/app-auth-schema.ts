import { z } from 'zod'

const MAX_SCREEN_NAME_LENGTH = 128

/**
 * NOTE: we use this schema to validate the screen name for all apps that have a screen name.
 */
export const screenNameSchema = z
  .string()
  .trim()
  .min(1, 'Empty screen name')
  .max(MAX_SCREEN_NAME_LENGTH, 'Screen name is too long')
