export const Button = {
  defaultProps: {
    colorScheme: 'primary',
  },
  variants: {
    link: {
      color: 'secondary.800',
      textDecoration: 'none',
      textDecorationLine: 'none',
      _hover: {
        color: 'primary.600',
        textDecorationLine: 'none',
      },
    },
  },
}
