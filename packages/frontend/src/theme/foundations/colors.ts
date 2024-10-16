// Plumber is based on BbBear; importing only colors we use to reduce distro
// size.
// Imported from BbBear generated on Fri, 23 Jun 2023 09:14:33 GMT
const bbBearColors = {
  grey: {
    '900': '#2C2E34',
  },
  base: {
    canvas: {
      'brand-subtle': '#fef8fb',
      inverse: '#3A3E46',
      overlay: 'rgba(58, 62, 70, 0.8)',
    },
    divider: {
      subtle: '#F8F9F9',
      medium: '#EDEDED',
      strong: '#BFC2C8',
      inverse: '#ffffff',
      brand: '#cf1a68',
    },
    content: {
      default: '#454953',
      strong: '#2C2E34',
      medium: '#666C7A',
      brand: '#cf1a68',
    },
  },
  interaction: {
    muted: {
      main: {
        hover: '#fef8fb',
        active: '#F9DDE9',
      },
      neutral: {
        hover: '#F8F9F9',
        active: '#EDEDED',
      },
    },
    sub: {
      default: '#5D6785',
    },
    'sub-subtle': {
      default: '#e9eaee',
      hover: '#babecb',
      active: '#9aa0b3',
    },
    success: {
      default: '#0F796F',
    },
    'success-subtle': {
      default: '#E2EEED',
    },
    support: {
      'disabled-content': '#A0A4AD',
    },
    warning: {
      default: '#FFDA68',
      hover: '#E2B73E',
      active: '#C4992A',
    },
    'warning-subtle': {
      default: '#fffae1',
      hover: '#FFDA68',
      active: '#E2B73E',
    },
    critical: {
      default: '#c03434',
      hover: '#992a2a',
      active: '#852424',
    },
    'critical-subtle': {
      default: '#FBE9E9',
      hover: '#f4acac',
      active: '#ee8080',
    },
    tinted: {
      main: {
        hover: 'rgba(207, 26, 104, 0.04)',
        active: 'rgba(207, 26, 104, 0.12)',
      },
    },
    'main-subtle': {
      default: '#FFF0F7',
    },
    links: {
      default: '#cf1a68',
      hover: '#aa004b',
      'neutral-default': '#454953',
      'neutral-hover': '#2C2E34',
    },
  },
}

const colors = {
  ...bbBearColors,
  primary: {
    '50': '#fef8fb',
    '100': '#F9DDE9',
    '200': '#f0b0ca',
    '300': '#e886ae',
    '400': '#df588f',
    '500': '#cf1a68',
    '600': '#aa004b',
    '700': '#95003b',
    '800': '#80002c',
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
    default: colors.primary['500'],
  },
  'focus-default': colors.primary['500'],
}

export { colors }
