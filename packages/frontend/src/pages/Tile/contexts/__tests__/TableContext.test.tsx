// @vitest-environment jsdom
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { DatabaseType } from '@/graphql/__generated__/graphql'

import { TableContextProvider, useTableContext } from '../TableContext'

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

let seen: { mode: string; hasEditPermission: boolean }

function Probe(): null {
  const { mode, hasEditPermission } = useTableContext()
  seen = { mode, hasEditPermission }
  return null
}

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

function render(role: string, isMigrating: boolean) {
  act(() => {
    root.render(
      <TableContextProvider
        tableId="t1"
        tableName="Tile"
        databaseType={DatabaseType.Ddb}
        tableColumns={[]}
        tableRows={[]}
        role={role}
        isMigrating={isMigrating}
        isFetching={false}
        isThroughputError={false}
        refetch={async () => undefined}
      >
        <Probe />
      </TableContextProvider>,
    )
  })
}

describe('TableContextProvider isMigrating', () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
  })

  it('starts in view mode without edit permission while migrating', () => {
    render('editor', true)
    expect(seen).toEqual({ mode: 'view', hasEditPermission: false })
  })

  it('drops to view mode when a freeze starts and restores edit when it lifts', () => {
    render('owner', false)
    expect(seen).toEqual({ mode: 'edit', hasEditPermission: true })

    render('owner', true)
    expect(seen).toEqual({ mode: 'view', hasEditPermission: false })

    render('owner', false)
    expect(seen).toEqual({ mode: 'edit', hasEditPermission: true })
  })

  it('keeps viewers in view mode after a freeze lifts', () => {
    render('viewer', true)
    render('viewer', false)
    expect(seen).toEqual({ mode: 'view', hasEditPermission: false })
  })
})
