import { createMultiStyleConfigHelpers } from '@chakra-ui/react'

const { defineMultiStyleConfig } = createMultiStyleConfigHelpers(['helperText'])

export const Form = defineMultiStyleConfig({
  baseStyle: {
    // FormHelperText
    helperText: {
      mb: 2,
      fontSize: 'xs',
    },
  },
})
