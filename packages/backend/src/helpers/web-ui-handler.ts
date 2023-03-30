import express, { Application } from 'express'
import { dirname, join } from 'path'

import appConfig from '../config/app'

const webUIHandler = async (app: Application) => {
  if (appConfig.serveWebAppSeparately) {
    return
  }

  // points to src/server.(js/ts)
  console.log(require.main.filename)

  const webBuildPath = join(
    dirname(require.main.filename),
    '..',
    '..',
    'web',
    'build',
  )
  const indexHtml = join(webBuildPath, 'index.html')

  app.use(express.static(webBuildPath))
  app.get('*', (_req, res) => res.sendFile(indexHtml))
}

export default webUIHandler
