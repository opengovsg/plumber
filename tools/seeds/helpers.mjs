import { createHash } from 'crypto'

export function sha256Hash(data) {
  return createHash('sha256').update(data).digest('base64')
}
