export const pulsingBoxStyles = {
  animation: 'pulse 2s infinite',
  '@keyframes pulse': {
    '0%': {
      boxShadow: '#f9dde9 0px 0px 0px 0px',
      transform: 'scale(1)',
    },
    '70%': {
      boxShadow: '#f9dde9 0px 0px 0px 3px',
      transform: 'scale(1.02)',
    },
    '100%': {
      transform: 'scale(1)',
    },
  },
}
