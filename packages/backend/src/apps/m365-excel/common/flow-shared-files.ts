import type { IGlobalVariable } from '@plumber/types'

import StepError, { GenericSolution } from '@/errors/step'
import Flow from '@/models/flow'
import FlowConnections from '@/models/flow-connections'

/**
 * Steps run with the pipe owner's identity. Without this check, a collaborator
 * could point a step at any workbook in the owner's Plumber folder.
 *
 * IMPORTANT: the list stays in force after the last collaborator leaves, so
 * steps they edited cannot open unshared files.
 */
export async function validateFileSharedWithFlow(
  $: IGlobalVariable,
  fileId: string,
): Promise<void> {
  const flowId = $.flow?.id
  if (!flowId) {
    throw new StepError({
      name: 'Step is missing its pipe',
      solution:
        'This should not happen. Please contact [Plumber support](https://go.gov.sg/plumber-support) for assistance.',
      kind: 'internal',
    })
  }

  const connectionId = $.auth?.connectionId
  if (!connectionId) {
    throw new StepError({
      name: 'M365 connection is missing',
      solution: GenericSolution.MalformedConnectionData,
      kind: 'config',
    })
  }

  const sharedFileIds = await FlowConnections.getSharedParameterValues({
    flowId,
    connectionId,
    parameterKey: 'fileId',
  })
  if (sharedFileIds?.includes(fileId) === true) {
    return
  }
  if (sharedFileIds === null && !(await Flow.hasCollaborators({ flowId }))) {
    return
  }

  throw new StepError({
    name: 'This file is not shared with this pipe.',
    solution:
      'Ask the pipe owner to select this file in this step, then try again.',
    kind: 'config',
  })
}
