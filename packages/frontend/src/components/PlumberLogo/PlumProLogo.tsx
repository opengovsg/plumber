import { useId } from 'react'

import styles from './PlumProLogo.module.css'

/**
 * Paths lifted verbatim from the Plumber mark in `@/assets/logo.svg`, so the
 * PlumPro wordmark stays pixel-identical to the standard logo.
 */
const MARK_TOP_BAR = 'M0 0H22.6035V9.64103H0V0Z'
const MARK_STEM =
  'M2.62069 29.6662C2.62069 23.7537 7.58792 18.9607 13.7153 18.9607L22.5341 18.9607V27.7878H18.9747C16.7986 27.7878 14.9011 28.9385 13.9 30.6437L13.7729 30.8438L13.7153 30.9852C13.3506 31.7198 13.1464 32.5428 13.1464 33.4118V47H2.62069V29.6662Z'
const MARK_BOWL =
  'M23.7761 0.0201051C31.6317 0.0201051 38 6.28888 38 13.869C38 21.4492 31.6317 27.718 23.7761 27.718V19.1316H24.0169C26.712 19.1316 28.8967 17.0235 28.8967 14.423C28.8967 11.6941 26.6041 9.43736 23.7761 9.43736V0.0201051Z'

/**
 * The "r" is the mark's own stem glyph, shifted right of the P. The offset is
 * as tight as the bowl allows: any less and the shoulder of the r touches it.
 */
const LETTER_R_OFFSET = 35
const LETTER_R_TRANSFORM = `translate(${LETTER_R_OFFSET} 0)`

/**
 * The "o" is an annulus matching the bowl of the P: outer radius 14, ring
 * thickness 9.2, seated on the same 47 baseline.
 */
const LETTER_O =
  'M74.5 19A14 14 0 1 1 74.5 47A14 14 0 1 1 74.5 19ZM74.5 28.2A4.8 4.8 0 1 0 74.5 37.8A4.8 4.8 0 1 0 74.5 28.2Z'

export default function PlumProLogo(): JSX.Element {
  const id = useId()
  const gradientId = `plumpro-gradient-${id}`
  const sheenGradientId = `plumpro-sheen-${id}`
  const clipId = `plumpro-clip-${id}`

  return (
    <svg
      className={styles.wordmark}
      viewBox="0 0 90 47"
      fill="none"
      role="img"
      aria-label="Plumber Pro"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1="0"
          y1="0"
          x2="90"
          y2="47"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#AA004B" />
          <stop offset="0.55" stopColor="#CF1A68" />
          <stop offset="1" stopColor="#E8558F" />
        </linearGradient>

        <linearGradient
          id={sheenGradientId}
          x1="0"
          y1="0"
          x2="26"
          y2="0"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="0.45" stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="0.55" stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>

        <clipPath id={clipId}>
          <path d={MARK_TOP_BAR} />
          <path d={MARK_STEM} />
          <path d={MARK_BOWL} />
          <path d={MARK_STEM} transform={LETTER_R_TRANSFORM} />
          <path d={LETTER_O} fillRule="evenodd" />
        </clipPath>
      </defs>

      <g fill={`url(#${gradientId})`}>
        <g className={styles.mark}>
          <path d={MARK_TOP_BAR} />
          <path d={MARK_STEM} />
          <path d={MARK_BOWL} />
        </g>

        <g transform={LETTER_R_TRANSFORM}>
          <path className={styles.letterR} d={MARK_STEM} />
        </g>

        <path className={styles.letterO} d={LETTER_O} fillRule="evenodd" />
      </g>

      <g clipPath={`url(#${clipId})`}>
        <rect
          className={styles.sheen}
          x="0"
          y="-10"
          width="26"
          height="67"
          fill={`url(#${sheenGradientId})`}
        />
      </g>
    </svg>
  )
}
