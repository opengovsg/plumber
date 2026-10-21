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
