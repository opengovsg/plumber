import { radioAnatomy } from '@chakra-ui/anatomy'
import { createMultiStyleConfigHelpers } from '@chakra-ui/react'

const { defineMultiStyleConfig } = createMultiStyleConfigHelpers(
  radioAnatomy.keys,
)

export const Radio = defineMultiStyleConfig({
  baseStyle: {
    container: {
      _hover: {
        bg: 'interaction.muted.neutral.hover',
      },
      _focusWithin: {
        outline: 0,
      },
    },
  },
})
