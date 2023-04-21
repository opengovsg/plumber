import { createHash } from 'crypto'
// Hashes a string with SHA256
export function sha256Hash(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('base64')
}
