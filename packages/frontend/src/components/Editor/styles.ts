import { FlexProps } from '@chakra-ui/react'

import { EDITOR_MAX_HEIGHT, EDITOR_RIGHT_DRAWER_WIDTH } from './constants'

export const editorStyles = {
  editorWrapper: {
    w: 'full',
    overflowX: 'hidden' as FlexProps['overflowX'],
    justifyContent: 'center',
    pos: 'relative' as FlexProps['pos'],
  },
  stepHeaderContainer: {
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
  dummyRightContainer: {
    pos: 'relative' as FlexProps['pos'],
    maxHeight: EDITOR_MAX_HEIGHT,
    h: EDITOR_MAX_HEIGHT,
    overflow: 'hidden' as FlexProps['overflow'],
    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
    border: 'none',
  },
  rightDrawerContainer: {
    flexDir: 'column' as FlexProps['flexDir'],
    position: 'absolute' as FlexProps['position'],
    bg: 'white',
    borderRadius: 'none',
    borderLeftWidth: '1px',
    borderLeftColor: 'base.divider.medium',
    opacity: 0,
    right: 0,
    minWidth: EDITOR_RIGHT_DRAWER_WIDTH,
    maxHeight: EDITOR_MAX_HEIGHT,
    h: EDITOR_MAX_HEIGHT,
    overflowY: 'auto' as FlexProps['overflowY'],
    transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
  },
}
