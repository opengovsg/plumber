import { FlexProps } from '@chakra-ui/react'

export const flowStepStyles = {
  container: {
    alignItems: 'center',
    bg: 'white',
    borderWidth: '1px',
    borderRadius: 'lg',
    justifyContent: 'center',
    overflow: 'hidden',
    p: 0,
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
    w: 'full',
    _hover: {
      bg: 'interaction.muted.neutral.hover',
      cursor: 'pointer',
      borderBottomRadius: 'inherit',
    },
    _active: {
      bg: 'interaction.muted.neutral.active',
      borderBottomRadius: 'inherit',
    },
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
