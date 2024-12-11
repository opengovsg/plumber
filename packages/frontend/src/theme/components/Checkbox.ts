import { defineStyleConfig } from '@chakra-ui/react'

// define the base component styles
const baseStyle = {
  control: {
    alignSelf: 'center',
  },
  label: {
    width: '100%',
    justifyContent: 'space-between',
  },
}

export const Checkbox = defineStyleConfig({ baseStyle })
