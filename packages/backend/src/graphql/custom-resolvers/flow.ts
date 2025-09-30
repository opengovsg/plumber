import sortBy from 'lodash/sortBy'

import { TEMPLATES } from '@/db/storage'
import FlowCollaborator from '@/models/flow-collaborators'

import type { Resolvers } from '../__generated__/types.generated'

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

export default {
  template,
  collaborators,
  role,
} satisfies FlowResolver
