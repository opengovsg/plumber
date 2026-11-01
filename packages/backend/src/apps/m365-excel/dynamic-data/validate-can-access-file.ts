import type { IStepError } from '@plumber/types'

import StepError from '@/errors/step'
import { UserFacingError } from '@/errors/user-facing-error'

import { validateCanAccessFile } from '../common/file-privacy'

/**
 * Dynamic data runs outside a step, so GraphQL shows the error message as-is.
 *
 * IMPORTANT: a StepError's message is JSON, so pass only its name.
 */
export async function validateCanAccessFileForDynamicData(
  ...args: Parameters<typeof validateCanAccessFile>
): Promise<void> {
  try {
    await validateCanAccessFile(...args)
  } catch (error) {
    if (error instanceof StepError) {
      const { name } = JSON.parse(error.message) as IStepError
      throw new UserFacingError(name)
    }
    throw error
  }
}
