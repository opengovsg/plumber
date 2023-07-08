import { Request, Response } from 'express'

import User from '@/models/user'

interface Context {
  req: Request
  res: Response
  currentUser: User
}

export default Context
