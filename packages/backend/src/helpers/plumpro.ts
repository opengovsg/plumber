import { PLUMPRO_FEATURE_FLAG } from '@/config/flags'
import { getLdFlagValue } from '@/helpers/launch-darkly'

export async function isPlumPro(userEmail: string): Promise<boolean> {
  return (
    (await getLdFlagValue<boolean>(PLUMPRO_FEATURE_FLAG, userEmail, false)) ===
    true
  )
}
