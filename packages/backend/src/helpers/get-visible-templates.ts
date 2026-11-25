import type { ITemplate } from '@plumber/types'

import { TEMPLATES } from '@/db/storage'
import Template from '@/models/template'

/**
 * Lists every community template followed by the built-in templates.
 *
 * Template listing and template search share this to show the same candidates.
 */
export async function getVisibleTemplates(): Promise<ITemplate[]> {
  const communityTemplates = await Template.findAll()
  return [...communityTemplates, ...TEMPLATES]
}
