import { join } from 'path'

import express, { Application } from 'express'

import appConfig from '@/config/app'

const webUIHandler = async (app: Application) => {
  if (appConfig.serveWebAppSeparately) {
    return
  }

  if (!require.main) {
    throw new Error('webUIHandler: require.main is not set')
  }

  const webBuildPath = join(__dirname, '..', '..', '..', 'frontend', 'dist')
  const indexHtml = join(webBuildPath, 'index.html')

  app.use(express.static(webBuildPath))
  app.get('*', (_req, res) => res.sendFile(indexHtml))
}

export default webUIHandler
