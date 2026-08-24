import type { ConditionPreviewPart } from './getConditionBlockPreview'
import { truncateConditionLabel } from './truncateConditionLabel'

/** A preview part paired with the text the header should actually render. */
export type ConditionSentencePart = ConditionPreviewPart & { display: string }

export interface ConditionSentence {
  parts: ConditionSentencePart[]
  /** The whole sentence, untruncated, for the tooltip. */
  fullSentence: string
  /**
   * Whether a leading part was shortened. Trailing parts are cut by layout
   * instead, which only the rendered box can report.
   */
  isLeadingTruncated: boolean
}

/**
 * Resolves a variable's real label from its `{{step.<id>.<path>}}` reference,
 * or undefined when it can't be resolved.
 */
export type ResolveVariableLabel = (id: string) => string | undefined

/**
 * Turns preview parts into what the header renders.
 *
 * A variable part's own `label` is only the last segment of its dataOut path —
 * `answer` for every FormSG question, a raw column UUID for every Tile — so the
 * real label is resolved through `resolveVariableLabel`, backed by the same
 * metadata the variable picker and the rich-text pills use. That metadata comes
 * from the pipe's last test execution, so an untested pipe resolves nothing and
 * falls back to the path segment.
 *
 * Only leading parts are length-capped. A trailing part is last in the
 * sentence, so letting it run on hides nothing — the block's width and its
 * two-line clamp cut it at whatever the card can actually show. Spill from a
 * leading part would instead push the operator and the value out of view.
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
