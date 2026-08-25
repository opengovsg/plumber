// Single source of truth for folder colours. Every folder colour dot, chip,
// or swatch in the app must be derived from this map — nothing else should
// define a folder colour or hard-code one of these hexes.
export const FOLDER_COLOR_KEYS = [
  'magenta',
  'teal',
  'slate',
  'amber',
  'red',
  'blue',
] as const

export type FolderColor = (typeof FOLDER_COLOR_KEYS)[number]

interface FolderColorToken {
  // Human-readable label, used for swatch aria-labels.
  label: string
  // Solid theme colour for the folder dot / swatch fill.
  dot: string
  // Light theme tint, used for chip backgrounds.
  subtle: string
}

export const FOLDER_COLORS: Record<FolderColor, FolderColorToken> = {
  magenta: {
    label: 'Magenta',
    dot: 'primary.500',
    subtle: 'primary.100',
  },
  teal: {
    label: 'Teal',
    dot: 'interaction.success.default',
    subtle: 'interaction.success-subtle.default',
  },
  slate: {
    label: 'Slate',
    dot: 'secondary.500',
    subtle: 'base.divider.medium',
  },
  amber: {
    label: 'Amber',
    dot: 'interaction.warning.default',
    subtle: 'interaction.warning-subtle.default',
  },
  red: {
    label: 'Red',
    dot: 'interaction.critical.default',
    subtle: 'interaction.critical-subtle.default',
  },
  blue: {
    label: 'Blue',
    dot: 'secondary.700',
    subtle: 'secondary.100',
  },
}

export const DEFAULT_FOLDER_COLOR: FolderColor = 'magenta'
