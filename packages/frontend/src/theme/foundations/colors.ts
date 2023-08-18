import { theme } from '@opengovsg/design-system-react'

const colors = {
  ...theme.colors,
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
  line: {
    light: '#ededed',
    dark: '#bfc2c8',
  },
  badge: {
    green: '#0f796f',
    yellow: '#ffda68',
  },
}

colors.utility = {
  focus: {
    default: colors.primary['600'],
  },
  'focus-default': colors.primary['600'],
}

export { colors }
