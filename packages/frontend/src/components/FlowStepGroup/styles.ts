import { FlexProps, PositionProps } from '@chakra-ui/react'

export const flowStepGroupStyles = {
  container: {
    flexDir: 'column' as FlexProps['flexDir'],
    alignItems: 'center',
    borderWidth: '1px',
    borderColor: 'base.divider.medium',
    borderRadius: 'lg',
    borderTopRadius: 'lg',
  },

  header: {
    borderRadius: 'lg',
    p: 0,
    bg: 'white',
    overflow: 'hidden',
  },

  iconWrapper: {
    position: 'relative' as PositionProps['position'],
    boxSize: 10,
    mr: 4,
    borderWidth: 0,
    borderColor: 'base.divider.strong',
    justifyContent: 'center',
    alignItems: 'center',
  },
}
