import axios from 'axios'

/**
 * Builds a log-safe error snapshot.
 *
 * Axios errors carry request URLs, headers and response bodies. Callers log
 * this snapshot instead of the original so credentials never reach the logger.
 */
export function toSafeLogError(error: unknown): {
  name: string
  message: string
  status?: number
} {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status
    return {
      name: 'AxiosError',
      message: error.message,
      ...(typeof status === 'number' ? { status } : {}),
    }
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    }
  }

  return {
    name: 'UnknownError',
    message: 'Non-error thrown',
  }
}
