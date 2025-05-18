import { FlexProps } from '@chakra-ui/react'

import { EDITOR_MAX_HEIGHT } from './constants'

export const editorStyles = {
  container: {
    display: 'block',
    flexDir: 'column' as FlexProps['flexDir'],
    alignItems: 'center',
    height: EDITOR_MAX_HEIGHT,
    minH: '100%',
    maxW: 'full',
    overflowY: 'auto' as FlexProps['overflowY'],
    py: 10,
    px: 0,
    transition: 'transform 0.4s cubic-bezier(0.3, 0, 0.2, 1)',
    w: '100%',
  },
  rightDrawerContainer: {
    flexDir: 'column' as FlexProps['flexDir'],
    position: 'relative' as FlexProps['position'],
    bg: 'white',
    borderRadius: 'lg',
    boxShadow: 'lg',
    opacity: 0,
    maxHeight: EDITOR_MAX_HEIGHT,
    h: EDITOR_MAX_HEIGHT,
    overflowY: 'auto' as FlexProps['overflowY'],
    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
  },
}
