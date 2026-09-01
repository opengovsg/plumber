import { type ReactNode } from 'react'
import { Components } from 'react-markdown'
import {
  Box,
  chakra,
  Image,
  ModalBody,
  ModalHeader,
  Text,
} from '@chakra-ui/react'
import { RequireExactlyOne } from 'type-fest'

import MarkdownRenderer from '@/components/MarkdownRenderer'

const Video = chakra('video')

type AnnouncementItemMultimedia = RequireExactlyOne<
  {
    url: string
    videoSrc: string
  },
  'url' | 'videoSrc'
>

export interface AnnouncementItemProps {
  title: string
  details: string
  multimedia?: AnnouncementItemMultimedia
}

const mdComponents: Components = {
  li: ({ node, ...props }) => {
    // Check if this is a top-level <ul>
    const isTopLevel =
      !node.position?.start?.offset || node.position.start.column === 1

    return (
      <li
        {...props}
        style={{
          listStyleType: isTopLevel ? 'none' : 'disc',
          lineHeight: '1.75',
          paddingLeft: isTopLevel ? '0' : '0.5rem',
          marginLeft: isTopLevel ? '-1rem' : '0rem',
        }}
      />
    )
  },
}

export default function AnnouncementItem(props: AnnouncementItemProps) {
  const { title, details, multimedia } = props

  let displayedMultimedia: ReactNode
  if (multimedia?.videoSrc) {
    displayedMultimedia = (
      <Video
        borderTopRadius="lg"
        w="100%"
        // Reserve the 16:9 box the 1920x1080 sources fill, so the modal
        // doesn't reflow once the video's metadata arrives
        aspectRatio={16 / 9}
        objectFit="cover"
        src={multimedia.videoSrc}
        preload="auto"
        title={title}
        // muted is required for autoplay to be allowed by browsers
        autoPlay
        muted
        loop
        playsInline
      />
    )
  } else if (multimedia?.url) {
    displayedMultimedia = (
      <Image
        borderTopRadius="lg"
        fit="fill"
        src={multimedia.url}
        title={title}
        alt={title}
      />
    )
  }

  return (
    <>
      {/* Top inset keeps the modal's close button clear of the media */}
      {displayedMultimedia && (
        <Box px={6} pt={10}>
          {displayedMultimedia}
        </Box>
      )}
      <ModalHeader mb={displayedMultimedia ? 0 : 2}>
        <Text textStyle="h4">{title}</Text>
      </ModalHeader>

      <ModalBody>
        <MarkdownRenderer source={details} components={mdComponents} />
      </ModalBody>
    </>
  )
}
