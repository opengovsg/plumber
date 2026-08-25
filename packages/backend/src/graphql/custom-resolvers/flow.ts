import sortBy from 'lodash/sortBy'

import { TEMPLATES } from '@/db/storage'
import { loadFlowFolder } from '@/helpers/flow-folders'
import FlowCollaborator from '@/models/flow-collaborators'

import type {
  FlowErrorConfigResolvers,
  Resolvers,
} from '../__generated__/types.generated'

type FlowResolver = Resolvers['Flow']

const template: FlowResolver['template'] = async (parent) => {
  const templateId = parent?.config?.templateConfig?.templateId
  if (!templateId) {
    return null
  }
  return TEMPLATES.find((template) => template.id === templateId)
}

const collaborators: FlowResolver['collaborators'] = async (parent) => {
  let collaborators = parent?.collaborators
  if (!collaborators) {
    const flowCollaborators = await FlowCollaborator.query()
      .where({ flow_id: parent.id })
      .withGraphFetched('user')
    collaborators = flowCollaborators
  }

  // manually insert the owner as a collaborator
  // as the owner lives separately in the flows table
  const ownerCollaborator = new FlowCollaborator()
  ownerCollaborator.flowId = parent.id
  ownerCollaborator.userId = parent.userId
  ownerCollaborator.role = 'owner'

  return sortBy(
    [ownerCollaborator, ...(collaborators ?? [])],
    [
      (collaborator) => {
        return ['owner', 'editor', 'viewer'].indexOf(collaborator?.role)
      },
    ],
  )
}

const role: FlowResolver['role'] = async (parent) => {
  // Return the computed role from the query
  return (parent as any)?.role || 'viewer'
}

// Batched per-request (see loadFlowFolder) so listing many flows never N+1s.
const folder: FlowResolver['folder'] = async (parent, _args, context) => {
  return loadFlowFolder({
    requestKey: context,
    userId: context.currentUser.id,
    flowId: parent.id,
  })
}

// in collaborators, we introduced the concept of notificationRecipients,
// which is an array that may contain 'editor' and/or 'viewer'.
// however, there may be existing flows that already have errorConfig.notificationFrequency
// and when returning, may not contain this `notificationRecipients` field
// to avoid gql errors, we force it to return an empty array
const notificationRecipients: FlowErrorConfigResolvers['notificationRecipients'] =
  (parent) => {
    return parent?.notificationRecipients ?? []
  }

export const FlowErrorConfig: FlowErrorConfigResolvers = {
  notificationRecipients,
}

export default {
  template,
  collaborators,
  role,
  folder,
} satisfies FlowResolver
