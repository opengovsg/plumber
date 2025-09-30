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
  if (!parent?.collaborators) {
    return []
  }

  // manually insert the owner as a collaborator
  // as the owner lives separately in the flows table
  const ownerCollaborator = new FlowCollaborator()
  ownerCollaborator.flowId = parent.id
  ownerCollaborator.userId = parent.userId
  ownerCollaborator.role = 'owner'

  return sortBy(
    [ownerCollaborator, ...parent.collaborators],
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

const pendingTransfer: FlowResolver['pendingTransfer'] = async (parent) => {
  // if pendingTransfer was not fetched in the query, return null
  // this happens when includePendingTransfer is false or not provided
  return parent.pendingTransfer || null
}

export default {
  template,
  collaborators,
  role,
  pendingTransfer,
} satisfies FlowResolver
