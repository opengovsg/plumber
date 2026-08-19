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

/**
 * The card a condition block (IF / CONTINUE IF / REPEAT) draws: a grey header
 * strip flush to the top and side edges, over a white body holding the steps.
 * Distinct from `branchStyles`, which an if-then V1 branch still uses.
 */
export const conditionBlockStyles = {
  // No padding of its own, so the header can sit flush. Body padding lives on
  // `body` instead.
  container: {
    alignItems: 'stretch',
    bg: 'white',
    borderRadius: 'lg',
    direction: 'column' as FlexProps['direction'],
    overflow: 'hidden',
    w: '100%',
  },
  header: {
    bg: 'base.divider.subtle',
    borderRadius: 'none',
    px: 4,
    py: 3,
    minH: 12,
    w: '100%',
  },
  body: {
    alignItems: 'stretch',
    bg: 'white',
    direction: 'column' as FlexProps['direction'],
    px: 3,
    pt: 4,
    pb: 0,
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
