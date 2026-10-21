import express, { Application } from 'express'
import path from 'node:path'

import apps from '@/apps'

const appsBaseDir = path.resolve(__dirname, '../apps')

const appAssetsHandler = async (app: Application) => {
  app.use('/apps/:appKey/assets/favicon.svg', (req, res, next) => {
    const { appKey } = req.params

    // appKey comes from an unauthenticated route param, so it must be checked
    // against the app registry to stop path traversal into arbitrary files.
    const svgPath = path.resolve(appsBaseDir, appKey, 'assets/favicon.svg')
    const isKnownApp = Object.prototype.hasOwnProperty.call(apps, appKey)
    const isWithinAppsDir = svgPath.startsWith(appsBaseDir + path.sep)

    if (!isKnownApp || !isWithinAppsDir) {
      res.sendStatus(404)
      return
    }

    const staticFileHandlerOptions = {
      /**
       * Disabling fallthrough is important to respond with HTTP 404.
       * Otherwise, web app might be served.
       */
      fallthrough: false,
    }
    const staticFileHandler = express.static(svgPath, staticFileHandlerOptions)

    return staticFileHandler(req, res, next)
  })
}

export default appAssetsHandler
