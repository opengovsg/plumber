// Plumber is based on BbBear; importing only colors we use to reduce distro
// size.
// Imported from BbBear generated on Fri, 23 Jun 2023 09:14:33 GMT
const bbBearColors = {
  base: {
    divider: {
      medium: '#EDEDED',
      strong: '#BFC2C8',
    },
    content: {
      default: '#454953',
      medium: '#666C7A',
    },
  },
  interaction: {
    muted: {
      neutral: {
        hover: '#F8F9F9',
        active: '#EDEDED',
      },
    },
    success: {
      default: '#0F796F',
    },
  },
}

const colors = {
  ...bbBearColors,
  primary: {
    '50': '#FEF8FB',
    '100': '#F9DDE9',
    '200': '#F0B0CA',
    '300': '#E886AE',
    '400': '#DF588F',
    '500': '#CF1A68',
    '600': '#AA004B',
    '700': '#95003B',
    '800': '#80002C',
    '900': '#630019',
  },
  secondary: {
    '50': '#f8f9fa',
    '100': '#e9eaee',
    '200': '#babecb',
    '300': '#9aa0b3',
    '400': '#7b849c',
    '500': '#5d6785',
    '600': '#465173',
    '700': '#3c4764',
    '800': '#333c56',
    '900': '#272d41',
  },
  utility: {
    // Filled in below...
  },
}

colors.utility = {
  focus: {
    default: colors.primary['600'],
  },
  'focus-default': colors.primary['600'],
}

export { colors }
