export const boxStyles = {
  border: '1px solid #ccc',
  borderRadius: '4px',
  padding: '8px 12px',
  cursor: 'pointer',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  backgroundColor: 'white',
  '&:hover': {
    borderColor: 'primary.300',
  },
  '&:focus-within': {
    borderColor: 'primary.500',
  },
  minHeight: '40px',
}

export const divWrapperStyles = { height: 40, width: '100%' }
