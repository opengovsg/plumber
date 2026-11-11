import type { StepErrorKind } from '@plumber/types'

import HttpError from '@/errors/http'
import StepError from '@/errors/step'

import { tryParseGraphApiError } from './parse-graph-api-error'

interface GraphStepErrorInfo {
  name: string
  solution: string
  kind: StepErrorKind
}

const TABLE_TOO_LARGE: GraphStepErrorInfo = {
  name: 'Your Excel table is too large',
  solution: 'Reduce the number of rows or columns and try again.',
  kind: 'config',
}

const NOT_FOUND: GraphStepErrorInfo = {
  name: 'Could not find your Excel file, worksheet or table',
  solution:
    'Check that the file, worksheet and table in this step still exist, then reconfigure the step.',
  kind: 'config',
}

const REQUEST_TOO_LARGE: GraphStepErrorInfo = {
  name: 'Too much data was sent to Excel',
  solution: 'Reduce the amount of data this step writes and try again.',
  kind: 'config',
}

const UNSUPPORTED_FILE: GraphStepErrorInfo = {
  name: 'Excel could not open your file',
  solution:
    'Your file may be corrupted, too large, or use unsupported features. Check that it opens in Excel, then try again.',
  kind: 'config',
}

const TABLE_PROTECTED: GraphStepErrorInfo = {
  name: 'Excel blocked changes to your table',
  solution:
    'Check that the worksheet and table are not protected and the file is not checked out, then try again.',
  kind: 'config',
}

const ACCESS_DENIED: GraphStepErrorInfo = {
  name: 'Microsoft denied access to your Excel file',
  solution:
    "Check that the file's sharing settings have not changed, then try again.",
  kind: 'config',
}

const CONFLICT: GraphStepErrorInfo = {
  name: 'Excel could not complete this change',
  solution:
    'Check the error details below. Make sure nothing on your worksheet blocks this change, then try again.',
  kind: 'config',
}

const UNAVAILABLE: GraphStepErrorInfo = {
  name: 'Microsoft Excel is unavailable',
  solution: 'Try again later.',
  kind: 'third-party',
}

const UNEXPECTED: GraphStepErrorInfo = {
  name: 'Microsoft Excel rejected the request',
  solution: 'Try again later.',
  kind: 'internal',
}

// Graph 400 codes that only the user's own file or table can cause.
const CONFIG_400_CODES: ReadonlyMap<string, GraphStepErrorInfo> = new Map([
  ['RangeExceedsLimit', TABLE_TOO_LARGE],
])

// Excel's `AccessDenied` means a protected sheet, which needs its own solution.
const CONFIG_403_CODES: ReadonlyMap<string, GraphStepErrorInfo> = new Map([
  ['AccessDenied', TABLE_PROTECTED],
])

function getGraphStepErrorInfo(error: HttpError): GraphStepErrorInfo {
  const status = error.response.status

  // No code means a beforeRequest hook (e.g. token fetch) threw, not the network.
  if (status === undefined) {
    return error.code ? UNAVAILABLE : UNEXPECTED
  }

  const code = tryParseGraphApiError(error)?.code ?? ''
  switch (status) {
    case 400:
      return CONFIG_400_CODES.get(code) ?? UNEXPECTED
    case 403:
      return CONFIG_403_CODES.get(code) ?? ACCESS_DENIED
    case 404:
      return NOT_FOUND
    case 409:
      return CONFLICT
    case 413:
      return REQUEST_TOO_LARGE
    case 501:
      return UNSUPPORTED_FILE
  }

  return status >= 500 ? UNAVAILABLE : UNEXPECTED
}

/**
 * Converts a Graph `HttpError` that the request error handler let through.
 *
 * IMPORTANT: call it after any catch that reads the raw `HttpError` (e.g. the
 * `invalidSession` retry), never inside the request error handler.
 */
export function toStepError(error: HttpError): StepError {
  return new StepError({ ...getGraphStepErrorInfo(error), cause: error })
}

// Other errors pass through, so the error handler's `RetriableError`s keep retrying.
export function rethrowHttpErrorAsStepError(error: unknown): never {
  if (error instanceof HttpError) {
    throw toStepError(error)
  }
  throw error
}
