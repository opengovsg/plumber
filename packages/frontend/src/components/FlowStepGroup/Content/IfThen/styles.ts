import { FlexProps } from '@chakra-ui/react'

export const ifThenStyles = {
  addBranchButton: {
    alignItems: 'center',
    bg: 'white',
    borderWidth: '1px',
    borderColor: 'base.divider.medium',
    borderRadius: 'lg',
    gap: 2,
    justifyContent: 'flex-start',
    overflow: 'hidden',
    px: 4,
    py: 2,
    variant: 'outline',
    w: 'full',
    _hover: {
      bg: 'interaction.muted.neutral.hover',
    },
    _active: {
      bg: 'interaction.muted.neutral.active',
    },
    _disabled: {
      borderColor: 'base.divider.light',
      color: 'base.content.medium',
      cursor: 'not-allowed',
      _hover: { bg: 'white' },
    },
  },
}

/**
 * `boxSize` alone isn't enough: IconButton's own size sets a larger
 * min-width/min-height that wins, so both are pinned here too — the same way
 * DeleteStepButton does for a step.
 */
export const blockActionButtonStyles = {
  boxSize: 8,
  minW: 8,
  minH: 8,
  variant: 'clear',
  colorScheme: 'secondary',
}

export const branchStyles = {
  container: {
    alignItems: 'center',
    bg: '#f8f9f9',
    borderRadius: 'lg',
    direction: 'column' as FlexProps['direction'],
    overflow: 'hidden',
    px: 3,
    py: 3,
    w: '100%',
  },
}

export const hoverAddStepButtonStyles = {
  container: {
    role: 'group',
    w: 'full',
    pos: 'relative' as FlexProps['pos'],
    alignItems: 'center',
    justifyContent: 'center',
    direction: 'row' as FlexProps['direction'],
    my: 1,
    mx: 0,
    transition: 'all 0.3s ease',
    // IMPORTANT: some Flex column parents (see the `w` prop in
    // HoverAddStepButton) don't set alignItems="center" and default to
    // stretch, which would pull this connector off the flow's centre line.
    // alignSelf keeps it centred regardless of the parent.
    alignSelf: 'center',
  },
  button: {
    pos: 'absolute' as FlexProps['pos'],
    opacity: 1,
    transition: 'height 0.2s ease-in-out',
    w: 'full',
    variant: 'clear',
    size: 'xs',
    borderRadius: 'lg',
    left: 0,
  },
}
