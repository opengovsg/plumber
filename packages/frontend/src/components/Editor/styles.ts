import { FlexProps } from '@chakra-ui/react'

export const EDITOR_MARGIN_TOP = '61px'
export const EDITOR_MAX_HEIGHT = `calc(100vh - ${EDITOR_MARGIN_TOP})`

export const editorStyles = {
  container: {
    display: 'block',
    flexDir: 'column' as FlexProps['flexDir'],
    alignItems: 'center',
    height: EDITOR_MAX_HEIGHT,
    minH: '100%',
    maxW: 'full',
    overflowY: 'auto' as FlexProps['overflowY'],
    py: '40px',
    px: 0,
    transition: 'width 0.3s ease-in-out, transform 0.3s ease-in-out',
    w: '100%',
  },
}
