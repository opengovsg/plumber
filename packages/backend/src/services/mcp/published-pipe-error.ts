import { ValidationError } from 'objection'

import { UserFacingError } from '@/errors/user-facing-error'

export const PUBLISHED_PIPE_ERROR_MESSAGE =
  'This pipe is published. Ask the user to unpublish it before making changes.'

export interface PublishedPipeErrorResult {
  error: string
  pipePublished: true
}

export class PublishedPipeError extends UserFacingError {
  constructor() {
    super(PUBLISHED_PIPE_ERROR_MESSAGE)
    this.name = 'PublishedPipeError'
  }
}

export function isPublishedPipeError(error: unknown): boolean {
  return (
    error instanceof PublishedPipeError ||
    (error instanceof ValidationError &&
      error.type === 'editingPublishedPipeError')
  )
}

export function publishedPipeErrorResult(): PublishedPipeErrorResult {
  return {
    error: PUBLISHED_PIPE_ERROR_MESSAGE,
    pipePublished: true,
  }
}
