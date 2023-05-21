import { defineStyleConfig } from '@chakra-ui/react'

// define the base component styles
const baseStyle = {
  maxWidth: '1200px',
  padding: '2rem 1rem',
}

// export the component theme
export const Container = defineStyleConfig({ baseStyle })
