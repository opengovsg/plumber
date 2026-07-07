interface VariablePillProps {
  label: string
}

export default function VariablePill({ label }: VariablePillProps) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: '#F9DDE9',
        borderRadius: '50px',
        padding: '2px 10px',
        fontSize: '12px',
        color: '#2C2E34',
        fontWeight: 500,
        whiteSpace: 'nowrap',
        lineHeight: 1.4,
      }}
    >
      {label}
    </span>
  )
}
