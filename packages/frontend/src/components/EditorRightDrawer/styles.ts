import { FlexProps } from '@chakra-ui/react'

export const editorRightDrawerStyles = {
  stepHeader: {
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'fixed' as FlexProps['position'],
    w: 'full',
    px: '6',
    height: '2rem',
    // Lines the title up with the first step card in the pipe panel.
    mt: '5',
  },
  stepContentsWrapper: {
    height: 'calc(100% - 2.75rem)',
    overflowY: 'auto' as FlexProps['overflowY'],
    overflowX: 'hidden' as FlexProps['overflowX'],
    position: 'relative' as FlexProps['position'],
    px: '6',
    top: '3.75rem',
  },
}
