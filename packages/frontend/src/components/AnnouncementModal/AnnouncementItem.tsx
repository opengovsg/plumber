import { type ReactNode, useEffect, useState } from 'react'
import { Components } from 'react-markdown'
import {
  Box,
  Image,
  ModalBody,
  ModalHeader,
  Skeleton,
  Text,
} from '@chakra-ui/react'
import { AnimationConfigWithData } from 'lottie-web'
import { RequireExactlyOne } from 'type-fest'

import MarkdownRenderer from '@/components/MarkdownRenderer'
import LottieWebAnimation from '@/components/NewsDrawer/LottieWebAnimation'

type AnimationData = AnimationConfigWithData['animationData']

type AnnouncementItemMultimedia = RequireExactlyOne<
  {
    url: string
    animationData: AnimationData
    // Dynamic import keeps large Lottie JSON out of the main bundle.
    animationDataLoader: () => Promise<AnimationData>
  },
  'url' | 'animationData' | 'animationDataLoader'
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

function LazyLottieAnimation({
  title,
  loader,
}: {
  title: string
  loader: () => Promise<AnimationData>
}) {
  const [animationData, setAnimationData] = useState<AnimationData | null>(null)

  useEffect(() => {
    let cancelled = false
    void loader().then((data) => {
      if (!cancelled) {
        setAnimationData(data)
      }
    })
    return () => {
      cancelled = true
    }
  }, [loader])

  if (!animationData) {
    // 16:9 placeholder matching the 1920×1080 Lottie canvases
    return <Skeleton borderTopRadius="lg" w="100%" aspectRatio={16 / 9} />
  }

  return <LottieWebAnimation title={title} animationData={animationData} />
}

export default function AnnouncementItem(props: AnnouncementItemProps) {
  const { title, details, multimedia } = props

  let displayedMultimedia: ReactNode
  if (multimedia?.animationDataLoader) {
    displayedMultimedia = (
      <LazyLottieAnimation
        title={title}
        loader={multimedia.animationDataLoader}
      />
    )
  } else if (multimedia?.animationData) {
    displayedMultimedia = (
      <LottieWebAnimation
        title={title}
        animationData={multimedia.animationData}
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
