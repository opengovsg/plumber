export const Button = {
  defaultProps: {
    colorScheme: 'primary',
  },
  variants: {
    solid: {
      bg: 'primary.500',
      _hover: {
        bg: 'primary.600',
        borderColor: 'primary.600',
      },
      _active: {
        bg: 'primary.700',
        borderColor: 'primary.700',
      },
    },
    link: {
      color: 'secondary.800',
      textDecoration: 'none',
      _hover: {
        color: 'primary.600',
      },
    },
  },
}
