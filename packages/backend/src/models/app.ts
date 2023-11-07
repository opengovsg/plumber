import { IApp } from '@plumber/types'

import { memoize } from 'lodash'

import appInfoConverter from '@/helpers/app-info-converter'
import getApp from '@/helpers/get-app'

import apps from '../apps'

class App {
  static list = Object.keys(apps)

  static async findAll(name?: string, stripFuncs = true): Promise<IApp[]> {
    if (!name) {
      return Promise.all(
        this.list.map(
          async (name) => await this.findOneByName(name, stripFuncs),
        ),
      )
    }

    return Promise.all(
      this.list
        .filter((app) => app.includes(name.toLowerCase()))
        .map((name) => this.findOneByName(name, stripFuncs)),
    )
  }

  static async findOneByName(name: string, stripFuncs = false): Promise<IApp> {
    const rawAppData = await getApp(name.toLocaleLowerCase(), stripFuncs)

    return appInfoConverter(rawAppData)
  }

  static async findOneByKey(key: string, stripFuncs = false): Promise<IApp> {
    const rawAppData = await getApp(key, stripFuncs)

    return appInfoConverter(rawAppData)
  }

  static getAllAppsWithFunctions = memoize(async () => {
    return await this.findAll(null, false)
  })
}

export default App
