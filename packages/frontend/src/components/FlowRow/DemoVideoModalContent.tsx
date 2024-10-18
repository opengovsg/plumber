import { useProxyUrl } from '@/hooks/useGovtBrowser'

interface DemoVideoModalContentProps {
  src?: string
  title?: string
}

export default function DemoVideoModalContent(
  props: DemoVideoModalContentProps,
) {
  const { src, title } = props
  const { createProxiedUrl } = useProxyUrl()

  if (!src) {
    return null
  }

  return (
    <div
      style={{
        position: 'relative',
        paddingBottom: 'calc(62.585034013605444%)',
        height: 0,
        width: '100%',
      }}
    >
      <iframe
        src={createProxiedUrl(src)}
        title={title}
        loading="lazy"
        allowFullScreen
        allow="clipboard-write"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          colorScheme: 'light',
        }}
      />
    </div>
  )
}
