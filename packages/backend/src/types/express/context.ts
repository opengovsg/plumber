import { Request, Response } from 'express'

import User from '@/models/user'

export interface UnauthenticatedContext {
  req: Request
  res: Response
  currentUser: User | null
  isAdminOperation: boolean
  tilesViewKey?: string
}

interface Context extends UnauthenticatedContext {
  currentUser: User
}

export interface AuthenticatedRequest extends Request {
  context: Context
}

export default Context
