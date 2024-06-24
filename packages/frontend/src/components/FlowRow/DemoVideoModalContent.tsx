interface DemoVideoModalContentProps {
  src: string
  title: string
}

export default function DemoVideoModalContent(
  props: DemoVideoModalContentProps,
): JSX.Element {
  const { src, title } = props
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
        src={src}
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
      ></iframe>
    </div>
  )
}
