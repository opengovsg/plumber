import { Request, Response } from 'express'

import User from '@/models/user'

export interface UnauthenticatedContext {
  req: Request
  res: Response
  currentUser: User | null
  tilesViewKey?: string
}

interface Context extends UnauthenticatedContext {
  currentUser: User
}

export default Context
