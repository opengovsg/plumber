import { createContext } from 'react'
import type { IconType } from 'react-icons'

export type SelectMenuOverride = {
  // CSS selector of an ancestor of the select. The menu takes that element's
  // width and left edge instead of the input's.
  anchorSelector?: string
  // Replaces the read-only hint row shown for inline "add new" options.
  hintLabel?: string
  // Renders that hint as plain small text, without the grey row background.
  compactHint?: boolean
  // Replaces the toggle chevron, e.g. to match the stroke of neighbouring icons.
  chevronIcons?: { open: IconType; closed: IconType }
}

export const SelectMenuOverrideContext = createContext<
  SelectMenuOverride | undefined
>(undefined)
