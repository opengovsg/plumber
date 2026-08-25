import {
  validateFlowFolderColor,
  validateFlowFolderName,
} from '@/helpers/flow-folders'
import FlowFolder from '@/models/flow-folder'

import type { MutationResolvers } from '../__generated__/types.generated'

const createFlowFolder: MutationResolvers['createFlowFolder'] = async (
  _parent,
  params,
  context,
) => {
  const name = validateFlowFolderName(params.input.name)
  const color = validateFlowFolderColor(params.input.color)

  const folder = await FlowFolder.query().insert({
    userId: context.currentUser.id,
    name,
    color,
  })

  folder.flowCount = 0

  return folder
}

export default createFlowFolder
