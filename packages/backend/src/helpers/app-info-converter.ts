import type { IApp } from '@plumber/types'

import appConfig from '@/config/app'

const appInfoConverter = (rawAppData: IApp) => {
  rawAppData.iconUrl = rawAppData.iconUrl.replace(
    '{BASE_URL}',
    appConfig.baseUrl,
  )

  if (rawAppData.auth?.fields) {
    rawAppData.auth.fields = rawAppData.auth.fields.map((field) => {
      if (typeof field.value === 'string') {
        return {
          ...field,
          value: field.value.replace('{WEB_APP_URL}', appConfig.webAppUrl),
        }
      }

      return field
    })
  }

  return rawAppData
}

export default appInfoConverter
