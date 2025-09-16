import { IApp } from '@plumber/types'

import { memoize } from 'lodash'

import apps from '@/apps'
import appInfoConverter from '@/helpers/app-info-converter'
import getApp from '@/helpers/get-app'

class App {
  static list = Object.keys(apps)

  static findAll = memoize(
    async (stripFuncs = true): Promise<IApp[]> => {
      return Promise.all(
        this.list.map(
          async (name) => await this.findOneByName(name, stripFuncs),
        ),
      )
    },
    (stripFuncs = true) => `findAll-${stripFuncs}`,
  )

  static findOneByName = memoize(
    async (name: string, stripFuncs = false): Promise<IApp> => {
      const rawAppData = await getApp(name.toLocaleLowerCase(), stripFuncs)

      return appInfoConverter(rawAppData)
    },
    (name: string, stripFuncs = false) => `findOneByName-${name}-${stripFuncs}`,
  )

  static findOneByKey = memoize(
    async (key: string, stripFuncs = false): Promise<IApp> => {
      const rawAppData = await getApp(key, stripFuncs)

      return appInfoConverter(rawAppData)
    },
    (key: string, stripFuncs = false) =>
      `findOneByKey-${key}-stripFuncs-${stripFuncs}`,
  )

  static getAllAppsWithFunctions = memoize(async () => {
    return await this.findAll(false)
  })
}

export default App
