export const formSgConfig = Object.freeze({
  apiKeys: {
    prod: process.env.FORMSG_API_KEY,
    staging: process.env.FORMSG_STAGING_API_KEY,
  },
})

if (!formSgConfig.apiKeys.prod) {
  throw new Error('FORMSG_API_KEY env var needs to be set')
}

if (!formSgConfig.apiKeys.staging) {
  throw new Error('FORMSG_STAGING_API_KEY env var needs to be set')
}
