// Plumber is based on BbBear; importing only text styles we use to reduce
// distro size.
// Imported from BbBear generated on Fri, 23 Jun 2023 09:14:33 GMT
const bbBearTextStyles = {
  'subhead-1': {
    fontWeight: 500,
    lineHeight: '1.5rem',
    fontSize: '1rem',
    letterSpacing: '-0.006em',
    fontFamily: 'body',
  },
  'subhead-2': {
    fontWeight: 500,
    lineHeight: '1.25rem',
    fontSize: '0.875rem',
    letterSpacing: 0,
    fontFamily: 'body',
  },
  'subhead-3': {
    fontWeight: 600,
    lineHeight: '1.5rem',
    fontSize: '0.875rem',
    letterSpacing: '0.080em',
    fontFamily: 'body',
    textTransform: 'uppercase',
  },
  'body-1': {
    fontWeight: 400,
    lineHeight: '1.5rem',
    fontSize: '1rem',
    letterSpacing: '-0.006em',
    fontFamily: 'body',
  },
  'body-2': {
    fontWeight: 400,
    lineHeight: '1.25rem',
    fontSize: '0.875rem',
    letterSpacing: 0,
    fontFamily: 'body',
  },
  h1: {
    fontWeight: 600,
    lineHeight: '3rem',
    fontSize: '2.5rem',
    letterSpacing: '-0.022em',
    fontFamily: 'body',
  },
  h4: {
    fontWeight: 600,
    lineHeight: '2rem',
    fontSize: '1.5rem',
    letterSpacing: '-0.019em',
    fontFamily: 'body',
  },
  h5: {
    fontWeight: 600,
    lineHeight: '1.75rem',
    fontSize: '1.25rem',
    letterSpacing: '-0.014em',
    fontFamily: 'body',
  },
  h6: {
    fontWeight: 500,
    lineHeight: '1.5rem',
    fontSize: '1.125rem',
    letterSpacing: '-0.014em',
    fontFamily: 'body',
  },
}

export const textStyles = {
  ...bbBearTextStyles,
  logo: {
    fontFamily: `'Space Grotesk', sans-serif`,
    fontWeight: 700,
    fontSize: { base: 26, md: 32 },
    letterSpacing: 0,
    color: 'black',
  },
  heading: {
    fontFamily: 'Inter, sans-serif',
    fontWeight: 700,
    fontSize: { base: 40, md: 56 },
    color: '#2C2E34',
    lineHeight: 1.1,
  },
  subheading: {
    fontFamily: 'Inter, sans-serif',
    fontWeight: 600,
    fontSize: { base: 24, md: 36 },
    color: '#2C2E34',
    letterSpacing: -1,
  },
}
