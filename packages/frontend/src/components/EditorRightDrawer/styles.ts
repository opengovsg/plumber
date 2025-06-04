import { FlexProps } from '@chakra-ui/react'

export const editorRightDrawerStyles = {
  stepHeader: {
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'fixed' as FlexProps['position'],
    w: 'full',
    px: '6',
    height: '2rem',
  },
  stepContentsWrapper: {
    height: 'calc(100% - 1.5rem)',
    overflowY: 'auto' as FlexProps['overflowY'],
    overflowX: 'hidden' as FlexProps['overflowX'],
    position: 'relative' as FlexProps['position'],
    px: '6',
    top: '2.5rem',
  },
}
