import { type IAction, type IApp, type ITrigger } from '@plumber/types'

import { useMemo } from 'react'
import { useQuery } from '@apollo/client'
import { GET_APPS } from 'graphql/queries/get-apps'

interface MappedIApp {
  rawApp: IApp
  actions: ReadonlyMap<string, IAction>
  triggers: ReadonlyMap<string, ITrigger>
}

export default function useApps(): ReadonlyMap<string, MappedIApp> | null {
  const appArray: IApp[] | null | undefined = useQuery(GET_APPS).data?.getApps
  const processedApps = useMemo(() => {
    if (!appArray) {
      return null
    }

    const result = new Map<string, MappedIApp>()
    for (const app of appArray) {
      result.set(app.key, {
        rawApp: app,
        actions: new Map(
          (app.actions ?? []).map((action) => [action.key, action]),
        ),
        triggers: new Map(
          (app.triggers ?? []).map((trigger) => [trigger.key, trigger]),
        ),
      })
    }
    return result
  }, [appArray])

  return processedApps
}
