import type { ConditionPreviewPart } from './getConditionBlockPreview'
import { truncateConditionLabel } from './truncateConditionLabel'

export type ConditionSentencePart = ConditionPreviewPart & { display: string }

export interface ConditionSentence {
  parts: ConditionSentencePart[]
  fullSentence: string
  /** Whether a leading part was shortened. Only layout cuts trailing parts. */
  isLeadingTruncated: boolean
}

/** Resolves a variable's real label from its `{{step.<id>.<path>}}` id. */
export type ResolveVariableLabel = (id: string) => string | undefined

/**
 * Turns preview parts into what the header renders.
 *
 * IMPORTANT: a variable part's `label` is only the last path segment, so the
 * real label comes from `resolveVariableLabel`.
 */
export function buildConditionSentence(
  badgeLabel: string,
  previewParts: ConditionPreviewPart[],
  resolveVariableLabel: ResolveVariableLabel,
): ConditionSentence {
  let isLeadingTruncated = false
  const plain: string[] = []

  const parts = previewParts.map((part): ConditionSentencePart => {
    if (part.type === 'text' || part.type === 'emphasis') {
      plain.push(part.text)
      return { ...part, display: part.text }
    }

    const full =
      part.type === 'variable'
        ? resolveVariableLabel(part.id) ?? part.label
        : part.text

    plain.push(full)

    if (part.position === 'trailing') {
      return { ...part, display: full }
    }

    const display = truncateConditionLabel(full)
    if (display !== full) {
      isLeadingTruncated = true
    }
    return { ...part, display }
  })

  return {
    parts,
    fullSentence: `${badgeLabel} ${plain.join('').trim()}`,
    isLeadingTruncated,
  }
}
