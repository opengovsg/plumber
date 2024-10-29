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
  header: {
    fontSize: 'lg',
    fontWeight: 'bold',
  },
  dialog: {
    margin: 'auto',
  },
})

export const Modal = defineMultiStyleConfig({
  baseStyle,
})
