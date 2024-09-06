import React from 'react'
import { BiSolidRocket, BiSolidSmile } from 'react-icons/bi'
import { Badge, BadgeLeftIcon } from '@opengovsg/design-system-react'

export const NEW_FEATURE_TAG = 'feature'
export const NEW_ENHANCEMENT_TAG = 'enhancement'

interface NewsItemTagProps {
  tag: string
}

const newFeatureTag = (
  <Badge
    style={{
      borderRadius: '0.25rem',
      background: '#F9DDE9',
      color: '#CF1A68',
      marginTop: '1rem',
    }}
  >
    <React.Fragment>
      <BadgeLeftIcon as={BiSolidRocket} style={{ marginRight: '0.25rem' }} />
      New feature
    </React.Fragment>
  </Badge>
)

const newEnhancementTag = (
  <Badge
    style={{
      borderRadius: '0.25rem',
      background: '#E9EAEE',
      color: '#5D6785',
      marginTop: '1rem',
    }}
  >
    <React.Fragment>
      <BadgeLeftIcon as={BiSolidSmile} style={{ marginRight: '0.25rem' }} />
      Enhancements
    </React.Fragment>
  </Badge>
)

function displayNewsTag(tag: string): JSX.Element {
  switch (tag) {
    case NEW_FEATURE_TAG:
      return newFeatureTag
    case NEW_ENHANCEMENT_TAG:
      return newEnhancementTag
    default:
      return <></>
  }
}

export default function NewsItemTag(props: NewsItemTagProps) {
  const { tag } = props
  return <>{displayNewsTag(tag)}</>
}
