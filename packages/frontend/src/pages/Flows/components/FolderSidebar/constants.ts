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

function isFolderColor(color: string): color is FolderColor {
  return (FOLDER_COLOR_KEYS as readonly string[]).includes(color)
}

// Server data crosses the API boundary as a plain `String!`, so it isn't
// guaranteed to be one of the 6 known tokens (e.g. a future colour added
// server-side before the frontend knows about it). Validate through this
// guard instead of casting - it falls back to `DEFAULT_FOLDER_COLOR` for
// anything unrecognised, rather than indexing `FOLDER_COLORS` with an
// invalid key and crashing on `.dot`/`.subtle`.
export function toFolderColor(color: string): FolderColor {
  return isFolderColor(color) ? color : DEFAULT_FOLDER_COLOR
}

// Convenience wrapper around `toFolderColor` for call sites that just want
// the theme tokens straight away.
export function getFolderColorToken(color: string): FolderColorToken {
  return FOLDER_COLORS[toFolderColor(color)]
}
