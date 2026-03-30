import type { UnauthenticatedContext } from './express/context'

declare global {
  namespace Express {
    interface Request {
      context?: UnauthenticatedContext
    }
  }
}

export {}
