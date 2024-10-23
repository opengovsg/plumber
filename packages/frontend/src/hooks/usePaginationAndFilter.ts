import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

interface SearchParams {
  page: number
  input: string
  status: string
}

export function usePaginationAndFilter() {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = parseInt(searchParams.get('page') || '', 10) || 1
  const input = searchParams.get('input') || ''
  const status = searchParams.get('status') || ''

  // format search params for empty strings and first page
  const setFormattedSearchParams = useCallback(
    (params: Partial<SearchParams>) => {
      setSearchParams((currentSearchParams) => {
        const { page, input, status } = params
        if (page) {
          currentSearchParams.set('page', page.toString())
        }

        if (input != null) {
          currentSearchParams.set('input', input.trim())
          currentSearchParams.delete('page')
        }

        if (status != null) {
          currentSearchParams.set('status', status.trim())
          currentSearchParams.delete('page')
        }

        currentSearchParams.forEach((value, key) => {
          if (key === 'page' && value === '1') {
            currentSearchParams.delete(key)
          }
          if (value === '') {
            currentSearchParams.delete(key)
          }
        })

        return currentSearchParams
      })
    },
    [setSearchParams],
  )

  return {
    page,
    input,
    status,
    setSearchParams: setFormattedSearchParams,
    isSearching: input.trim() !== '' || page !== 1 || status !== '',
  }
}
