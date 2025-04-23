export const getFlowStepWidth = (isDrawerOpen: boolean, isMobile: boolean) => {
  if (isDrawerOpen) {
    return isMobile ? '0px' : '100%'
  }
  return isMobile ? '100vw' : '55%'
}
