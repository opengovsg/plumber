export const formsgConfig = Object.freeze({
  apiKeys: {
    prod: process.env.FORMSG_API_KEY,
    staging: process.env.FORMSG_STAGING_API_KEY,
    uat: process.env.FORMSG_UAT_API_KEY,
  },
})

if (!formsgConfig.apiKeys.prod) {
  throw new Error('FORMSG_API_KEY env var needs to be set')
}

if (!formsgConfig.apiKeys.staging) {
  throw new Error('FORMSG_STAGING_API_KEY env var needs to be set')
}

if (!formsgConfig.apiKeys.uat) {
  throw new Error('FORMSG_UAT_API_KEY env var needs to be set')
}
