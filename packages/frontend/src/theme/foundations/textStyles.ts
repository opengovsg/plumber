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
  'body-2': {
    fontWeight: 400,
    lineHeight: '1.25rem',
    fontSize: '0.875rem',
    letterSpacing: 0,
    fontFamily: 'body',
  },
  h4: {
    fontWeight: 600,
    lineHeight: '2rem',
    fontSize: '1.5rem',
    letterSpacing: '-0.019em',
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
