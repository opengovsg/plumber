import { Box, type BoxProps } from '@chakra-ui/react'
import { motion, type MotionProps } from 'framer-motion'
import type { ComponentType } from 'react'

// IMPORTANT: Declaration emit for build:lib cannot name motion()'s inferred type.
export const MotionBox: ComponentType<
  Omit<BoxProps, keyof MotionProps> & MotionProps
> = motion(Box)
