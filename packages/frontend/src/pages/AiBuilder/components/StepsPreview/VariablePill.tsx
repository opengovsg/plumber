import { Box } from '@chakra-ui/react'

interface VariablePillProps {
  label: string
}

export default function VariablePill({ label }: VariablePillProps) {
  return (
    <Box
      as="span"
      display="inline-flex"
      alignItems="center"
      bg="primary.100"
      borderRadius="50px"
      px="10px"
      py="2px"
      fontSize="12px"
      color="base.content.strong"
      fontWeight={500}
      whiteSpace="nowrap"
      lineHeight={1.4}
    >
      <span style={{ color: '#888', fontWeight: 400 }}>{'{}'}</span>
      {label}
    </Box>
  )
}
