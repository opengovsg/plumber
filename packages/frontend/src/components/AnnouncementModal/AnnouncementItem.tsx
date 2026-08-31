import { useMemo } from 'react'
import { Components } from 'react-markdown'
import { Box, Image, ModalBody, ModalHeader, Text } from '@chakra-ui/react'
import { AnimationConfigWithData } from 'lottie-web'
import { RequireExactlyOne } from 'type-fest'

import MarkdownRenderer from '@/components/MarkdownRenderer'
import LottieWebAnimation from '@/components/NewsDrawer/LottieWebAnimation'

type AnnouncementItemMultimedia = RequireExactlyOne<
  {
    url: string
    animationData: AnimationConfigWithData['animationData']
  },
  'url' | 'animationData'
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
  const displayedMultimedia = useMemo(() => {
    if (!multimedia) {
      return
    }
    if (multimedia.animationData) {
      return (
        <LottieWebAnimation
          title={title}
          animationData={multimedia.animationData}
        />
      )
    }
    return (
      <Image
        borderTopRadius="lg"
        fit="fill"
        src={multimedia.url}
        title={title}
        alt={title}
      />
    )
  }, [multimedia, title])

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
