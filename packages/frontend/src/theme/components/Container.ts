import { defineStyleConfig } from '@chakra-ui/react'

// define the base component styles
const baseStyle = {
  maxWidth: '1200px',
  padding: '2rem 1rem',
}

// Variants
const variants = {
  page: {
    maxW: 1152,
    py: 0,
  },
}

// export the component theme
export const Container = defineStyleConfig({ baseStyle, variants })
