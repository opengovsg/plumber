import type { IJSONValue } from '@plumber/types'

import { redactVariables as createFlowWithSteps } from '@/graphql/mutations/ai/create-flow-with-steps.redact'
import { redactVariables as createStep } from '@/graphql/mutations/create-step.redact'
import { redactVariables as duplicateBranch } from '@/graphql/mutations/duplicate-branch.redact'
import { redactVariables as dynamicAction } from '@/graphql/mutations/dynamic-action.redact'
import { redactVariables as updateStep } from '@/graphql/mutations/update-step.redact'

import { REDACTED } from './sensitive-keys'

export type RedactVariables = (variables: IJSONValue) => IJSONValue

/** For operations whose every variable is a secret. */
const redactEverything: RedactVariables = () => REDACTED

/**
 * Keyed by GraphQL root field name. Redaction is opt-in, so an operation absent
 * here logs its variables verbatim.
 */
export const OPERATION_REDACTIONS: Record<string, RedactVariables> = {
  createConnection: redactEverything,
  updateConnection: redactEverything,
  setTableViewPassword: redactEverything,
  verifyTableViewPassword: redactEverything,
  createStep,
  updateStep,
  duplicateBranch,
  dynamicAction,
  createFlowWithSteps,
}
