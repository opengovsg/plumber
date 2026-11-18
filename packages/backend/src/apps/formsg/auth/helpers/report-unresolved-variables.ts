import type { IGlobalVariable } from '@plumber/types'

import logger from '@/helpers/logger'
import { incrementMetric } from '@/helpers/metrics'
import Step from '@/models/step'

import { CHILDREN_KEY_PREFIX } from '../../common/myinfo-child-subfields'
import { NricFilter } from '../../triggers/new-submission/index'
import {
  type FormSchemaContext,
  NON_ANSWER_FIELD_TYPES,
} from './process-v4-responses'

export type UnresolvedVariableCause = 'question_deleted' | 'unsupported_payload'

export type UnresolvedVariable = {
  path: string
  cause: UnresolvedVariableCause
}

type ClassifyInput = {
  triggerStepId: string
  /** Serialized parameters of the pipe's action steps. */
  parameters: string[]
  fields: Record<string, Record<string, unknown>>
  schema: FormSchemaContext
  rawVerifiedKeys: string[]
  verifiedSubmitterInfo: Record<string, string>
  nricFilter: unknown
}

const NRIC_VERIFIED_KEYS = new Set(['uinFin', 'sgidUinFin'])

function referencedPaths(triggerStepId: string, parameters: string[]) {
  const pattern = new RegExp(
    `{{step\\.${triggerStepId}\\.([\\da-zA-Z-_ .]+?)(?:\\|[a-fA-F0-9]+)?}}`,
    'g',
  )
  const paths = new Set<string>()
  for (const serialized of parameters) {
    for (const match of serialized.matchAll(pattern)) {
      paths.add(match[1])
    }
  }
  return paths
}

function classifyField(
  fieldKey: string,
  property: string | undefined,
  input: ClassifyInput,
): UnresolvedVariableCause | null {
  const field = input.fields[fieldKey]
  if (field) {
    if (!property) {
      return null
    }
    const value = field[property]
    return value === undefined || value === 'undefined'
      ? 'unsupported_payload'
      : null
  }

  const [prefix, parentId] = fieldKey.split('_')
  const isChildSubfield = prefix === CHILDREN_KEY_PREFIX && !!parentId
  const schemaField = input.schema.fields.find(
    (f) => f._id === (isChildSubfield ? parentId : fieldKey),
  )
  if (!schemaField) {
    return 'question_deleted'
  }
  // A submission can legitimately leave these out: a later child index, a
  // removed NRIC, a non-answer field or an MRF step not reached yet.
  const omittedOnPurpose =
    isChildSubfield ||
    NON_ANSWER_FIELD_TYPES.has(schemaField.fieldType) ||
    (schemaField.fieldType === 'nric' &&
      input.nricFilter === NricFilter.Remove) ||
    (input.schema.restorableIds !== null &&
      !input.schema.restorableIds.has(schemaField._id))
  return omittedOnPurpose ? null : 'unsupported_payload'
}

function classifyVerifiedKey(
  key: string,
  input: ClassifyInput,
): UnresolvedVariableCause | null {
  if (key in input.verifiedSubmitterInfo) {
    return null
  }
  if (NRIC_VERIFIED_KEYS.has(key) && input.nricFilter === NricFilter.Remove) {
    return null
  }
  // A raw key that only extends the referenced one means FormSG renamed it.
  // Any other gap means the form's login type changed.
  return input.rawVerifiedKeys.some((raw) => raw.startsWith(key))
    ? 'unsupported_payload'
    : null
}

export function classifyUnresolvedVariables(
  input: ClassifyInput,
): UnresolvedVariable[] {
  const unresolved: UnresolvedVariable[] = []
  for (const path of referencedPaths(input.triggerStepId, input.parameters)) {
    const [root, key, property] = path.split('.')
    let cause: UnresolvedVariableCause | null = null
    if (root === 'fields' && key) {
      cause = classifyField(key, property, input)
    } else if (root === 'verifiedSubmitterInfo' && key) {
      cause = classifyVerifiedKey(key, input)
    }
    if (cause) {
      unresolved.push({ path, cause })
    }
  }
  return unresolved
}

/**
 * Flags pipe variables that this submission leaves empty.
 *
 * Separates a question the user deleted from a FormSG payload change Plumber
 * does not handle yet. The second needs an engineer.
 */
export async function reportUnresolvedVariables(
  $: IGlobalVariable,
  formId: string,
  input: Omit<ClassifyInput, 'parameters' | 'triggerStepId' | 'nricFilter'>,
): Promise<void> {
  try {
    const actionSteps = await Step.query()
      .where({ flow_id: $.flow.id, type: 'action' })
      .select('parameters')
    const unresolved = classifyUnresolvedVariables({
      ...input,
      triggerStepId: $.step.id,
      parameters: actionSteps.map((step) => JSON.stringify(step.parameters)),
      nricFilter: $.step.parameters.nricFilter,
    })
    for (const { path, cause } of unresolved) {
      incrementMetric('formsg.unresolved_variable', { cause })
      logger.warn('FormSG submission leaves a pipe variable empty', {
        event: 'formsg-unresolved-variable',
        cause,
        path,
        formId,
        flowId: $.flow.id,
        stepId: $.step.id,
      })
    }
  } catch (error) {
    logger.error('Unable to check FormSG variables', {
      event: 'formsg-unresolved-variable-check-failed',
      formId,
      flowId: $.flow.id,
      error,
    })
  }
}
