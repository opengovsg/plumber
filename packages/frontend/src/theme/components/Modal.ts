import { modalAnatomy as parts } from '@chakra-ui/anatomy'
import { createMultiStyleConfigHelpers } from '@chakra-ui/styled-system'

const { definePartsStyle, defineMultiStyleConfig } =
  createMultiStyleConfigHelpers(parts.keys)

const baseStyle = definePartsStyle({
  overlay: {
    bg: 'transparent',
    backdropFilter: 'auto',
    backdropBlur: '2px',
  },
})

export const Modal = defineMultiStyleConfig({
  baseStyle,
})
