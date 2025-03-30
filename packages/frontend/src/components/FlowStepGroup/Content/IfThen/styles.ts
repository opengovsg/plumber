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
