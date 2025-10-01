import { FlexProps } from '@chakra-ui/react'

export const editorSettingsStyles = {
  editorSettingsWrapper: {
    py: { base: '2rem', md: '3rem' },
    px: { base: '1.5rem', md: '5rem' },
    flexDir: 'column' as FlexProps['flexDir'],
    gap: 10,
    maxW: { base: '100%', xl: '60vw' },
    flex: 1,
  },
}
