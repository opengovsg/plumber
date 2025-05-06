export const stepHeaderBoxStyles = {
  bg: 'white',
  borderRadius: 'lg',
  borderWidth: '1px',
  overflow: 'hidden',
  p: 0,
  _hover: {
    bg: 'interaction.muted.neutral.hover',
    '& .hover-remove-button': {
      visibility: 'visible',
    },
  },
  _active: {
    bg: 'interaction.muted.neutral.active',
  },
}
