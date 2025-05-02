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
      cursor: 'pointer',
    },
    _active: {
      bg: 'interaction.muted.neutral.active',
    },
  },
}

export const branchStyles = {
  container: {
    alignItems: 'center',
    bg: 'white',
    borderColor: 'base.divider.medium',
    borderRadius: 'lg',
    borderWidth: '1px',
    direction: 'column' as FlexProps['direction'],
    overflow: 'hidden',
    px: 4,
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
    m: 1,
    mb: 0,
    transition: 'all 0.3s ease',
  },
  button: {
    pos: 'absolute' as FlexProps['pos'],
    opacity: 1,
    transition: 'height 0.2s ease-in-out',
    w: 'full',
    variant: 'clear',
    size: 'xs',
    borderRadius: 'lg',
  },
}
