import { FlexProps } from '@chakra-ui/react'

// Exported so a container that must align with a nested step it owns — an
// if-then V2 block levelling its drag handle with its header — stays in sync
// with the card's real height.
export const NESTED_FLOW_STEP_HEIGHT = '56px'

export const flowStepStyles = {
  container: {
    alignItems: 'center',
    bg: 'white',
    borderWidth: '1px',
    borderRadius: 'lg',
    justifyContent: 'center',
    overflow: 'hidden',
    p: 0,
    _hover: {
      bg: 'interaction.muted.neutral.hover',
      '& .hover-remove-button': {
        visibility: 'visible',
      },
      cursor: 'pointer',
    },
  },
  incompleteContainer: {
    alignItems: 'center',
    bg: 'yellow.50',
    borderWidth: '1px',
    borderBottomWidth: '0px',
    borderRadius: 'lg',
    borderBottomRadius: 'none',
    overflow: 'hidden',
    p: 0,
    px: 4,
  },
  topHeader: {
    alignItems: 'center',
    borderRadius: 'inherit',
    px: 4,
    py: 4,
    w: 'full',
  },
  appIconWrapper: {
    alignItems: 'center',
    borderColor: 'base.divider.strong',
    borderWidth: 0,
    justifyContent: 'center',
    mr: 4,
    position: 'relative' as FlexProps['position'],
  },
}

// A selected step thickens its border from 1px to 1.5px. Growing the box by the
// extra half pixel on every side keeps the content where it was, so selecting a
// step never shifts it.
export const SELECTED_BORDER_WIDTH = '1.5px'
export const SELECTED_BORDER_GROWTH = '0.5px'

export const growBox = (size: string | undefined): string | undefined =>
  size
    ? `calc(${size === 'full' ? '100%' : size} + 2 * ${SELECTED_BORDER_GROWTH})`
    : undefined

// Banners that sit on top of a selected card carry the same thicker border.
export const bannerFrameStyles = (isSelected: boolean, width: string) =>
  isSelected
    ? {
        borderWidth: SELECTED_BORDER_WIDTH,
        borderBottomWidth: 0,
        mx: `-${SELECTED_BORDER_GROWTH}`,
        mt: `-${SELECTED_BORDER_GROWTH}`,
        w: growBox(width),
      }
    : { borderWidth: '1px', borderBottomWidth: 0, w: width }
