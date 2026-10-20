import type { ITemplate } from '@plumber/types'

import { TEMPLATES } from '@/db/storage'
import Template from '@/models/template'

/**
 * Lists the user's personal templates followed by the built-in templates.
 *
 * Template listing and template search share this to show the same candidates.
 */
export async function getUserVisibleTemplates(
  userId: string,
): Promise<ITemplate[]> {
  const userTemplates = await Template.findAllForUser(userId)
  return [...userTemplates, ...TEMPLATES]
}
