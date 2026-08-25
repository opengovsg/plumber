import { z } from 'zod'

import { BadUserInputError } from '@/errors/graphql-errors'
import {
  countFlowsByFolder,
  validateFlowFolderColor,
  validateFlowFolderName,
} from '@/helpers/flow-folders'
import FlowFolder, { type FlowFolderColor } from '@/models/flow-folder'

import type { MutationResolvers } from '../__generated__/types.generated'

const updateFlowFolder: MutationResolvers['updateFlowFolder'] = async (
  _parent,
  params,
  context,
) => {
  const { id, name, color } = params.input

  // To avoid the gibberish error code if a caller sends a malformed id
  if (!z.string().uuid().safeParse(id).success) {
    throw new BadUserInputError('Please provide a valid folder ID.')
  }

  // Scoped by user_id: a folder that belongs to someone else looks
  // not-found, never a silent no-op success.
  const folder = await FlowFolder.query()
    .findOne({ id, user_id: context.currentUser.id })
    .throwIfNotFound()

  const patch: { name?: string; color?: FlowFolderColor } = {}
  if (name != null) {
    patch.name = validateFlowFolderName(name)
  }
  if (color != null) {
    patch.color = validateFlowFolderColor(color)
  }

  const updatedFolder = await folder.$query().patchAndFetch(patch)

  const flowCountsByFolderId = await countFlowsByFolder(context.currentUser)
  updatedFolder.flowCount = flowCountsByFolderId[updatedFolder.id] ?? 0

  return updatedFolder
}

export default updateFlowFolder
