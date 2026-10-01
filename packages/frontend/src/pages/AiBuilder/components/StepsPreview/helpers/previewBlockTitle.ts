import type { IJSONObject } from '@plumber/types'

import type { ResolveVariableLabel } from '@/components/FlowStepGroup/helpers/buildConditionSentence'
import { buildConditionSentence } from '@/components/FlowStepGroup/helpers/buildConditionSentence'
import {
  type ConditionPreviewPart,
  getConditionBlockPreviewParts,
  getForEachBlockPreviewParts,
} from '@/components/FlowStepGroup/helpers/getConditionBlockPreview'

import type { PreviewStep } from './previewItems'

const SPECIFY_CONDITION = 'Specify condition'
const SPECIFY_LIST = 'Specify list'

const NO_LABEL: ResolveVariableLabel = () => undefined

function sentence(
  parts: ConditionPreviewPart[],
  resolveVariableLabel: ResolveVariableLabel,
): string {
  return buildConditionSentence('', parts, resolveVariableLabel)
    .parts.map((part) => part.display)
    .join('')
    .trim()
}

function branchName(step: PreviewStep): string {
  const name = step.parameters?.branchName
  return typeof name === 'string' ? name.trim() : ''
}

/**
 * Header text for an If block. A saved condition wins. Before the pipe
 * exists the only label is the proposal's branch name.
 */
export function getIfBlockPreviewTitle(
  step: PreviewStep,
  resolveVariableLabel: ResolveVariableLabel = NO_LABEL,
): string {
  const text = sentence(
    getConditionBlockPreviewParts(step.parameters as IJSONObject),
    resolveVariableLabel,
  )
  if (text && text !== SPECIFY_CONDITION) {
    return text
  }
  return branchName(step) || step.description?.trim() || SPECIFY_CONDITION
}

/**
 * Header text for a Repeat block. A saved list wins. A proposal only has
 * the step description until the list is chosen.
 */
export function getRepeatBlockPreviewTitle(
  step: PreviewStep,
  resolveVariableLabel: ResolveVariableLabel = NO_LABEL,
): string {
  const text = sentence(
    getForEachBlockPreviewParts(step.parameters as IJSONObject),
    resolveVariableLabel,
  )
  if (text && text !== SPECIFY_LIST) {
    return text
  }
  return step.description?.trim() || SPECIFY_LIST
}
