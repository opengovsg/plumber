import { PositionProps, StackProps } from '@chakra-ui/react'

export const flowStepTestControllerStyles = {
  container: {
    direction: 'row' as StackProps['direction'],
    spacing: 4,
    p: '1rem',
    justify: 'flex-end',
    borderTop: '1px solid',
    borderTopColor: 'base.divider.medium',
    bg: 'white',
    position: 'sticky' as PositionProps['position'],
    bottom: 0,
    zIndex: 1,
    w: '100%',
  },
  testedInfobox: {
    w: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 'lg',
    size: 'md',
  },
}
