export const getHeaderWidth = (
  isDrawerOpen?: boolean,
  isMobile?: boolean,
  isNested?: boolean,
) => {
  if (isDrawerOpen) {
    if (isMobile) {
      return '0px'
    }
    return '100%'
  }

  if (isMobile) {
    return '100%'
  }

  return isNested ? 'full' : '55rem'
}
