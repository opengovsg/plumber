import sortBy from 'lodash/sortBy'

import { TEMPLATES } from '@/db/storage'

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

  return sortBy(parent.collaborators, [
    (collaborator) => {
      return ['owner', 'editor', 'viewer'].indexOf(collaborator?.role)
    },
  ])
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
