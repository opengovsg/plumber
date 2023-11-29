import { defineStyleConfig } from '@chakra-ui/react'

export const Text = defineStyleConfig({
  baseStyle: {
    a: {
      color: 'primary.500',
      _hover: {
        textDecoration: 'underline',
      },
    },
  },
})
