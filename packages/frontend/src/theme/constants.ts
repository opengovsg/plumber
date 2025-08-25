// to reduce transition effects
export const POPOVER_MOTION_PROPS = {
  variants: {
    exit: {
      opacity: 0,
      transition: {
        duration: 0,
      },
    },
    enter: {
      opacity: 1,
      transition: {
        duration: 0,
      },
    },
  },
}

export const POPOVER_OPACITY_MOTION_PROPS = {
  variants: {
    exit: {
      opacity: 0,
      transition: {
        duration: 0.2,
      },
    },
    enter: {
      opacity: 1,
      transition: {
        duration: 0.2,
      },
    },
  },
}
